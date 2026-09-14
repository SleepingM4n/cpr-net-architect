import { participantPanel, participantAction } from "./net-participants.js";
import { iceConfigDialog } from "./ice-config.js";
import { ID, TYPES, ABILITIES, CONTROL_TYPES, clone, uid, escapeHTML as e, requireGM, assert, log, optionalDocument } from "../constants.js";
import { makeNode, validateArchitecture, downloadArchitecture } from "../services/import-export-service.js";
import { autoLayout } from "../graph/graph-layout.js";
import { renderGraph } from "../graph/graph-renderer.js";
import { GraphInteractions } from "../graph/graph-interactions.js";
import { NETApplication, button as b, field, check, options, formDialog } from "./ui.js";
export class ArchitectureEditor extends NETApplication {
  constructor(runtime, architecture) {
    super({
      title: `NET Architect — ${architecture.name}`,
      template: `modules/${ID}/templates/architecture-editor.hbs`
    });
    requireGM();
    this.runtime = runtime;
    this.architecture = clone(architecture);
    this.selected = architecture.entryNodeId;
    this.dirty = false;
  }
  async getData() {
    const a = this.architecture,
      n = a.nodes.find(n => n.id === this.selected);
    let inspector = "<p>Select a node.</p>";
    if (n) {
      const attachments = await Promise.all(n.attachments.map(async x => {
        const doc = await optionalDocument(x.uuid);
        return `<li>${e(doc?.name ?? "Missing Document")} <small>${e(doc?.documentName ?? x.uuid)}</small>${b("attachment-open", "Open", `data-id="${x.id}"`)}${b("attachment-visibility", x.visible ? "Player-visible" : "GM-only", `data-id="${x.id}"`)}${this.runtime.adapter.isIce(doc) ? b("ice-config", "Configure ICE", `data-id="${x.id}"`) : ""}${b("attachment-remove", "Remove", `data-id="${x.id}"`)}</li>`;
      }));
      inspector = `<h3>NODE CONFIGURATION</h3><form class="neta-node-form">${field("name", "Name", n.name)}<label>Type<select name="type">${options([...new Set([...TYPES, n.type])], n.type)}</select></label>${field("customType", "Custom type (optional)", "")}${field("depth", "Floor / depth", n.depth ?? "", "number")}${field("icon", "Icon / symbol", n.icon)}${field("color", "Accent", n.color || "#ee354e", "color")}<label>Player notes<textarea name="notes">${e(n.notes)}</textarea></label><label>GM notes<textarea name="gmNotes">${e(n.gmNotes)}</textarea></label>${check("alwaysVisible", "Always show node (connections only nearby)", n.alwaysVisible)}${check("bypassAllowed", "Allow bypass without cracking (GM can change during run)", n.bypassAllowed)}<h4>CHALLENGE</h4>${check("enabled", "Enable Interface check", n.challenge.enabled)}<label>Native action<select name="action">${options(ABILITIES, n.challenge.action)}</select></label>${field("dv", "Difficulty Value", n.challenge.dv, "number")}${[["revealOnSuccess", "Reveal on success"], ["allowRetry", "Allow retry"], ["blocksOnFailure", "Failure blocks movement"], ["activateIceOnFailure", "Failure activates attached ICE"], ["autoResolve", "Automatically resolve"], ["requireApproval", "GM approval required"]].map(([key, label]) => check(key, label, n.challenge[key])).join("")}</form><div class="neta-toolbar">${b("entry", "Set Entry")}${b("duplicate-node", "Duplicate")}${b("delete-node", "Delete")}</div><h4>CONNECTIONS</h4><label>Connect to<select class="neta-connect-target">${options(a.nodes.filter(x => x.id !== n.id).map(x => [x.id, x.name]))}</select></label>${b("connect", "Connect")}<ul>${a.edges.filter(x => x.from === n.id || x.to === n.id).map(edge => `<li>${e(a.nodes.find(x => x.id === (edge.from === n.id ? edge.to : edge.from))?.name)}${b("disconnect", "Disconnect", `data-id="${edge.id}"`)}${b("reconnect", "Reconnect", `data-id="${edge.id}"`)}</li>`).join("")}</ul><h4>ATTACHMENTS</h4><p class="neta-muted">Drop Actors, Items, Journals, Pages, or Macros onto the node. New links are GM-only.</p><ul>${attachments.join("")}</ul><h4>MEATSPACE CONTROLS</h4>${b("add-control", "Add Control Action")}<ul>${n.controls.map(c => `<li>${e(c.label)} <small>${e(c.documentType)} / ${e(c.action)} ${c.approved ? "APPROVED" : ""}</small>${b("edit-control", "Edit", `data-id="${c.id}"`)}${b("remove-control", "Remove", `data-id="${c.id}"`)}</li>`).join("")}</ul>`;
    }
    return {
      body: `<div class="neta-shell neta-theme-${a.theme}"><header class="neta-header"><div><span class="neta-kicker">NET ARCHITECT / EDIT MODE ${this.dirty ? "/ UNSAVED" : ""}</span><h2>${e(a.name)}</h2></div><div class="neta-toolbar">${b("settings", "Name / Theme")}${b("add", "Add Node")}${b("layout", "Auto-layout")}${b("fit", "Fit")}${b("export", "Export")}${b("sync-native", "Link CPR Item")}${b("save", "Save Architecture")}</div></header><main class="neta-main">${renderGraph(a, {
        selected: this.selected,
        edit: true
      })}<aside class="neta-inspector">${inspector}${participantPanel(a, a.participants, true, true)}</aside></main><footer>EDIT MODE · UUID-linked content · Save before starting a NETRUN</footer></div>`
    };
  }
  activateListeners(html) {
    super.activateListeners(html);
    this.graph = new GraphInteractions(this, this.architecture, {
      edit: true,
      onSelect: id => {
        this.readNode();
        this.selected = id;
        this.render(false);
      },
      onChange: () => {
        this.dirty = true;
      },
      onDrop: (event, id) => this.drop(event, id).catch(log.error)
    });
    this.graph.bind(this.root);
    this.root.querySelector(".neta-node-form")?.addEventListener("change", () => {
      this.readNode();
      this.dirty = true;
    });
  }
  readNode() {
    const form = this.root?.querySelector(".neta-node-form"),
      n = this.architecture.nodes.find(n => n.id === this.selected);
    if (!form || !n) return;
    const f = Object.fromEntries(new FormData(form));
    for (const key of ["name", "icon", "color", "notes", "gmNotes"]) n[key] = f[key];
    n.alwaysVisible = form.elements.alwaysVisible.checked;
    n.bypassAllowed = form.elements.bypassAllowed.checked;
    n.type = f.customType || f.type;
    n.depth = f.depth === "" ? null : Number(f.depth);
    n.challenge.action = f.action;
    n.challenge.dv = Number(f.dv);
    for (const key of ["enabled", "revealOnSuccess", "allowRetry", "blocksOnFailure", "activateIceOnFailure", "autoResolve", "requireApproval"]) n.challenge[key] = form.elements[key].checked;
  }
  async drop(event, id) {
    requireGM();
    const data = TextEditor.getDragEventData(event);
    assert(data.uuid, "Drop a Foundry Document with a UUID.");
    const doc = await fromUuid(data.uuid);
    assert(doc && ["Actor", "Item", "JournalEntry", "JournalEntryPage", "Macro"].includes(doc.documentName), "Supported: Actor, Item, Journal, Page, Macro.");
    this.readNode();
    const n = this.architecture.nodes.find(n => n.id === id);
    n.attachments.push({
      id: uid(),
      uuid: doc.uuid,
      visible: false
    });
    if (this.runtime.adapter.isIce(doc) && n.type === "custom") n.type = doc.type === "demon" ? "demon" : "blackice";
    this.dirty = true;
    this.render(false);
  }
  async action(action, target) {
    requireGM();
    this.readNode();
    const a = this.architecture,
      n = a.nodes.find(n => n.id === this.selected);
    if (await participantAction(this, action, target, true)) return;
    switch (action) {
      case "save":
        this.architecture = await this.runtime.store.save(a);
        this.dirty = false;
        ui.notifications.info("Architecture saved.");
        this.runtime.manager?.render(false);
        break;
      case "settings":
        {
          const f = await formDialog("Architecture", `${field("name", "Name", a.name)}<label>Theme<select name="theme">${options([["red", "Cyberpunk RED"], ["2077", "Neon 2077"]], a.theme)}</select></label>`);
          if (f) {
            a.name = f.name.trim() || "Night City Datafort";
            a.theme = f.theme;
          }
          break;
        }
      case "add":
        {
          const f = await formDialog("Add Node", `<label>Type<select name="type">${options(TYPES, "password")}</select></label>${field("name", "Name", "")}`);
          if (f) {
            const node = makeNode(f.type, (n?.x ?? 50) + 270, n?.y ?? 60);
            if (f.name) node.name = f.name;
            a.nodes.push(node);
            this.selected = node.id;
          }
          break;
        }
      case "duplicate-node":
        {
          const node = clone(n);
          node.id = uid();
          node.x += 45;
          node.y += 140;
          node.name += " (Copy)";
          node.attachments.forEach(x => x.id = uid());
          node.controls.forEach(x => x.id = uid());
          a.nodes.push(node);
          this.selected = node.id;
          break;
        }
      case "delete-node":
        assert(a.nodes.length > 1, "Keep at least one node.");
        if (!(await Dialog.confirm({
          title: "Delete Node",
          content: `<p>Delete ${e(n.name)} and its connections?</p>`
        }))) return;
        a.participants = (a.participants ?? []).filter(p => p.nodeId !== n.id);
          a.nodes = a.nodes.filter(x => x.id !== n.id);
        a.edges = a.edges.filter(x => x.from !== n.id && x.to !== n.id);
        if (a.entryNodeId === n.id) a.entryNodeId = a.nodes[0].id;
        this.selected = a.entryNodeId;
        break;
      case "entry":
        a.entryNodeId = n.id;
        break;
      case "connect":
        {
          const to = this.root.querySelector(".neta-connect-target").value;
          assert(to, "Add another node first.");
          assert(!a.edges.some(x => [x.from, x.to].includes(n.id) && [x.from, x.to].includes(to)), "These nodes are already connected.");
          a.edges.push({
            id: uid(),
            from: n.id,
            to
          });
          break;
        }
      case "disconnect":
        a.edges = a.edges.filter(x => x.id !== target.dataset.id);
        break;
      case "reconnect":
        {
          const edge = a.edges.find(x => x.id === target.dataset.id);
          const f = await formDialog("Reconnect Path", `<label>From<select name="from">${options(a.nodes.map(x => [x.id, x.name]), edge.from)}</select></label><label>To<select name="to">${options(a.nodes.map(x => [x.id, x.name]), edge.to)}</select></label>`);
          if (f) {
            const old = clone(edge);
            Object.assign(edge, f);
            try {
              validateArchitecture(a);
            } catch (error) {
              Object.assign(edge, old);
              throw error;
            }
          }
          break;
        }
      case "layout":
        autoLayout(a);
        break;
      case "fit":
        this.graph.fit();
        return;
      case "export":
        downloadArchitecture(a);
        return;
      case "sync-native":
        await this.runtime.adapter.syncNative(a);
        ui.notifications.info("Native CPR Item linked. Native floors preserved; extended graph remains in private storage.");
        return;
      case "ice-config": {
        const attachment = n.attachments.find(a => a.id === target.dataset.id);
        const result = await iceConfigDialog(attachment.iceConfig);
        if (!result) return;
        attachment.iceConfig = result.config;
        break;
      }
      case "attachment-open":
        {
          const doc = await this.runtime.adapter.resolve(n.attachments.find(x => x.id === target.dataset.id).uuid);
          doc.sheet.render(true);
          return;
        }
      case "attachment-visibility":
        {
          const x = n.attachments.find(x => x.id === target.dataset.id);
          x.visible = !x.visible;
          break;
        }
      case "attachment-remove":
        n.attachments = n.attachments.filter(x => x.id !== target.dataset.id);
        break;
      case "remove-control":
        n.controls = n.controls.filter(x => x.id !== target.dataset.id);
        break;
      case "add-control":
      case "edit-control":
        await this.controlDialog(n, n.controls.find(x => x.id === target.dataset.id));
        break;
      default:
        return;
    }
    if (action !== "save") this.dirty = true;
    this.render(false);
  }
  async controlDialog(node, control) {
    const selected = canvas.walls?.controlled?.[0]?.document ?? canvas.tiles?.controlled?.[0]?.document ?? canvas.tokens?.controlled?.[0]?.document;
    const f = await formDialog("Configure Control Action", `${field("label", "Button label", control?.label ?? "OPEN DOOR")}${field("uuid", "Document UUID (or selected canvas object)", control?.uuid ?? selected?.uuid ?? "")}<label>Document type<select name="documentType">${options(Object.keys(CONTROL_TYPES), control?.documentType ?? selected?.documentName ?? "Wall")}</select></label><label>Action<select name="action">${options([...new Set(Object.values(CONTROL_TYPES).flat())], control?.action ?? "open")}</select></label>${check("approved", "Approve execution of this existing Macro as GM", control?.approved ?? false)}<p>Macros must exist in this world. Imported approvals are always cleared. No scripts are stored in architecture JSON.</p>`);
    if (!f) return;
    assert(CONTROL_TYPES[f.documentType]?.includes(f.action), "Action is not supported by the selected document type.");
    const doc = await this.runtime.adapter.resolve(f.uuid);
    assert(doc.documentName === f.documentType, "UUID does not match the selected document type.");
    const data = {
      id: control?.id ?? uid(),
      ...f
    };
    if (control) Object.assign(control, data);else node.controls.push(data);
  }
  async close(options) {
    if (this.dirty && !(await Dialog.confirm({
      title: "Unsaved Architecture",
      content: "<p>Close and discard unsaved changes?</p>"
    }))) return;
    return super.close(options);
  }
}
