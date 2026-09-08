export function neighbors(architecture, id) {
  return architecture.edges.filter(e => e.from === id || e.to === id).map(e => e.from === id ? e.to : e.from);
}
export function reachable(architecture, start) {
  const seen = new Set([start]),
    queue = [start];
  while (queue.length) {
    for (const id of neighbors(architecture, queue.shift())) if (!seen.has(id)) {
      seen.add(id);
      queue.push(id);
    }
  }
  return seen;
}
export function autoLayout(architecture) {
  const depths = new Map([[architecture.entryNodeId, 0]]),
    queue = [architecture.entryNodeId];
  while (queue.length) {
    const id = queue.shift();
    for (const next of neighbors(architecture, id)) if (!depths.has(next)) {
      depths.set(next, depths.get(id) + 1);
      queue.push(next);
    }
  }
  const lanes = new Map();
  for (const n of architecture.nodes) {
    const d = depths.get(n.id) ?? Math.max(0, ...depths.values()) + 1,
      lane = lanes.get(d) ?? 0;
    n.x = 60 + d * 270;
    n.y = 60 + lane * 180;
    lanes.set(d, lane + 1);
  }
  return architecture;
}
