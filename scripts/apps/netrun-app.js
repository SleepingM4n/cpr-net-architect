import { ID, escapeHTML as e, setting, assert, log, optionalDocument } from "../constants.js";
import { renderGraph } from "../graph/graph-renderer.js";
import { GraphInteractions } from "../graph/graph-interactions.js";
import { NETApplication, button as b, field, check, options, formDialog } from "./ui.js";
import { loginView } from "./login-app.js";
function programButtons(program) {
  const attrs = `data-id="${program.id}"`,
    attack = ["antipersonnelattacker", "antiprogramattacker", "blackice"].includes(program.class);
  return b("program", program.active ? "DEREZ" : "REZ", `${attrs} data-operation="${program.active ? "derez" : "rez"}"`) + (attack ? b("program", "Attack", `${attrs} data-operation="atk"`) + b("program", "Damage", `${attrs} data-operation="damage"`) : "") + (["defender", "blackice"].includes(program.class) ? b("program", "Defense", `${attrs} data-operation="def"`) : "") + b("open-program", "Open", attrs);
}
export class NetrunApp extends NETApplication {
  constructor(runtime) {
    super({
      title: "NET Architect — Live NETRUN",
      template: `modules/${ID}/templates/netrun.hbs`
    });
    this.runtime = runtime;
    this.selected = null;
    this.collapsed = false;
    this.lastEvent = null;
  }
  async getData() {
    const s = this.runtime.view;
    if (!s) return {
      body: '<div class="neta-shell neta-theme-red"><div class="neta-empty"><h2>SESSION TERMINATED</h2><p>Your physical Token remains on the tactical Scene.</p></div></div>'
    };
    const gm = s.role === "gm",
      runner = s.role === "runner",
      p = s.runner.profile,
      a = s.architecture;
    let sidebar = `<div class="neta-runner"><img src="${e(p.img)}" alt="Runner portrait"><h3>${e(p.name)}</h3><p>INTERFACE ${p.rank}</p><p>${e(p.deckName)}</p></div><section><h4>NET ACTIONS</h4><strong>${s.actions.max ? `${s.actions.used} / ${s.actions.max} USED` : "UNTRACKED"}</strong>${gm ? b("budget", "Set / Reset Budget") : ""}${s.combat ? `<p>ROUND ${s.combat.round} · TURN ${(s.combat.turn ?? 0) + 1}</p><p>${s.combat.isRunnerTurn ? "RUNNER HAS INITIATIVE" : "MEATSPACE COMBAT ACTIVE"}</p>` : ""}</section>`;
    if (gm || runner) sidebar += `<section><h4>CYBERDECK / PROGRAMS</h4><select class="neta-deck" aria-label="Active Cyberdeck">${options(p.decks.map(d => [d.id, d.name]), p.deckId)}</select>${p.programs.map(pr => `<article class="neta-program"><strong>${e(pr.name)}</strong><small>${pr.active ? "REZZED" : "DEREZZED"} · REZ ${pr.rez ?? "—"}</small><div class="neta-toolbar">${programButtons(pr)}</div></article>`).join("") || "<p>No installed Programs found.</p>"}</section>`;
    const n = a.nodes.find(n => n.id === this.selected);
    let panel = "<p>Select a node to inspect it.</p>";
    if (n) {
      const attachments = await Promise.all((n.attachments ?? []).map(async at => {
        const doc = gm ? await optionalDocument(at.uuid) : null;
        const name = gm ? doc?.name ?? "Missing Document" : at.name;
        const type = doc?.documentName ?? at.documentType;
        const taken = at.taken || s.claimedAttachments?.[`${n.id}:${at.id}`];
        const pickup = type === "Item" && (gm || runner) ? b("takeItem", taken ? "Taken" : "Take Item", `data-id="${at.id}" ${taken || s.currentNodeId !== n.id || !s.clearedNodeIds.includes(n.id) ? "disabled" : ""}`) : "";
        return `<li><span>${e(name)}</span>${pickup}${b("open-attachment", ["JournalEntry", "JournalEntryPage"].includes(type) ? "Read" : "Open", `data-id="${at.id}"`)}${gm && this.runtime.adapter.isIce(doc) ? `<div class="neta-toolbar">${["rez", "derez", "reveal", "hide", "defeat"].map(op => b("ice", op.toUpperCase(), `data-id="${at.id}" data-operation="${op}"`)).join("")}${(doc.type === "demon" ? ["interface", "combatNumber"] : ["atk", "damage"]).map(stat => b("iceRoll", stat.toUpperCase(), `data-id="${at.id}" data-stat="${stat}"`)).join("")}</div>` : ""}</li>`;
      }));
      const interactive = gm || runner;
      panel = `<h3>${n.unknown ? "ENCRYPTED FRONTIER" : e(n.name)}</h3><p>${n.unknown ? "Resolve this signal to discover its contents." : e(n.notes)}</p>${interactive ? `<div class="neta-toolbar">${b("attempt", gm ? "ROLL FOR NETRUNNER" : n.unknown ? "ATTEMPT ACCESS" : n.challenge?.enabled ? `${n.challenge.action.toUpperCase()} — DV ${n.challenge.dv}` : "RESOLVE NODE")}${b("move", "MOVE HERE")}</div>` : "<p>OBSERVER · READ ONLY</p>"}${attachments.length ? `<details open><summary>Attachments</summary><ul>${attachments.join("")}</ul></details>` : ""}${interactive ? (n.controls ?? []).map(c => b("control", c.label, `data-id="${c.id}"`)).join("") : ""}${gm ? `<h4>GM CONTROLS</h4><p class="neta-gm-notes">${e(n.gmNotes)}</p><div class="neta-toolbar">${[["reveal", "Reveal"], ["hide", "Hide"], ["revealBranch", "Reveal Branch"], ["revealAll", "Reveal All"], ["moveGM", "Move Runner Here"], ["clear", "Mark Cleared"], ["compromise", "Mark Compromised"]].map(([op, label]) => b(op, label)).join("")}</div>` : ""}`;
    }
    if (n && this.reading) {
      const attachment = n.attachments?.find(a => a.id === this.reading);
      if (attachment) panel += await this.journalContent(attachment.uuid);
    }
    const ice = Object.values(s.iceStates ?? {}).filter(x => x.rezzed && (gm || x.visible !== false)).map(x => `<p class="neta-ice-alert">▲ ${e(x.name)} / REZZED</p>`).join("");
    return {
      body: `<div class="neta-shell neta-theme-${a.theme}"><header class="neta-header"><div><span class="neta-kicker">${gm ? "GM CONTROL" : runner ? "NEURAL LINK" : "OBSERVER FEED"} / ${s.status === "login" ? "SECURE CONNECTION" : "JACKED IN"}</span><h2>${e(a.name)}</h2></div><div class="neta-toolbar">${b("sidebar", this.collapsed ? "Show Sidebar" : "Collapse Sidebar")}${b("fit", "Fit")}${gm ? b("broadcast", "SHOW TO PLAYERS") + b("reset", "RESET NETRUN") : ""}${gm || runner ? b("end", gm ? "END NETRUN" : "JACK OUT") : b("stop", "STOP VIEWING")}</div></header>${s.status === "login" ? loginView(s) : `<main class="neta-main"><aside class="neta-run-sidebar" ${this.collapsed ? "hidden" : ""}>${sidebar}${ice}</aside>${renderGraph(a, {
        selected: this.selected,
        current: s.currentNodeId,
        previous: s.previousNodeId,
        cleared: s.clearedNodeIds,
        failed: s.failedNodeIds,
        compromised: s.compromisedNodeIds,
        avatar: p.img
      })}<aside class="neta-inspector">${panel}</aside></main>`}<div class="neta-feedback" role="status" aria-live="polite">${e(s.event?.text ?? "")}</div><footer>CONNECTION: STABLE · ${e(a.nodes.find(n => n.id === s.currentNodeId)?.name ?? "AWAITING JACK IN")} · ${gm ? "FULL ARCHITECTURE" : runner ? "DISCOVERY FILTER ACTIVE" : "READ ONLY"}</footer></div>`
    };
  }
  activateListeners(html) {
    super.activateListeners(html);
    const s = this.runtime.view;
    if (!s) return;
    this.graph = new GraphInteractions(this, s.architecture, {
      onSelect: id => {
        this.selected = id;
        this.reading = null;
        this.render(false);
      }
    });
    this.graph.bind(this.root);
    html.find(".neta-deck").on("change", ev => this.send("deck", {
      deckId: ev.target.value
    }).catch(log.error));
    if (s.event && s.event.id !== this.lastEvent) {
      this.lastEvent = s.event.id;
      const shell = this.root.querySelector(".neta-shell");
      shell.classList.add(s.event.success ? "neta-success" : "neta-failure");
      setTimeout(() => shell.classList.remove("neta-success", "neta-failure"), 850);
      this.sound(s.event.success);
    }
  }
  async sound(success) {
    if (!setting("sounds")) return;
    try {
      this.audio ??= new AudioContext();
      await this.audio.resume();
      const oscillator = this.audio.createOscillator(),
        gain = this.audio.createGain();
      oscillator.type = success ? "sine" : "sawtooth";
      oscillator.frequency.value = success ? 880 : 100;
      gain.gain.setValueAtTime(0.035, this.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + 0.15);
      oscillator.connect(gain);
      gain.connect(this.audio.destination);
      oscillator.start();
      oscillator.stop(this.audio.currentTime + 0.16);
    } catch (error) {
      log.debug("Sound unavailable", error.message);
    }
  }
  async send(action, extra = {}) {
    const s = this.runtime.view;
    assert(s, "No active NETRUN.");
    const reply = await this.runtime.socket.request({
      action,
      sessionId: s.id,
      revision: s.revision,
      nodeId: this.selected,
      ...extra
    });
    if (!reply?.rollGrant) return reply;
    const grant = reply.rollGrant;
    try {
      const actor = await this.runtime.adapter.resolve(grant.actorUuid);
      const options = { playerGrant: grant };
      const result = grant.programId
        ? await this.runtime.adapter.program(actor, grant.deckId, grant.programId, grant.programAction, options)
        : await this.runtime.adapter.rollInterface(actor, { ability: grant.ability, deckId: grant.deckId, ...options });
      return await this.runtime.socket.request({ action: result ? "completeRoll" : "cancelRoll", sessionId: s.id, token: grant.token, messageId: result?.messageId });
    } catch (error) {
      await this.runtime.socket.request({ action: "cancelRoll", sessionId: s.id, token: grant.token }).catch(() => {});
      throw error;
    }
  }
  async action(action, target) {
    const s = this.runtime.view;
    if (action === "stop") {
      await this.close();
      return;
    }
    if (action === "sidebar") {
      this.collapsed = !this.collapsed;
      this.render(false);
      return;
    }
    if (action === "fit") {
      this.graph?.fit();
      return;
    }
    if (action === "end") {
      if (setting("confirmJackOut") && !(await Dialog.confirm({
        title: "JACK OUT?",
        content: "<p>The NET session will end for your character.</p>",
        yes: () => true,
        no: () => false
      }))) return;
      await this.send("end");
      return;
    }
    if (action === "reset" && !(await Dialog.confirm({
      title: "Reset NETRUN",
      content: "<p>Reset discovery and return to the login screen?</p>"
    }))) return;
    if (action === "broadcast") {
      const f = await formDialog("SHOW TO PLAYERS", `<p>Select viewers. No selections means Netrunner Only. Select everyone to broadcast to all.</p>${game.users.filter(u => !u.isGM && u.id !== s.runner.userId).map(u => check(u.id, u.name, s.observers?.includes(u.id))).join("")}`, "Update Viewers");
      if (f) await this.send("broadcast", {
        users: Object.entries(f).filter(([, v]) => v).map(([k]) => k)
      });
      return;
    }
    if (action === "budget") {
      const f = await formDialog("NET Action Budget", field("max", "Actions per turn (0 = untracked)", s.actions.max, "number"));
      if (f) await this.send("budget", {
        max: Number(f.max)
      });
      return;
    }
    if (action === "program") {
      await this.send("program", {
        programId: target.dataset.id,
        programAction: target.dataset.operation
      });
      return;
    }
    if (action === "open-program") {
      const pr = s.runner.profile.programs.find(p => p.id === target.dataset.id);
      await this.open(pr.uuid);
      return;
    }
    if (action === "open-attachment") {
      const at = s.architecture.nodes.find(n => n.id === this.selected)?.attachments.find(a => a.id === target.dataset.id);
      const doc = await optionalDocument(at.uuid);
      if (["JournalEntry", "JournalEntryPage"].includes(doc?.documentName)) {
        this.reading = at.id;
        this.render(false);
      } else await this.open(at.uuid);
      return;
    }
    if (action === "open-journal-sheet") {
      const at = s.architecture.nodes.find(n => n.id === this.selected)?.attachments.find(a => a.id === this.reading);
      if (at) await this.open(at.uuid);
      return;
    }
    if (action === "takeItem") {
      await this.send("takeItem", { attachmentId: target.dataset.id });
      ui.notifications.info("Item added to the Netrunner's sheet.");
      return;
    }
    if (action === "close-reader") { this.reading = null; this.render(false); return; }
    if (action === "ice") {
      await this.send("ice", {
        attachmentId: target.dataset.id,
        operation: target.dataset.operation
      });
      return;
    }
    if (action === "iceRoll") {
      await this.send("iceRoll", {
        attachmentId: target.dataset.id,
        stat: target.dataset.stat
      });
      return;
    }
    if (action === "control") {
      await this.send("control", {
        controlId: target.dataset.id
      });
      return;
    }
    await this.send(action);
  }
  async journalContent(uuid) {
    const doc = await optionalDocument(uuid);
    if (!doc || !doc.testUserPermission(game.user, "OBSERVER")) return '<p>Ask the GM for Observer permission to read this journal.</p>';
    const pages = doc.documentName === "JournalEntry" ? [...doc.pages].sort((a, b) => a.sort - b.sort) : [doc];
    const content = [];
    for (const page of pages) {
      if (!page.testUserPermission(game.user, "OBSERVER")) continue;
      let body = "";
      if (page.type === "text") body = await TextEditor.enrichHTML(page.text?.content || `<pre>${e(page.text?.markdown ?? "")}</pre>`, { async: true, secrets: game.user.isGM, relativeTo: page });
      else if (page.type === "image") body = `<img src="${e(page.src)}" alt="${e(page.name)}">`;
      else body = '<p>This media page can be opened from the journal sheet.</p>';
      content.push(`<article class="neta-journal-body"><h4>${e(page.name)}</h4>${body}</article>`);
    }
    return `<section class="neta-journal-reader"><h3>${e(doc.name)}</h3>${b("close-reader", "Close Reader")}${b("open-journal-sheet", "Open Sheet")}${content.join("") || "<p>No readable pages.</p>"}</section>`;
  }
  async open(uuid) {
    const doc = await optionalDocument(uuid);
    assert(doc, "Linked Document no longer exists.");
    assert(doc.testUserPermission(game.user, "LIMITED"), "You do not have permission to view this Document. Ask the GM to share it.");
    doc.sheet.render(true);
  }
  async close(options) {
    if (setting("rememberPosition")) localStorage.setItem(`${ID}.position.${game.world.id}.${game.user.id}`, JSON.stringify({
      left: this.position.left,
      top: this.position.top,
      width: this.position.width,
      height: this.position.height
    }));
    this.runtime.locallyClosed = true;
    return super.close(options);
  }
}
