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
  const nodes = a.nodes.filter(n => seen.has(n.id) || frontier.has(n.id) || session.status === "active" && n.alwaysVisible).map(n => seen.has(n.id) ? {
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
  } : n.alwaysVisible ? {
    id: n.id, x: n.x, y: n.y, name: n.name, type: n.type,
    icon: n.icon, color: n.color, remote: true, attachments: [], controls: []
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
    bypassNodeIds: (session.bypassNodeIds ?? []).filter(id => visible.has(id)),
    iceStates: {},
    participants: session.status === "active" ? (session.participants ?? []).filter(p => p.visible && seen.has(p.nodeId)).map(p => ({
      id: p.id, name: p.name, kind: p.kind, nodeId: p.nodeId, img: p.img
    })) : [],
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
      edges: a.edges.filter(e => visible.has(e.from) && visible.has(e.to) &&
        (!(a.nodes.find(n => n.id === e.from)?.alwaysVisible || a.nodes.find(n => n.id === e.to)?.alwaysVisible) || e.from === session.currentNodeId || e.to === session.currentNodeId) &&
        (seen.has(e.from) && seen.has(e.to) || e.from === session.currentNodeId || e.to === session.currentNodeId)).map(clone)
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
    name: state.name,
    visible: true,
    rez: clone(state.rez ?? { value: 0, max: 0 }),
    target: state.target ? { kind: state.target.kind, id: state.target.id, name: state.target.name } : null
  };
  out.runnerTargetId = out.iceStates[session.runnerTargetId] ? session.runnerTargetId : null;
  out.netCombat = (session.netCombat ?? []).filter(entry => !entry.hidden &&
    (entry.source?.kind !== "ice" || out.iceStates[entry.source.id]) &&
    (entry.target?.kind !== "ice" || out.iceStates[entry.target.id])).map(entry => ({
      id: entry.id, kind: entry.kind, source: clone(entry.source), target: clone(entry.target),
      total: entry.total, status: entry.status, appliedDamage: entry.appliedDamage
    }));
  return out;
}
