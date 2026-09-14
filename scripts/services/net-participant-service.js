import { uid, assert, optionalDocument, safeImage } from "../constants.js";
import { neighbors } from "../graph/graph-layout.js";

export function isNetParticipant(actor) {
  return actor?.documentName === "Actor" && ["character", "mook", "demon"].includes(actor.type);
}
export async function makeParticipant(actorUuid, nodeId, visible = true, id = uid()) {
  const actor = await optionalDocument(actorUuid);
  assert(isNetParticipant(actor), "Choose a Character, Mook NPC Netrunner, or Demon Actor.");
  return { id, actorUuid: actor.uuid, nodeId, previousNodeId: null, visible,
    name: actor.name, kind: actor.type === "demon" ? "demon" : "netrunner", img: safeImage(actor.img) };
}
export class NetParticipantService {
  constructor(sessions) { this.sessions = sessions; }
  async build(architecture) {
    const list = [];
    for (const p of architecture.participants ?? []) {
      try { list.push(await makeParticipant(p.actorUuid, p.nodeId, p.visible, p.id)); }
      catch { list.push({ ...p, name: "Missing Actor", unavailable: true, visible: false }); }
    }
    return list;
  }
  async handle(user, req) {
    if (!["npc-add", "npc-move", "npc-visibility", "npc-remove", "renameRun"].includes(req.action)) return false;
    assert(user.isGM, "GM only.");
    const s = this.sessions.session;
    s.participants ??= [];
    if (req.action === "renameRun") s.architecture.name = String(req.name ?? "").trim().slice(0, 160) || "Night City Datafort";
    else if (req.action === "npc-add") {
      assert(s.participants.length < 100, "Maximum 100 NPCs per architecture.");
      assert(s.architecture.nodes.some(n => n.id === req.nodeId), "Choose a node for the NPC.");
      s.participants.push(await makeParticipant(req.actorUuid, req.nodeId, req.visible !== false));
    } else {
      const p = s.participants.find(p => p.id === req.participantId);
      assert(p, "NPC is no longer in this run.");
      if (req.action === "npc-remove") s.participants = s.participants.filter(x => x.id !== p.id);
      if (req.action === "npc-visibility") { assert(!p.unavailable, "Replace the missing Actor first."); p.visible = !p.visible; }
      if (req.action === "npc-move") {
        assert(!p.unavailable, "Replace the missing Actor first.");
        assert(neighbors(s.architecture, p.nodeId).includes(req.destinationId), "NPCs move along one connected edge at a time.");
        p.previousNodeId = p.nodeId;
        p.nodeId = req.destinationId;
      }
    }
    await this.sessions.commit();
    return true;
  }
}
