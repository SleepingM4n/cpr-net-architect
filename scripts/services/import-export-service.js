import { ID, VERSION, ABILITIES, CONTROL_TYPES, uid, clone, assert } from "../constants.js";
import { normalizeIceConfig } from "./net-combat-service.js";

// Allowlist normalization is intentional: imported executable fields, prototype keys,
// and unknown object properties never enter the world state.
const str = (v, max = 4000) => typeof v === "string" ? v.slice(0, max) : "";
const num = (v, min, max, fallback = 0) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : fallback;
const validId = v => typeof v === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(v) && !["__proto__", "constructor", "prototype"].includes(v);
export function makeNode(type = "custom", x = 80, y = 80) {
  const action = {
    password: "backdoor",
    file: "eyedee",
    control: "control"
  }[type] ?? "pathfinder";
  return {
    id: uid(),
    type,
    name: type === "access" ? "Access Point" : type.toUpperCase(),
    x,
    y,
    depth: null,
    icon: "◈",
    color: "",
    notes: "",
    gmNotes: "",
    alwaysVisible: false,
    bypassAllowed: false,
    attachments: [],
    controls: [],
    challenge: {
      enabled: ["password", "file", "control"].includes(type),
      action,
      dv: 8,
      revealOnSuccess: true,
      allowRetry: true,
      blocksOnFailure: true,
      activateIceOnFailure: false,
      autoResolve: false,
      requireApproval: false
    }
  };
}
export function makeArchitecture(name = "Night City Datafort", theme = "red") {
  const entry = makeNode("access");
  return {
    module: ID,
    schemaVersion: VERSION,
    id: uid(),
    name: String(name ?? "").trim().slice(0, 160) || "Night City Datafort",
    theme,
    entryNodeId: entry.id,
    nodes: [entry],
    edges: [],
    participants: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString()
  };
}
export function validateArchitecture(input) {
  const data = typeof input === "string" ? JSON.parse(input) : input;
  assert(data && typeof data === "object" && data.module === ID, "Not a NET Architect JSON file (module identifier missing).");
  assert(data.schemaVersion === VERSION, `Unsupported schema version ${data.schemaVersion}. Supported: ${VERSION}.`);
  assert(validId(data.id), "Architecture ID is invalid.");
  assert(Array.isArray(data.nodes) && data.nodes.length > 0 && data.nodes.length <= 200, "Architecture must contain 1–200 nodes.");
  assert(Array.isArray(data.edges) && data.edges.length <= 500, "Architecture may contain at most 500 edges.");
  const ids = new Set();
  const nodes = data.nodes.map(n => {
    assert(n && validId(n.id) && !ids.has(n.id), "Missing, duplicate, or invalid node ID.");
    ids.add(n.id);
    const c = n.challenge ?? {};
    assert(!c.enabled || ABILITIES.includes(c.action), `Unsupported Interface action on ${n.id}.`);
    const attachments = n.attachments ?? [];
    assert(Array.isArray(attachments) && attachments.length <= 30, "Maximum 30 attachments per node.");
    const controls = n.controls ?? [];
    assert(Array.isArray(controls) && controls.length <= 30, "Maximum 30 controls per node.");
    const attachmentIds = new Set(),
      controlIds = new Set();
    return {
      ...makeNode(),
      id: n.id,
      type: str(n.type, 40) || "custom",
      name: str(n.name, 160) || "Node",
      x: num(n.x, -10000, 10000),
      y: num(n.y, -10000, 10000),
      depth: n.depth == null ? null : num(n.depth, 0, 200),
      icon: str(n.icon, 8) || "◈",
      color: /^#[0-9a-f]{6}$/i.test(n.color) ? n.color : "",
      notes: str(n.notes),
      gmNotes: str(n.gmNotes),
      alwaysVisible: n.alwaysVisible === true,
      bypassAllowed: n.bypassAllowed === true,
      challenge: {
        enabled: !!c.enabled,
        action: ABILITIES.includes(c.action) ? c.action : "pathfinder",
        dv: num(c.dv, 0, 99, 8),
        revealOnSuccess: c.revealOnSuccess !== false,
        allowRetry: c.allowRetry !== false,
        blocksOnFailure: c.blocksOnFailure !== false,
        activateIceOnFailure: !!c.activateIceOnFailure,
        autoResolve: !!c.autoResolve,
        requireApproval: !!c.requireApproval
      },
      attachments: attachments.map(a => {
        assert(validId(a.id) && !attachmentIds.has(a.id) && typeof a.uuid === "string" && a.uuid.length < 300, "Invalid attachment ID/UUID.");
        attachmentIds.add(a.id);
        return {
          id: a.id,
          uuid: str(a.uuid, 300),
          visible: a.visible === true,
          ...(a.iceConfig ? { iceConfig: normalizeIceConfig(a.iceConfig) } : {})
        };
      }),
      controls: controls.map(a => {
        assert(validId(a.id) && !controlIds.has(a.id) && CONTROL_TYPES[a.documentType]?.includes(a.action) && typeof a.uuid === "string" && a.uuid.length < 300, "Invalid control ID, document type, action, or UUID.");
        controlIds.add(a.id);
        return {
          id: a.id,
          label: str(a.label, 100) || a.action,
          uuid: str(a.uuid, 300),
          documentType: a.documentType,
          action: a.action,
          approved: a.approved === true
        };
      })
    };
  });
  assert(ids.has(data.entryNodeId), "Entry node does not exist.");
  assert(!data.participants || Array.isArray(data.participants) && data.participants.length <= 100, "Maximum 100 NPCs per architecture.");
  const participantIds = new Set();
  const participants = (data.participants ?? []).map(p => {
    assert(p && validId(p.id) && !participantIds.has(p.id) && ids.has(p.nodeId) && typeof p.actorUuid === "string" && p.actorUuid.length < 300, "Invalid NPC placement.");
    participantIds.add(p.id);
    return { id: p.id, actorUuid: p.actorUuid, nodeId: p.nodeId, visible: p.visible !== false,
      name: str(p.name, 160) || "Linked Actor", kind: p.kind === "demon" ? "demon" : "netrunner" };
  });
  const edgeIds = new Set(),
    pairs = new Set();
  const edges = data.edges.map(e => {
    assert(e && validId(e.id) && !edgeIds.has(e.id), "Duplicate or invalid edge ID.");
    edgeIds.add(e.id);
    assert(ids.has(e.from) && ids.has(e.to) && e.from !== e.to, "Edge references missing nodes or itself.");
    const pair = [e.from, e.to].sort().join(":");
    assert(!pairs.has(pair), "Duplicate connection.");
    pairs.add(pair);
    return {
      id: e.id,
      from: e.from,
      to: e.to
    };
  });
  return {
    module: ID,
    schemaVersion: VERSION,
    id: data.id,
    name: str(data.name, 160).trim() || "Night City Datafort",
    theme: data.theme === "2077" ? "2077" : "red",
    entryNodeId: data.entryNodeId,
    nodes,
    edges,
    participants,
    metadata: {
      sourceUuid: str(data.metadata?.sourceUuid, 300),
      sourceFloors: Array.isArray(data.metadata?.sourceFloors) ? data.metadata.sourceFloors.slice(0, 200).map(f => ({
        index: num(f.index, 0, 999),
        floor: str(f.floor, 8),
        branch: str(f.branch, 1),
        content: str(f.content, 150),
        dv: str(f.dv, 8),
        blackice: str(f.blackice, 150),
        description: str(f.description)
      })) : []
    },
    createdAt: str(data.createdAt, 40) || new Date().toISOString(),
    modifiedAt: new Date().toISOString()
  };
}
export function duplicateArchitecture(data) {
  const result = validateArchitecture(clone(data)),
    map = new Map(result.nodes.map(n => [n.id, uid()]));
  result.id = uid();
  result.name += " (Copy)";
  result.entryNodeId = map.get(result.entryNodeId);
  result.participants = result.participants.map(p => ({ ...p, id: uid(), nodeId: map.get(p.nodeId) }));
  for (const n of result.nodes) {
    n.id = map.get(n.id);
    n.attachments.forEach(a => a.id = uid());
    n.controls.forEach(a => a.id = uid());
  }
  result.edges = result.edges.map(e => ({
    id: uid(),
    from: map.get(e.from),
    to: map.get(e.to)
  }));
  return result;
}
export function importedArchitecture(data) {
  const a = validateArchitecture(data);
  a.id = uid();
  // Approval is local to the GM's world. Import can never authorize Macro execution.
  a.nodes.forEach(n => n.controls.forEach(c => c.approved = false));
  return a;
}
export function downloadArchitecture(data) {
  const a = validateArchitecture(data);
  saveDataToFile(JSON.stringify(a, null, 2), "application/json", `net-architecture-${a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`);
}
