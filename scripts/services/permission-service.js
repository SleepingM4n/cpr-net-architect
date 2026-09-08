import { clone } from "../constants.js";
import { neighbors } from "../graph/graph-layout.js";
export function canView(session, user) {
  return !!session && (user.isGM || user.id === session.runner.userId || session.observers.includes(user.id));
}
export function canRun(session, user) {
  return !!session && (user.isGM || user.id === session.runner.userId);
}
/** Pure projection. Unknown placeholders contain no type, DV, labels, links, or notes. */
export function getVisibleSessionStateForUser(session, user) {
  if (!canView(session, user)) return null;
  if (user.isGM) return {
    ...clone(session),
    role: "gm"
  };
  const a = session.architecture,
    seen = new Set(session.discoveredNodeIds),
    frontier = new Set();
  if (session.status === "active") for (const id of neighbors(a, session.currentNodeId)) if (!seen.has(id)) frontier.add(id);
  const nodes = a.nodes.filter(n => seen.has(n.id) || frontier.has(n.id)).map(n => seen.has(n.id) ? {
    id: n.id,
    name: n.name,
    type: n.type,
    x: n.x,
    y: n.y,
    depth: n.depth,
    icon: n.icon,
    color: n.color,
    notes: n.notes,
    challenge: {
      enabled: n.challenge.enabled,
      action: n.challenge.action,
      dv: n.challenge.dv
    },
    attachments: [],
    controls: session.clearedNodeIds.includes(n.id) ? n.controls.map(c => ({
      id: c.id,
      label: c.label
    })) : []
  } : {
    id: n.id,
    x: n.x,
    y: n.y,
    unknown: true
  });
  const visible = new Set(nodes.map(n => n.id));
  const out = {
    id: session.id,
    revision: session.revision,
    status: session.status,
    role: user.id === session.runner.userId ? "runner" : "observer",
    runner: {
      userId: session.runner.userId,
      profile: clone(session.runner.profile)
    },
    currentNodeId: session.currentNodeId,
    previousNodeId: seen.has(session.previousNodeId) ? session.previousNodeId : null,
    discoveredNodeIds: [...seen],
    clearedNodeIds: session.clearedNodeIds.filter(id => seen.has(id)),
    failedNodeIds: session.failedNodeIds.filter(id => seen.has(id)),
    compromisedNodeIds: session.compromisedNodeIds.filter(id => seen.has(id)),
    iceStates: {},
    actions: clone(session.actions),
    combat: clone(session.combat),
    event: session.event ? {
      id: session.event.id,
      success: session.event.success,
      text: session.event.text
    } : null,
    architecture: {
      name: a.name,
      theme: a.theme,
      nodes,
      edges: a.edges.filter(e => visible.has(e.from) && visible.has(e.to) && (seen.has(e.from) && seen.has(e.to) || e.from === session.currentNodeId || e.to === session.currentNodeId)).map(clone)
    }
  };
  // Observers do not need access to the runner's inventory identifiers.
  if (out.role === "observer") {
    out.runner.profile.programs = [];
    out.runner.profile.decks = [];
    delete out.runner.profile.uuid;
  }
  for (const [id, state] of Object.entries(session.iceStates)) if (seen.has(state.nodeId) && state.visible) out.iceStates[id] = {
    nodeId: state.nodeId,
    rezzed: state.rezzed,
    defeated: state.defeated,
    name: state.name
  };
  return out;
}
