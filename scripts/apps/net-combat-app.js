import { participantPanel, participantAction } from "./net-participants.js";
import { ID, escapeHTML as e, optionalDocument, assert } from "../constants.js";
import { NETApplication, button as b, field, options, formDialog } from "./ui.js";
import { iceConfigDialog } from "./ice-config.js";
import { neighbors } from "../graph/graph-layout.js";

export class NetCombatApp extends NETApplication {
  constructor(runtime) {
    super({ title: "NET Architect — NET Combat", template: `modules/${ID}/templates/application.hbs`, width: 1050, height: 740 });
    this.runtime = runtime;
  }
  async getData() {
    const s = this.runtime.view;
    if (!s || s.status !== "active") return { body: '<div class="neta-shell neta-theme-red"><p>Jack In to an active NETRUN to use NET Combat.</p></div>' };
    const gm = s.role === "gm", interactive = gm || s.role === "runner", p = s.runner.profile;
    const current = s.architecture.nodes.find(n => n.id === s.currentNodeId)?.name ?? "Current node";
    const runnerActions = ["zap", "zapDamage", "defense", "speed"].map(op => b("runnerCombatRoll", {zap:"Zap Attack", zapDamage:"Zap Damage", defense:"Interface Defense", speed:"Speed"}[op], `data-operation="${op}"`)).join("");
    const programs = p.programs.map(pr => `<article><strong>${e(pr.name)}</strong> · ${pr.active ? "REZZED" : "DEREZZED"} · REZ ${e(pr.rez)}<div class="neta-toolbar">${interactive ? [pr.active ? "derez" : "rez", ...(["antipersonnelattacker", "antiprogramattacker", "blackice"].includes(pr.class) ? ["atk", "damage"] : []), ...(["defender", "blackice"].includes(pr.class) ? ["def"] : [])].map(op => b("program", op.toUpperCase(), `data-id="${pr.id}" data-operation="${op}"`)).join("") : ""}</div></article>`).join("");
    const ice = Object.entries(s.iceStates ?? {}).map(([id, ice]) => {
      const attrs = `data-id="${id}"`, sameNode = ice.nodeId === s.currentNodeId;
      const location = s.architecture.nodes.find(n => n.id === ice.nodeId)?.name ?? "Unrevealed node";
      const moves = neighbors(s.architecture, ice.nodeId).map(nodeId => [nodeId, s.architecture.nodes.find(n => n.id === nodeId)?.name ?? nodeId]);
      return `<article class="neta-combat-card"><h3>${e(ice.name)} ${s.runnerTargetId === id ? "◎ TARGETED" : ""}</h3><p>${e(location)} · ${ice.defeated ? "DEFEATED" : ice.rezzed ? "REZZED" : "DEREZZED"} · REZ ${e(ice.rez?.value ?? "?")} / ${e(ice.rez?.max ?? "?")}</p><p>Target: ${e(ice.target?.name ?? "None")}</p>${interactive && sameNode && ice.visible && ice.rezzed && !ice.defeated ? b("targetIce", "Target ICE", attrs) : ""}${gm ? `${ice.unavailable ? `<p>Legacy source unavailable: ${e(ice.unavailable)} Use Edit Encounter to supply stats, REZ and Programs before rezzing.</p>` : ""}<p>PER ${e(ice.stats?.per)} · SPD ${e(ice.stats?.spd)} · ATK ${e(ice.stats?.atk)} · DEF ${e(ice.stats?.def)}</p><div class="neta-toolbar">${b("editIce", "Edit Encounter", attrs)}${["rez", "derez", "reveal", "hide", "defeat"].map(op => b("iceStatus", op.toUpperCase(), `${attrs} data-operation="${op}"`)).join("")}</div><label>Move along connection<select data-move-for="${id}">${options(moves)}</select></label>${b("moveIce", "Move ICE", `${attrs} ${moves.length ? "" : "disabled"}`)}<label>Target runner or Program<select data-target-for="${id}">${options([["", p.name], ...p.programs.filter(pr => pr.active).map(pr => [pr.id, pr.name])], ice.target?.kind === "program" ? ice.target.id : "")}</select></label>${b("iceTarget", "Set ICE Target", `${attrs} ${sameNode ? "" : "disabled"}`)}<label>Roll with<select data-program-for="${id}">${options([["", "ICE stats / first Program damage"], ...(ice.programs ?? []).map(pr => [pr.id, pr.name])])}</select></label><div class="neta-toolbar">${["atk", "def", "spd", "per", "damage"].map(op => b("encounterRoll", op.toUpperCase(), `${attrs} data-operation="${op}"`)).join("")}</div>` : ""}</article>`;
    }).join("") || "<p>No visible ICE encounters.</p>";
    const deployment = [];
    if (gm) for (const node of s.architecture.nodes) {
      const docs = await Promise.all(node.attachments.map(a => optionalDocument(a.uuid)));
      const hasActor = docs.some(doc => doc?.documentName === "Actor" && this.runtime.adapter.isIce(doc));
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i], a = node.attachments[i];
        if (!s.iceStates[a.id] && this.runtime.adapter.isIce(doc) && (!hasActor || doc.documentName === "Actor")) deployment.push(b("deployIce", `Deploy ${doc.name} at ${node.name}`, `data-id="${a.id}" data-node-id="${node.id}"`));
      }
    }
    const history = [...(s.netCombat ?? [])].reverse().map(entry => `<article class="neta-combat-record"><strong>${e(entry.source?.name)} · ${e(entry.kind.toUpperCase())}: ${e(entry.total)}</strong><p>${entry.target ? `→ ${e(entry.target.name)} · ` : ""}${e(entry.status.toUpperCase())}${entry.appliedDamage != null ? ` · ${entry.appliedDamage} final damage` : ""}${entry.hidden ? " · GM ONLY" : ""}</p>${gm && entry.kind === "atk" ? b("confirmHit", "Confirm Hit", `data-id="${entry.id}" data-result="hit"`) + b("confirmHit", "Confirm Miss", `data-id="${entry.id}" data-result="miss"`) : ""}${gm && entry.kind === "damage" && entry.target && entry.status !== "applied" ? b("applyNetDamage", "Confirm / Apply Damage", `data-id="${entry.id}"`) : ""}</article>`).join("");
    return { body: `<div class="neta-shell neta-theme-${s.architecture.theme}"><header class="neta-header"><div><span class="neta-kicker">NET COMBAT · GM CONFIRMS OUTCOMES</span><h2>${e(s.architecture.name)}</h2></div></header><main class="neta-combat-layout"><section><h3>${e(p.name)}</h3><p>${e(current)} · HP ${e(p.hp ?? "?")} / ${e(p.maxHp ?? "?")}</p><p>Target: ${e(s.iceStates[s.runnerTargetId]?.name ?? "None")}</p>${interactive ? `<div class="neta-toolbar">${runnerActions}${b("clearTarget", "Clear Target")}</div>` : "<p>OBSERVER · READ ONLY</p>"}<h4>PROGRAMS</h4>${programs}<p>Targets must occupy the same node. Roll defense, then let the GM confirm the hit. GM applies final damage after reductions and any special effects.</p><h4>COMBAT LOG</h4>${history || "<p>No combat rolls yet.</p>"}</section><section>${participantPanel(s.architecture, s.participants, gm)}<h3>ICE ENCOUNTERS</h3>${ice}${gm && deployment.length ? `<h4>UNDEPLOYED</h4>${deployment.join("")}` : ""}</section></main></div>` };
  }
  async action(action, target) {
    const s = this.runtime.view, id = target.dataset.id;
    if (await participantAction(this, action, target)) return;
    const send = (command, extra = {}) => this.runtime.runApp.send(command, extra);
    if (action === "runnerCombatRoll") return send(action, { operation: target.dataset.operation });
    if (action === "program") return send(action, { programId: id, programAction: target.dataset.operation });
    if (action === "targetIce" || action === "clearTarget") return send("targetIce", { iceId: action === "clearTarget" ? null : id });
    if (action === "deployIce") return send(action, { nodeId: target.dataset.nodeId, attachmentId: id });
    if (action === "editIce") {
      const result = await iceConfigDialog({}, s.iceStates[id]);
      if (result) await send(action, { iceId: id, ...result });
      return;
    }
    if (action === "moveIce") return send(action, { iceId: id, destinationId: this.root.querySelector(`[data-move-for="${id}"]`).value });
    if (action === "iceTarget") return send(action, { iceId: id, programId: this.root.querySelector(`[data-target-for="${id}"]`).value });
    if (action === "iceStatus") return send(action, { iceId: id, operation: target.dataset.operation });
    if (action === "encounterRoll") return send(action, { iceId: id, operation: target.dataset.operation, programId: this.root.querySelector(`[data-program-for="${id}"]`).value });
    if (action === "confirmHit") return send(action, { rollId: id, result: target.dataset.result });
    if (action === "applyNetDamage") {
      const entry = s.netCombat.find(entry => entry.id === id);
      assert(entry?.target, "Damage target is missing.");
      const f = await formDialog("Apply confirmed NET damage", `<p>Apply to <strong>${e(entry.target.name)}</strong>. This updates ${entry.target.kind === "ice" ? "encounter REZ only" : "the real runner sheet"}. Enter final damage after all reductions and special effects. No automatic critical bonus is added.</p>${field("amount", "Final damage", entry.total, "number")}`, "Apply Damage");
      if (f) await send(action, { rollId: id, amount: Number(f.amount) });
    }
  }
}
