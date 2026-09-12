import test from "node:test";
import assert from "node:assert/strict";
import { makeArchitecture, makeNode, validateArchitecture, duplicateArchitecture, importedArchitecture } from "../scripts/services/import-export-service.js";
import { getVisibleSessionStateForUser, canRun } from "../scripts/services/permission-service.js";
import { autoLayout, reachable } from "../scripts/graph/graph-layout.js";
import { ControlNodeService } from "../scripts/services/control-node-service.js";
import { SessionService } from "../scripts/services/session-service.js";
import { CPRSystemAdapter } from "../scripts/services/cpr-system-adapter.js";
function architecture() {
  const a = makeArchitecture("Kiroshi Warehouse");
  for (const type of ["password", "blackice", "control", "file"]) {
    const n = makeNode(type);
    a.nodes.push(n);
  }
  a.edges = [{
    id: "edge1",
    from: a.nodes[0].id,
    to: a.nodes[1].id
  }, {
    id: "edge2",
    from: a.nodes[1].id,
    to: a.nodes[2].id
  }, {
    id: "edge3",
    from: a.nodes[1].id,
    to: a.nodes[3].id
  }, {
    id: "edge4",
    from: a.nodes[3].id,
    to: a.nodes[4].id
  }];
  a.nodes[1].name = "TOP SECRET PASSWORD";
  a.nodes[1].gmNotes = "GM SECRET";
  a.nodes[1].attachments = [{
    id: "attachment1",
    uuid: "Actor.secretIce",
    visible: false
  }];
  return autoLayout(a);
}
const gm = {
    id: "gm",
    isGM: true,
    active: true
  },
  runner = {
    id: "runner",
    isGM: false,
    active: true
  },
  observer = {
    id: "observer",
    isGM: false,
    active: true
  },
  outsider = {
    id: "outsider",
    isGM: false,
    active: true
  };
function session() {
  const a = architecture();
  return {
    id: "run1",
    revision: 1,
    status: "active",
    architecture: a,
    architectureId: a.id,
    runner: {
      userId: runner.id,
      actorUuid: "Actor.runner",
      profile: {
        name: "Ghost",
        rank: 7,
        programs: [],
        decks: []
      }
    },
    observers: [observer.id],
    currentNodeId: a.entryNodeId,
    previousNodeId: null,
    discoveredNodeIds: [a.entryNodeId],
    clearedNodeIds: [a.entryNodeId],
    failedNodeIds: [],
    compromisedNodeIds: [],
    iceStates: {},
    actions: {
      used: 0,
      max: 3
    },
    combat: null,
    event: null,
    log: []
  };
}
function globals() {
  const users = [gm, runner, observer, outsider];
  users.get = id => users.find(u => u.id === id);
  users.has = id => !!users.get(id);
  globalThis.game = {
    user: gm,
    users,
    settings: {
      get: (_id, key) => ({
        chatLevel: "none",
        automation: true,
        allowObservers: true
      })[key]
    },
    combat: null
  };
  globalThis.Hooks = {
    callAll() {}
  };
  globalThis.ChatMessage = {
    create: async () => {}
  };
  globalThis.Dialog = {
    confirm: async () => true
  };
}
function service(s = session(), success = true) {
  globals();
  const actor = {
    uuid: "Actor.runner",
    testUserPermission: () => true
  };
  globalThis.fromUuid = async uuid => uuid === actor.uuid ? actor : null;
  const store = {
      saveSession: async () => {},
      saveLog: async () => {}
    },
    adapter = {
      qualifies: () => true,
      profile: () => s.runner.profile,
      resolve: async () => actor,
      rollInterface: async () => ({
        success,
        total: success ? 14 : 2
      }),
      shareRevealedRoll: async () => {},
      isIce: () => false
    };
  const socket = {
    state: async () => {}
  };
  const service = new SessionService(store, adapter, socket, new ControlNodeService());
  service.session = s;
  return service;
}
const request = (s, action, nodeId, extra = {}) => ({
  sessionId: s.id,
  revision: s.revision,
  action,
  nodeId,
  ...extra
});

function combatFixture() {
  const s = session(), svc = service(s), node = s.architecture.nodes[1];
  const actor = { uuid: s.runner.actorUuid, name: "Ghost", testUserPermission: () => true,
    system: { derivedStats: { hp: { value: 35, max: 35 } } }, items: new Map(), receipts: [],
    getFlag() { return this.receipts; }, async update(data) {
      this.system.derivedStats.hp.value = data["system.derivedStats.hp.value"];
      this.receipts = data["flags.cpr-net-architect.netDamageReceipts"];
    } };
  const source = { uuid: "Actor.secretIce", name: "Sentinel", type: "blackIce", documentName: "Actor",
    system: { stats: { per: 4, spd: 6, atk: 7, def: 5, rez: { value: 15, max: 20 } } }, items: [] };
  const program = { uuid: "Item.iceProgram", name: "ICE attack", type: "program", documentName: "Item",
    system: { class: "blackice", atk: 3, def: 2, spd: 4, per: 5, damage: { standard: "2d6", blackIce: "3d6" } },
    toObject() { return { name: this.name, system: structuredClone(this.system) }; } };
  const docs = new Map([[actor.uuid, actor], [source.uuid, source], [program.uuid, program]]);
  globalThis.fromUuid = async uuid => docs.get(uuid) ?? null;
  svc.adapter.isIce = new CPRSystemAdapter().isIce;
  svc.adapter.resolve = async uuid => docs.get(uuid);
  svc.adapter.encounterRoll = async () => ({ total: 12 });
  svc.adapter.deck = () => ({ getInstalledItems: () => [...actor.items.values()] });
  node.attachments.push({ id: "damageProgram", uuid: program.uuid, visible: false });
  s.currentNodeId = node.id;
  s.discoveredNodeIds.push(node.id);
  const send = (user, action, extra = {}) => svc.handle(user, request(s, action, node.id, extra));
  return { s, svc, node, actor, source, program, docs, send };
}

test("distant markers reveal only their identity and current incident connections", async () => {
  const s = session(), svc = service(s), n = s.architecture.nodes[4];
  n.alwaysVisible = true; n.notes = "private until discovered"; n.attachments = [{ id: "secret", uuid: "Item.secret", visible: true }];
  const view = await svc.projection(runner), marker = view.architecture.nodes.find(x => x.id === n.id);
  assert.equal(marker.name, n.name); assert.equal(marker.remote, true);
  assert.equal(marker.challenge, undefined); assert.equal(marker.notes, undefined); assert.deepEqual(marker.attachments, []);
  assert.ok(!view.architecture.edges.some(e => e.to === n.id));
  s.currentNodeId = s.architecture.nodes[3].id;
  s.discoveredNodeIds.push(s.currentNodeId, n.id);
  assert.ok(getVisibleSessionStateForUser(s, runner).architecture.edges.some(e => e.to === n.id));
  s.currentNodeId = s.architecture.entryNodeId;
  assert.ok(!getVisibleSessionStateForUser(s, runner).architecture.edges.some(e => e.to === n.id));
  n.bypassAllowed = true;
  n.attachments[0].iceConfig = { name: "Custom", stats: { atk: 9 }, programUuids: ["Item.attack"] };
  const roundtrip = validateArchitecture(s.architecture).nodes.find(x => x.id === n.id);
  assert.equal(roundtrip.alwaysVisible, true); assert.equal(roundtrip.bypassAllowed, true);
  assert.equal(roundtrip.attachments[0].iceConfig.stats.atk, 9);
});

test("GM bypass permits travel without clearing or granting rewards and controls", async () => {
  const s = session(), svc = service(s), node = s.architecture.nodes[1], next = s.architecture.nodes[2];
  await assert.rejects(svc.handle(runner, request(s, "bypass", node.id)), /GM only/);
  await svc.handle(gm, request(s, "bypass", node.id));
  await svc.handle(runner, request(s, "move", node.id));
  assert.equal(s.currentNodeId, node.id); assert.ok(!s.clearedNodeIds.includes(node.id));
  await assert.rejects(svc.handle(runner, request(s, "takeItem", node.id, { attachmentId: "attachment1" })), /cleared node/);
  await assert.rejects(svc.handle(runner, request(s, "control", node.id)), /cleared/);
  await svc.handle(gm, request(s, "bypass", next.id));
  await svc.handle(runner, request(s, "move", next.id));
  assert.equal(s.currentNodeId, next.id);
  await svc.handle(gm, request(s, "bypass", node.id));
  await assert.rejects(svc.handle(runner, request(s, "move", node.id)), /Resolve the challenge/);
});

test("ICE snapshots copy Programs, avoid paired duplicates, and edits never change source documents", async () => {
  const { s, svc, node, source, program, send } = combatFixture();
  node.attachments[0].iceConfig = { name: "Custom sentinel", stats: { atk: 9, rezMax: 30 } };
  await svc.rezNode(node);
  assert.deepEqual(Object.keys(s.iceStates), ["attachment1"]);
  const ice = s.iceStates.attachment1;
  assert.equal(ice.stats.atk, 9); assert.equal(ice.rez.max, 30); assert.equal(ice.programs.length, 1);
  ice.programs[0].system.atk = 99;
  assert.equal(program.system.atk, 3);
  await send(gm, "editIce", { iceId: "attachment1", config: { stats: { atk: 12, rezMax: 40 } }, rez: 36 });
  assert.equal(source.system.stats.atk, 7); assert.equal(source.system.stats.rez.max, 20);
  assert.equal(ice.rez.value, 36); assert.equal(ice.stats.atk, 12);
  const before = structuredClone(ice);
  await assert.rejects(send(gm, "editIce", { iceId: "attachment1", config: { name: "bad", stats: { atk: 99 } }, rez: 100 }), /Current REZ/);
  assert.deepEqual(ice, before);
  await assert.rejects(send(runner, "editIce", { iceId: "attachment1" }), /GM only/);
  await send(gm, "ice", { attachmentId: "attachment1", operation: "derez" });
  assert.equal(ice.rezzed, false);
  await send(gm, "ice", { attachmentId: "attachment1", operation: "rez" });
  assert.equal(ice.stats.atk, 12);
});

test("targeting and movement enforce visibility, co-location, edges and GM ownership", async () => {
  const { s, svc, node, send } = combatFixture(); await svc.rezNode(node);
  const ice = s.iceStates.attachment1;
  ice.visible = false;
  await assert.rejects(send(runner, "targetIce", { iceId: "attachment1" }), /not visible/);
  ice.visible = true;
  await send(runner, "targetIce", { iceId: "attachment1" });
  await send(gm, "iceTarget", { iceId: "attachment1" });
  assert.equal(ice.target.kind, "runner");
  await assert.rejects(send(observer, "targetIce", { iceId: "attachment1" }), /Observers/);
  await assert.rejects(send(runner, "moveIce", { iceId: "attachment1", destinationId: s.architecture.entryNodeId }), /GM only/);
  await assert.rejects(send(gm, "moveIce", { iceId: "attachment1", destinationId: s.architecture.nodes[4].id }), /connected edge/);
  await send(gm, "moveIce", { iceId: "attachment1", destinationId: s.architecture.entryNodeId });
  assert.equal(ice.target, null); assert.equal(s.runnerTargetId, null);
  await assert.rejects(send(runner, "targetIce", { iceId: "attachment1" }), /same node/);
  assert.equal(Object.keys(s.iceStates).length, 1);
  await svc.rezNode(node);
  assert.equal(ice.nodeId, s.architecture.entryNodeId);
});

test("combat grants roll on the player client and bind the server-selected target", async () => {
  const { s, svc, node, send } = combatFixture(); await svc.rezNode(node);
  await send(runner, "targetIce", { iceId: "attachment1" });
  svc.adapter.rollInterface = () => { throw new Error("GM must not roll"); };
  const { rollGrant } = await send(runner, "runnerCombatRoll", { operation: "zapDamage", combatTarget: { kind: "runner" } });
  assert.equal(rollGrant.ability, "zap"); assert.equal(rollGrant.executionType, "damage");
  assert.equal(rollGrant.targetName, "Sentinel");
  game.messages = new Map([["combat", { author: runner, getFlag: () => ({ token: rollGrant.token, actorUuid: s.runner.actorUuid, total: 6 }) }]]);
  await svc.handle(runner, { action: "completeRoll", sessionId: s.id, token: rollGrant.token, messageId: "combat" });
  const entry = s.netCombat[0];
  assert.equal(entry.target.kind, "ice"); assert.equal(entry.target.id, "attachment1"); assert.equal(entry.total, 6);
  assert.equal(s.iceStates.attachment1.rez.value, 20);
  await assert.rejects(send(runner, "applyNetDamage", { rollId: entry.id, amount: 6 }), /GM only/);
  await send(gm, "applyNetDamage", { rollId: entry.id, amount: 4 });
  assert.equal(s.iceStates.attachment1.rez.value, 16);
  await assert.rejects(send(gm, "applyNetDamage", { rollId: entry.id, amount: 4 }), /unapplied/);
});

test("GM-confirmed damage updates native HP/Program REZ once, never original ICE", async () => {
  const { s, svc, node, actor, source, send } = combatFixture(); await svc.rezNode(node);
  await send(gm, "iceTarget", { iceId: "attachment1" });
  await send(gm, "encounterRoll", { iceId: "attachment1", operation: "atk" });
  await send(gm, "confirmHit", { rollId: s.netCombat[0].id, result: "miss" });
  assert.equal(s.netCombat[0].status, "miss"); assert.equal(actor.system.derivedStats.hp.value, 35);
  await send(gm, "encounterRoll", { iceId: "attachment1", operation: "damage" });
  const entry = s.netCombat.at(-1);
  await send(gm, "applyNetDamage", { rollId: entry.id, amount: 8 });
  assert.equal(actor.system.derivedStats.hp.value, 27);
  entry.status = "rolled"; // persisted-document receipt survives a failed session save
  await send(gm, "applyNetDamage", { rollId: entry.id, amount: 8 });
  assert.equal(actor.system.derivedStats.hp.value, 27);
  const program = { id: "defender", name: "Shield", system: { isRezzed: true, rez: { value: 5 } }, getFlag: () => [],
    async update(data) { this.system.rez.value = data["system.rez.value"]; this.system.isRezzed = data["system.isRezzed"]; } };
  actor.items.set(program.id, program);
  await send(gm, "iceTarget", { iceId: "attachment1", programId: program.id });
  await send(gm, "encounterRoll", { iceId: "attachment1", operation: "damage" });
  await send(gm, "applyNetDamage", { rollId: s.netCombat.at(-1).id, amount: 8 });
  assert.equal(program.system.rez.value, 0); assert.equal(program.system.isRezzed, false);
  assert.equal(source.system.stats.rez.value, 15);
});

test("player combat projection exposes usable targets without private stats, Programs or hidden logs", async () => {
  const { s, svc, node } = combatFixture(); await svc.rezNode(node);
  svc.netCombat.record("atk", { kind: "ice", id: "attachment1", name: "Sentinel" }, { kind: "runner", name: "Ghost" }, { total: 17 });
  svc.netCombat.record("atk", { kind: "ice", id: "secret", name: "Hidden attacker" }, null, { total: 20 }, true);
  const view = await svc.projection(runner);
  assert.equal(view.iceStates.attachment1.visible, true); assert.equal(view.iceStates.attachment1.rez.max, 20);
  assert.equal(view.iceStates.attachment1.stats, undefined); assert.equal(view.iceStates.attachment1.programs, undefined);
  const text = JSON.stringify(view);
  assert.ok(!text.includes("Actor.secretIce")); assert.ok(!text.includes("Item.iceProgram")); assert.ok(!text.includes("Hidden attacker"));
  assert.equal(view.netCombat.length, 1);
});

test("legacy ICE restores snapshots and missing documents do not block restoring the run", async () => {
  const { s, svc, node, docs } = combatFixture();
  s.iceStates.attachment1 = { nodeId: node.id, visible: true, rezzed: false, defeated: true };
  await svc.netCombat.hydrateLegacy();
  assert.equal(s.iceStates.attachment1.stats.atk, 7); assert.equal(s.iceStates.attachment1.defeated, true);
  s.iceStates.attachment1 = { nodeId: node.id, visible: true, rezzed: true };
  docs.delete("Actor.secretIce");
  await svc.netCombat.hydrateLegacy();
  assert.equal(s.iceStates.attachment1.rezzed, false); assert.ok(s.iceStates.attachment1.unavailable);
});
async function playerAttempt(svc, node, total) {
  const s = svc.session;
  const { rollGrant } = await svc.handle(runner, request(s, "attempt", node.id));
  assert.ok(rollGrant.token);
  assert.ok(!("dv" in rollGrant));
  game.messages = new Map([["roll1", { author: runner, getFlag: () => ({ token: rollGrant.token, actorUuid: s.runner.actorUuid, total }) }]]);
  await svc.handle(runner, { action: "completeRoll", sessionId: s.id, token: rollGrant.token, messageId: "roll1" });
}
test("player grants require a matching authored chat card, survive profile revisions, and cannot replay", async () => {
  const s = session(), svc = service(s), node = s.architecture.nodes[1];
  svc.adapter.rollInterface = () => { throw new Error("GM must not roll"); };
  const { rollGrant } = await svc.handle(runner, request(s, "attempt", node.id));
  assert.equal(s.actions.used, 0);
  const completion = { action: "completeRoll", sessionId: s.id, token: rollGrant.token, messageId: "card" };
  game.messages = new Map([["card", { author: outsider, getFlag: () => ({ token: rollGrant.token, actorUuid: s.runner.actorUuid, total: 20 }) }]]);
  await assert.rejects(svc.handle(runner, completion), /Matching player chat/);
  game.messages.get("card").author = runner;
  s.revision++;
  await svc.handle(runner, completion);
  assert.ok(s.clearedNodeIds.includes(node.id));
  assert.equal(s.actions.used, 1);
  await assert.rejects(svc.handle(runner, completion), /No matching/);
});
test("cancelled and moved-away player rolls cannot change node outcomes", async () => {
  const s = session(), svc = service(s), node = s.architecture.nodes[1];
  const { rollGrant } = await svc.handle(runner, request(s, "attempt", node.id));
  s.currentNodeId = node.id;
  await assert.rejects(svc.handle(runner, { action: "completeRoll", sessionId: s.id, token: rollGrant.token }), /position\/deck changed/);
  await svc.handle(runner, { action: "cancelRoll", sessionId: s.id, token: rollGrant.token });
  assert.equal(s.actions.used, 0);
  assert.ok(!s.clearedNodeIds.includes(node.id));
});
test("item pickup copies to actor once, preserves container schema, and enforces shared cleared position", async () => {
  const s = session(), svc = service(s), node = s.architecture.nodes[1];
  const actor = await fromUuid(s.runner.actorUuid);
  actor.items = [];
  let added;
  actor.createEmbeddedDocuments = async (type, data, options) => {
    assert.equal(type, "Item");
    assert.equal(options.CPRsplitStack, true);
    added = data[0];
    actor.items.push({ getFlag: () => added.flags["cpr-net-architect"].lootClaim });
    return actor.items;
  };
  const source = { _id: "original", name: "Cyberdeck", type: "cyberdeck", system: { installedItems: { list: ["old-program"], slots: 7 }, isRezzed: true }, flags: {} };
  const item = { documentName: "Item", testUserPermission: () => true, toObject: () => structuredClone(source) };
  globalThis.fromUuid = async uuid => uuid === actor.uuid ? actor : item;
  const take = () => svc.handle(runner, request(s, "takeItem", node.id, { attachmentId: "attachment1" }));
  await assert.rejects(take(), /cleared node/);
  s.currentNodeId = node.id;
  s.discoveredNodeIds.push(node.id);
  s.clearedNodeIds.push(node.id);
  await assert.rejects(take(), /not shared/);
  node.attachments[0].visible = true;
  await take();
  assert.equal(added._id, undefined);
  assert.deepEqual(added.system.installedItems, { list: [], slots: 7 });
  assert.equal(added.system.isRezzed, false);
  assert.deepEqual(source.system.installedItems.list, ["old-program"]);
  await assert.rejects(take(), /already been taken/);
  assert.equal(actor.items.length, 1);
});
test("schema roundtrip, UUID identity and branched topology survive", () => {
  const a = architecture(),
    b = validateArchitecture(JSON.stringify(a));
  assert.deepEqual(b.nodes.map(n => n.id), a.nodes.map(n => n.id));
  assert.equal(reachable(b, b.entryNodeId).size, 5);
});
test("schema rejects missing entry, duplicate IDs, future versions, malformed edges", () => {
  for (const change of [a => a.entryNodeId = "missing", a => a.nodes.push(a.nodes[0]), a => a.schemaVersion = 999, a => a.edges[0].to = "missing", a => a.edges.push(a.edges[0]), a => a.nodes[0].id = "__proto__"]) {
    const a = architecture();
    change(a);
    assert.throws(() => validateArchitecture(a));
  }
});
test("import strips executable fields and resets all Macro approvals", () => {
  const a = architecture();
  a.nodes[0].controls = [{
    id: "macro1",
    uuid: "Macro.test",
    documentType: "Macro",
    action: "execute",
    label: "Alarm",
    approved: true,
    command: "alert('bad')"
  }];
  a.script = "bad";
  const result = importedArchitecture(a);
  assert.equal(result.nodes[0].controls[0].approved, false);
  assert.ok(!JSON.stringify(result).includes("alert"));
  assert.ok(!("script" in result));
  assert.notEqual(result.id, a.id);
});
test("duplicate remaps node/edge IDs and preserves connectivity", () => {
  const a = architecture(),
    b = duplicateArchitecture(a);
  assert.notEqual(a.id, b.id);
  assert.ok(b.nodes.every(n => !a.nodes.some(x => x.id === n.id)));
  assert.equal(reachable(b, b.entryNodeId).size, 5);
});
test("frontier projection never contains secret name, DV, type, notes, attachments or deeper graph", () => {
  const s = session(),
    view = getVisibleSessionStateForUser(s, runner),
    serialized = JSON.stringify(view);
  assert.equal(view.architecture.nodes.length, 2);
  const unknown = view.architecture.nodes.find(n => n.unknown);
  assert.deepEqual(Object.keys(unknown).sort(), ["id", "unknown", "x", "y"]);
  for (const secret of ["TOP SECRET", "GM SECRET", "Actor.secretIce", '"type":"blackice"', '"type":"control"']) assert.ok(!serialized.includes(secret), `Leaked ${secret}`);
});
test("GM full view, observer identical graph, nonparticipant receives null", () => {
  const s = session();
  assert.equal(getVisibleSessionStateForUser(s, gm).architecture.nodes.length, 5);
  assert.deepEqual(getVisibleSessionStateForUser(s, observer).architecture, getVisibleSessionStateForUser(s, runner).architecture);
  assert.equal(getVisibleSessionStateForUser(s, outsider), null);
  assert.equal(canRun(s, observer), false);
});
test("discovered node still strips GM notes and all unresolved document attachments", () => {
  const s = session();
  s.discoveredNodeIds.push(s.architecture.nodes[1].id);
  const n = getVisibleSessionStateForUser(s, runner).architecture.nodes[1];
  assert.equal(n.name, "TOP SECRET PASSWORD");
  assert.ok(!("gmNotes" in n));
  assert.deepEqual(n.attachments, []);
});
test("success clears and reveals without moving physical or virtual runner automatically", async () => {
  const s = session(),
    svc = service(s),
    node = s.architecture.nodes[1];
  await playerAttempt(svc, node, 14);
  assert.ok(s.clearedNodeIds.includes(node.id));
  assert.ok(s.discoveredNodeIds.includes(node.id));
  assert.equal(s.currentNodeId, s.architecture.entryNodeId);
  assert.equal(s.actions.used, 1);
});
test("failure remains hidden and blocks movement", async () => {
  const s = session(),
    svc = service(s, false),
    node = s.architecture.nodes[1];
  await playerAttempt(svc, node, 2);
  assert.ok(s.failedNodeIds.includes(node.id));
  assert.ok(!s.discoveredNodeIds.includes(node.id));
  await assert.rejects(svc.handle(runner, request(s, "move", node.id)), /Resolve the challenge/);
});
test("non-adjacent movement and forged GM reveal rejected", async () => {
  const s = session(),
    svc = service(s);
  await assert.rejects(svc.handle(runner, request(s, "move", s.architecture.nodes[4].id)), /not adjacent/);
  await assert.rejects(svc.handle(runner, request(s, "revealAll", s.currentNodeId)), /GM only/);
});
test("observer cannot roll, move, reveal, control, end or reset session", async () => {
  const s = session(),
    svc = service(s);
  for (const action of ["attempt", "move", "reveal", "control", "end", "reset"]) await assert.rejects(svc.handle(observer, request(s, action, s.currentNodeId)), /Observers/);
  assert.ok(svc.session);
});
test("stale revisions and wrong session IDs are rejected", async () => {
  const s = session(),
    svc = service(s);
  await assert.rejects(svc.handle(runner, {
    ...request(s, "end"),
    revision: 0
  }), /State changed/);
  await assert.rejects(svc.handle(runner, {
    ...request(s, "end"),
    sessionId: "old"
  }), /ended or changed/);
});
test("retry-disabled challenges cannot be rerolled after failure", async () => {
  const s = session(),
    svc = service(s, false),
    node = s.architecture.nodes[1];
  node.challenge.allowRetry = false;
  await playerAttempt(svc, node, 2);
  await assert.rejects(svc.handle(runner, request(s, "attempt", node.id)), /Retry disabled/);
});
test("Jack In is explicit and observer sync cannot activate it", async () => {
  const s = session(),
    svc = service(s);
  s.status = "login";
  s.discoveredNodeIds = [];
  await svc.handle(observer, {
    action: "sync"
  });
  assert.equal(s.status, "login");
  await svc.handle(runner, request(s, "jackIn"));
  assert.equal(s.status, "active");
  assert.deepEqual(s.discoveredNodeIds, [s.currentNodeId]);
});
test("runner closes session but local observer stop is not a server command", async () => {
  const s = session(),
    svc = service(s);
  await svc.handle(runner, request(s, "end"));
  assert.equal(svc.session, null);
});
test("control service only changes allowlisted Wall property; rejects arbitrary fields", async () => {
  globals();
  const s = session(),
    node = s.architecture.nodes[3];
  s.currentNodeId = node.id;
  s.clearedNodeIds.push(node.id);
  node.controls = [{
    id: "door",
    uuid: "Scene.one.Wall.two",
    documentType: "Wall",
    action: "open",
    label: "Open Door"
  }];
  let update;
  globalThis.fromUuid = async () => ({
    documentName: "Wall",
    door: 1,
    update: async data => update = data
  });
  await new ControlNodeService().execute(s, node, "door");
  assert.deepEqual(update, {
    ds: 1
  });
  await assert.rejects(new ControlNodeService().execute(s, node, "arbitrary"), /not configured/);
});
test("unapproved Macro and uncleared node do not execute", async () => {
  globals();
  let executed = false;
  globalThis.fromUuid = async () => ({
    documentName: "Macro",
    execute: async () => executed = true
  });
  const s = session(),
    node = s.architecture.nodes[3];
  node.controls = [{
    id: "macro",
    uuid: "Macro.test",
    documentType: "Macro",
    action: "execute",
    approved: false
  }];
  await assert.rejects(new ControlNodeService().execute(s, node, "macro"), /cleared/);
  s.currentNodeId = node.id;
  s.clearedNodeIds.push(node.id);
  await assert.rejects(new ControlNodeService().execute(s, node, "macro"), /approve/);
  assert.equal(executed, false);
});
test("deleted scene document gives actionable error", async () => {
  globals();
  globalThis.fromUuid = async () => null;
  const s = session(),
    node = s.architecture.nodes[0];
  node.controls = [{
    id: "tile",
    uuid: "Scene.dead.Tile.dead",
    documentType: "Tile",
    action: "hide"
  }];
  await assert.rejects(new ControlNodeService().execute(s, node, "tile"), /deleted/);
});
test("native capability detection uses configured role ID and rank, never Actor name", () => {
  const adapter = new CPRSystemAdapter();
  const a = {
    type: "character",
    name: "Netrunner Interface 10",
    system: {
      roleInfo: {
        activeNetRole: "role2"
      }
    },
    itemTypes: {
      role: [{
        id: "role1",
        system: {
          rank: 10
        }
      }, {
        id: "role2",
        system: {
          rank: 0
        }
      }]
    }
  };
  assert.equal(adapter.qualifies(a), false);
  a.itemTypes.role[1].system.rank = 4;
  a.name = "Whatever";
  assert.equal(adapter.qualifies(a), true);
  a.system.roleInfo.activeNetRole = "deleted";
  assert.equal(adapter.qualifies(a), false);
});
test("adapter calls native cyberdeck roll factory and uses strict DV success", async () => {
  globals();
  let call;
  const native = {
    resultTotal: 8,
    initialRoll: 4,
    luck: 0,
    handleRollDialog: async () => true,
    roll: async () => {},
    wasCritical: () => false,
    wasCritFail: () => false,
    wasCritSuccess: () => false
  };
  const deck = {
    id: "deck",
    createRoll: (...args) => (call = args, native),
    confirmRoll: r => r
  };
  const role = {
    id: "role",
    system: {
      rank: 4
    }
  };
  const actor = {
    id: "actor",
    type: "character",
    system: {
      roleInfo: {
        activeNetRole: "role"
      }
    },
    itemTypes: {
      role: [role],
      cyberdeck: [deck]
    }
  };
  const result = await new CPRSystemAdapter().rollInterface(actor, {
    ability: "backdoor",
    dv: 8
  });
  assert.equal(call[0], "interfaceAbility");
  assert.equal(call[1], actor);
  assert.equal(call[2].netRoleItem, role);
  assert.equal(result.total, 8);
  assert.equal(result.success, false);
});
test("defeated ICE is not resurrected when revisiting a node", async () => {
  const s = session(),
    svc = service(s),
    node = s.architecture.nodes[1];
  svc.adapter.isIce = () => true;
  globalThis.fromUuid = async () => ({
    name: "ICE"
  });
  s.iceStates.attachment1 = {
    nodeId: node.id,
    rezzed: false,
    defeated: true,
    visible: true
  };
  await svc.rezNode(node);
  assert.equal(s.iceStates.attachment1.rezzed, false);
  assert.equal(s.iceStates.attachment1.defeated, true);
});
test("client-supplied result totals and discovery arrays are ignored", async () => {
  const s = session(),
    svc = service(s, false),
    node = s.architecture.nodes[1];
  await svc.handle(runner, request(s, "attempt", node.id, {
    total: 999,
    success: true,
    discoveredNodeIds: s.architecture.nodes.map(n => n.id)
  }));
  assert.ok(!s.clearedNodeIds.includes(node.id));
  assert.equal(s.discoveredNodeIds.length, 1);
});
test("malformed UUID does not crash a visible session projection", async () => {
  const s = session(),
    svc = service(s),
    node = s.architecture.nodes[1];
  s.discoveredNodeIds.push(node.id);
  node.attachments[0].visible = true;
  globalThis.fromUuid = async () => {
    throw new Error("Invalid UUID");
  };
  const view = await svc.projection(runner);
  assert.deepEqual(view.architecture.nodes.find(n => n.id === node.id).attachments, []);
});
test("automatic resolution cannot bypass a node's GM approval requirement", async () => {
  const s = session(), svc = service(s), node = s.architecture.nodes[1];
  node.challenge.autoResolve = true;
  node.challenge.requireApproval = true;
  await assert.rejects(svc.handle(runner, request(s, "move", node.id)), /Resolve the challenge/);
  globalThis.Dialog.confirm = async () => false;
  await assert.rejects(svc.handle(runner, request(s, "attempt", node.id)), /GM declined/);
  assert.ok(!s.clearedNodeIds.includes(node.id));
});
