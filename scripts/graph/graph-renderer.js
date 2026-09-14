import { escapeHTML as e } from "../constants.js";
export function renderGraph(a, {
  selected,
  current,
  previous,
  cleared = [],
  failed = [],
  compromised = [],
  avatar = "",
  bypassed = [],
  iceStates = {},
  participants = a.participants ?? [],
  edit = false
} = {}) {
  const nodes = new Map(a.nodes.map(n => [n.id, n]));
  const paths = a.edges.map(edge => {
    const from = nodes.get(edge.from),
      to = nodes.get(edge.to);
    if (!from || !to) return "";
    const active = from.id === previous && to.id === current || to.id === previous && from.id === current;
    const available = from.id === current || to.id === current;
    const x1 = from.x + 100,
      y1 = from.y + 55,
      x2 = to.x + 100,
      y2 = to.y + 55;
    return `<path data-edge="${e(edge.id)}" class="neta-path ${active ? "active" : ""} ${available ? "available" : ""} ${failed.includes(to.id) ? "locked" : ""} ${compromised.includes(to.id) ? "compromised" : ""}" d="M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}"/>`;
  }).join("");
  return `<div class="neta-viewport" tabindex="0" aria-label="NET architecture graph. Use node buttons to select; drag background to pan; mouse wheel to zoom."><div class="neta-world"><svg class="neta-connections" width="1" height="1" aria-hidden="true">${paths}</svg>${a.nodes.map(n => `<button type="button" data-node="${e(n.id)}" class="neta-node ${n.unknown ? "unknown" : ""} ${n.id === selected ? "selected" : ""} ${n.id === current ? "current" : ""} ${n.id === previous ? "previous" : ""} ${cleared.includes(n.id) ? "cleared" : ""} ${compromised.includes(n.id) ? "compromised" : ""}" style="left:${Number(n.x)}px;top:${Number(n.y)}px;${/^#[0-9a-f]{6}$/i.test(n.color) ? `--node-color:${n.color};` : ""}" aria-label="${e(n.unknown ? "Unknown frontier" : n.name)}"><span class="neta-node-type">${n.unknown ? "▓▓▓▓▓▓" : e(n.type)} ${n.depth == null ? "" : `// ${Number(n.depth)}`}</span><strong>${n.unknown ? "UNKNOWN" : `${e(n.icon)} ${e(n.name)}`}</strong><span class="neta-node-meta">${n.id === current ? "● YOU ARE HERE" : n.unknown ? "SIGNAL ENCRYPTED" : bypassed?.includes(n.id) && !cleared.includes(n.id) ? "BYPASS · NOT CRACKED" : n.remote ? "DISTANT SIGNAL" : cleared.includes(n.id) ? "ACCESS GRANTED" : n.challenge?.enabled ? `${e(n.challenge.action.toUpperCase())} / DV ${Number(n.challenge.dv)}` : "ROUTE AVAILABLE"}</span>${Object.values(iceStates).filter(ice => ice.nodeId === n.id && ice.rezzed).map(ice => `<span class="neta-ice-marker">▲ ${e(ice.name)}</span>`).join("")}${participants.filter(p => p.nodeId === n.id).length ? `<span class="neta-npc-markers" title="${e(participants.filter(p => p.nodeId === n.id).map(p => p.name).join(", "))}">${participants.filter(p => p.nodeId === n.id).map(p => `<span>${p.kind === "demon" ? "◆" : "●"} ${e(p.name)}</span>`).join("")}</span>` : ""}${n.id === current && avatar ? `<img class="neta-avatar" src="${e(avatar)}" alt="Runner">` : ""}</button>`).join("")}</div><span class="neta-map-hint">${edit ? "DRAG NODES · " : ""}DRAG BACKGROUND TO PAN · SCROLL TO ZOOM</span></div>`;
}
