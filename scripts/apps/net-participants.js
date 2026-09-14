import { escapeHTML as e, optionalDocument, assert } from "../constants.js";
import { button as b, field, options, check, formDialog } from "./ui.js";
import { neighbors } from "../graph/graph-layout.js";
import { isNetParticipant, makeParticipant } from "../services/net-participant-service.js";

export function participantPanel(architecture, participants = [], gm = false, template = false) {
  return `<section class="neta-participants"><h4>NPC NETRUNNERS / DEMONS</h4>${gm ? b("npc-add", "Place NPC / Demon") : ""}${participants.map(p => {
    const destinations = (template ? architecture.nodes.map(n => n.id) : neighbors(architecture, p.nodeId));
    return `<article class="neta-combat-card"><strong>${e(p.name ?? "Linked Actor")}</strong><p>${p.kind === "demon" ? "DEMON" : "NPC NETRUNNER"} · ${e(architecture.nodes.find(n => n.id === p.nodeId)?.name)}${gm && !p.visible ? " · HIDDEN" : ""}</p>${gm ? `<label>Destination<select data-npc-move="${e(p.id)}">${options(destinations.map(id => [id, architecture.nodes.find(n => n.id === id)?.name]), p.nodeId)}</select></label><div class="neta-toolbar">${b("npc-move", template ? "Place at Node" : "Move NPC", `data-id="${e(p.id)}" ${destinations.length ? "" : "disabled"}`)}${b("npc-open", "Actor Sheet", `data-id="${e(p.id)}"`)}${b("npc-visibility", p.visible ? "Hide NPC" : "Reveal NPC", `data-id="${e(p.id)}"`)}${b("npc-remove", "Remove NPC", `data-id="${e(p.id)}"`)}</div>` : ""}</article>`;
  }).join("")}</section>`;
}
export async function participantDialog(architecture, nodeId) {
  const actors = (game.actors ?? []).filter(isNetParticipant);
  const f = await formDialog("Place NPC Netrunner or Demon", `<label>Actor<select name="actorUuid">${options([["", "Choose Actor"], ...actors.map(a => [a.uuid, a.name])])}</select></label>${field("uuid", "Or paste an Actor UUID (including compendium)", "")}<label>Starting node<select name="nodeId">${options(architecture.nodes.map(n => [n.id, n.name]), nodeId)}</select></label>${check("visible", "Visible to players when this node is discovered", true)}<p>The GM moves each NPC independently. Physical Tokens and source Actors stay in place.</p>`, "Place Actor");
  if (!f) return null;
  return makeParticipant(f.uuid.trim() || f.actorUuid, f.nodeId, f.visible);
}
export async function participantAction(app, action, target, template = false) {
  if (!action.startsWith("npc-")) return false;
  assert(game.user.isGM, "GM only.");
  const a = template ? app.architecture : app.runtime.view.architecture;
  const list = template ? (a.participants ??= []) : app.runtime.view.participants ?? [];
  const id = target.dataset.id, p = list.find(p => p.id === id);
  if (action === "npc-open") {
    const actor = await optionalDocument(p?.actorUuid);
    assert(actor, "Linked Actor was deleted or is unavailable.");
    actor.sheet.render(true);
    return true;
  }
  let extra = { participantId: id };
  if (action === "npc-add") {
    const added = await participantDialog(a, app.selected ?? app.runtime.view?.currentNodeId ?? a.entryNodeId);
    if (!added) return true;
    if (template) list.push(added); else extra = added;
  } else {
    assert(p, "Select an existing NPC.");
    if (action === "npc-move") {
      extra.destinationId = app.root.querySelector(`[data-npc-move="${id}"]`).value;
      if (template) p.nodeId = extra.destinationId;
    } else if (action === "npc-visibility" && template) p.visible = !p.visible;
    else if (action === "npc-remove" && template) a.participants = list.filter(p => p.id !== id);
  }
  if (template) { app.dirty = true; app.render(false, { focus: false }); }
  else await app.runtime.runApp.send(action, extra);
  return true;
}
