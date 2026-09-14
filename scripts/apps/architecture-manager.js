import { ID, escapeHTML as e, setting, requireGM, assert } from "../constants.js";
import { makeArchitecture, duplicateArchitecture, importedArchitecture, downloadArchitecture } from "../services/import-export-service.js";
import { NETApplication, button as b, field, check, options, formDialog } from "./ui.js";
import { randomGenerator, nativeGenerator } from "./random-generator.js";
export class ArchitectureManager extends NETApplication {
  constructor(runtime) {
    super({
      title: "NET Architect — Architecture Library",
      template: `modules/${ID}/templates/architecture-manager.hbs`
    });
    requireGM();
    this.runtime = runtime;
    this.query = "";
    this.sort = "name";
  }
  async getData() {
    const all = this.runtime.store.list().sort((a, b) => this.sort === "name" ? a.name.localeCompare(b.name) : b.modifiedAt.localeCompare(a.modifiedAt));
    return {
      body: `<div class="neta-shell neta-theme-red"><header class="neta-header"><div><span class="neta-kicker">NIGHT CITY / PRIVATE NETWORKS</span><h2>NET ARCHITECT</h2></div><span class="neta-badge">${all.length} ARCHITECTURES</span></header><div class="neta-toolbar neta-library-tools">${b("new", "New Architecture")}${b("random", "Random Architecture")}${b("native-random", "Native Table Generator")}${b("import", "Import JSON")}${b("native-import", "Import from CPR")}${b("rejoin", "Rejoin NET View")}<input class="neta-search" placeholder="Search architectures…" value="${e(this.query)}" aria-label="Search architectures"><select class="neta-sort" aria-label="Sort architectures">${options([["name", "Name A–Z"], ["modified", "Recently modified"]], this.sort)}</select></div><section class="neta-library">${all.map(a => `<article class="neta-library-card neta-theme-${a.theme}" data-search="${e(a.name.toLowerCase())}" ${a.name.toLowerCase().includes(this.query.toLowerCase()) ? "" : "hidden"}><span class="neta-kicker">${e(a.theme === "red" ? "RED / DATAFORT" : "NEON / DATAFORT")}</span><h3>${e(a.name)}</h3><p>${a.nodes.length} NODES · ${a.edges.length} CONNECTIONS</p><div class="neta-toolbar">${b("start", "START NETRUN", `data-id="${a.id}"`)}${b("edit", "Edit", `data-id="${a.id}"`)}${b("rename", "Rename", `data-id="${a.id}"`)}${b("duplicate", "Duplicate", `data-id="${a.id}"`)}${b("export", "Export", `data-id="${a.id}"`)}${b("delete", "Delete", `data-id="${a.id}"`)}</div></article>`).join("")}${all.length ? "" : "<div class=\"neta-empty\"><h3>NO NETWORKS FOUND</h3><p>Create an architecture or import the included Kiroshi Warehouse example.</p></div>"}</section><footer>GM LIBRARY · Private world storage · Physical Scene stays active</footer></div>`
    };
  }
  activateListeners(html) {
    super.activateListeners(html);
    html.find(".neta-search").on("input", ev => {
      this.query = ev.target.value;
      this.root.querySelectorAll("[data-search]").forEach(el => el.hidden = !el.dataset.search.includes(this.query.toLowerCase()));
    });
    html.find(".neta-sort").on("change", ev => {
      this.sort = ev.target.value;
      this.render(false);
    });
  }
  async action(action, target) {
    requireGM();
    const store = this.runtime.store,
      id = target.dataset.id;
    switch (action) {
      case "new":
        {
          const f = await formDialog("New Architecture", field("name", "Name (blank = Night City Datafort)", ""));
          if (f) {
            const a = await store.save(makeArchitecture(f.name, setting("defaultTheme")));
            this.runtime.openEditor(a);
          }
          break;
        }
      case "edit":
        this.runtime.openEditor(store.get(id));
        return;
      case "rename":
        {
          const a = store.get(id),
            f = await formDialog("Rename Architecture", field("name", "Name", a.name));
          if (f) {
            a.name = f.name;
            await store.save(a);
          }
          break;
        }
      case "duplicate":
        await store.save(duplicateArchitecture(store.get(id)));
        break;
      case "delete":
        if (await Dialog.confirm({
          title: "Delete Architecture",
          content: `<p>Delete ${e(store.get(id).name)}? The active run, if any, uses its own snapshot.</p>`
        })) await store.delete(id);
        break;
      case "export":
        downloadArchitecture(store.get(id));
        return;
      case "import":
        {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".json,application/json";
          input.addEventListener("change", async () => {
            try {
              const file = input.files[0];
              assert(file && file.size <= 2000000, "JSON file must be smaller than 2 MB.");
              const a = await store.save(importedArchitecture(await file.text()));
              this.runtime.openEditor(a);
              this.render(false);
            } catch (err) {
              ui.notifications.error(err.message);
            }
          });
          input.click();
          return;
        }
      case "native-import":
        {
          const items = game.items.filter(i => i.type === "netarch");
          assert(items.length, "No native NET Architecture Items exist in this world.");
          const f = await formDialog("Import from CPR", `<label>NET Architecture<select name="id">${options(items.map(i => [i.id, i.name]))}</select></label><p>Native floor content is retained. Review inferred branch junctions in the editor and attach actual ICE Documents.</p>`);
          if (f) {
            const item = game.items.get(f.id),
              linked = item.getFlag(ID, "architectureId");
            const a = linked ? store.get(linked) : await store.save(this.runtime.adapter.importNative(item));
            this.runtime.openEditor(a);
          }
          break;
        }
      case "random":
        await randomGenerator(this.runtime);
        break;
      case "native-random":
        await nativeGenerator(this.runtime);
        break;
      case "start":
        await this.startDialog(id);
        break;
      case "rejoin":
        await this.runtime.rejoin();
        return;
    }
    this.render(false);
  }
  async startDialog(id) {
    const candidates = game.actors.filter(a => this.runtime.adapter.qualifies(a) && game.users.some(u => !u.isGM && u.active && a.testUserPermission(u, "OWNER")));
    const all = game.actors.filter(a => ["character", "mook", "demon"].includes(a.type));
    if (!candidates.length) ui.notifications.warn("No connected player-owned Actor has a configured NET Role. Configure the Character's Netrunning tab, or use GM override.");
    const f = await formDialog("Choose Netrunner", `<label>Configured Netrunners<select name="actorUuid">${options([["", "— Select —"], ...candidates.map(a => [a.uuid, `${a.name} — Interface ${this.runtime.adapter.profile(a).rank}`])])}</select></label>${check("override", "GM override: use Actor below", false)}<label>Override Actor<select name="overrideUuid">${options(all.map(a => [a.uuid, a.name]))}</select></label><label>Controlling user (optional; otherwise first connected owner)<select name="userId">${options([["", "Auto-detect"], ...game.users.filter(u => u.active).map(u => [u.id, u.name])])}</select></label>${field("actions", "Optional NET Action budget (0 = untracked)", 0, "number")}${check("broadcast", "Show to all players", false)}<p>The selected player receives a login screen and must press JACK IN. Player roll dialogs open on the player client; the GM applies the results.</p>`, "START NETRUN");
    if (!f) return;
    await this.runtime.sessions.start(id, f.override ? f.overrideUuid : f.actorUuid, {
      userId: f.userId || undefined,
      override: f.override,
      actions: Number(f.actions),
      observers: f.broadcast ? game.users.filter(u => !u.isGM).map(u => u.id) : []
    });
  }
}
