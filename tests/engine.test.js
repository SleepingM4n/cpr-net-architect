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
