import test from "node:test";
import assert from "node:assert/strict";
import { CPRSystemAdapter } from "../scripts/services/cpr-system-adapter.js";
globalThis.Application = class { constructor() {} static get defaultOptions() { return {}; } };
const { NetrunApp } = await import("../scripts/apps/netrun-app.js");
const { NetCombatApp } = await import("../scripts/apps/net-combat-app.js");

test("combat UI offers player targeting and rolls while GM confirmation controls remain exclusive", async () => {
  const view = { status: "active", role: "runner", architecture: { name: "NET", theme: "red", nodes: [{ id: "node", name: "Node", attachments: [] }], edges: [] },
    currentNodeId: "node", runner: { profile: { name: "Ghost", programs: [] } }, iceStates: { ice: { name: "Sentinel", nodeId: "node", rezzed: true, visible: true, rez: { value: 10, max: 20 } } },
    netCombat: [{ id: "roll", source: { name: "Ghost" }, target: { name: "Sentinel" }, kind: "damage", total: 5, status: "rolled" }] };
  const app = new NetCombatApp({ view });
  let html = (await app.getData()).body;
  assert.ok(html.includes("Target ICE")); assert.ok(html.includes("Zap Attack"));
  assert.ok(!html.includes("Edit Encounter")); assert.ok(!html.includes("Confirm / Apply Damage"));
  view.role = "observer";
  html = (await app.getData()).body;
  assert.ok(html.includes("READ ONLY")); assert.ok(!html.includes("Target ICE")); assert.ok(!html.includes("Zap Attack"));
  view.role = "gm";
  html = (await app.getData()).body;
  assert.ok(html.includes("Edit Encounter")); assert.ok(html.includes("Confirm / Apply Damage"));
});

test("encounter rolls use snapshot stats and target-specific CPR damage without spending source LUCK", async () => {
  const adapter = new CPRSystemAdapter();
  class StatRoll { constructor(name, value) { this.statName = name; this.statValue = value; this.rollCardExtraArgs = {}; } setNetCombat(title) { this.rollTitle = title; } }
  class DamageRoll extends StatRoll { constructor(title, formula) { super(title, 0); this.formula = formula; } }
  adapter.rolls = { CPRProgramStatRoll: StatRoll, CPRDamageRoll: DamageRoll };
  globalThis.Roll = { validate: formula => /^\d+d6$/.test(formula) };
  globalThis.fromUuid = async () => null;
  let seen;
  adapter.execute = async (roll, actor, item, options) => { seen = { roll, actor, options }; return { total: 10 }; };
  const actor = {}, ice = { name: "Custom", stats: { atk: 12 }, target: { kind: "runner", name: "Ghost" }, programs: [{ id: "p", name: "Attack", system: { damage: { standard: "2d6", blackIce: "3d6" } } }] };
  await adapter.encounterRoll(ice, "atk", null, actor, {});
  assert.equal(seen.roll.statValue, 12); assert.equal(seen.options.allowLuck, false);
  await adapter.encounterRoll(ice, "damage", null, actor, {});
  assert.equal(seen.roll.formula, "2d6");
  ice.target.kind = "program";
  await adapter.encounterRoll(ice, "damage", null, actor, {});
  assert.equal(seen.roll.formula, "3d6");
  await assert.rejects(adapter.encounterRoll(ice, "atk", "deleted", actor, {}), /no longer exists/);
});

test("player ICE damage reparses CPR formula modifiers and preserves universal effects", async () => {
  const adapter = new CPRSystemAdapter();
  const program = { id: "p", system: { isRezzed: true, damage: { blackIce: "3d6+2" } } };
  const roll = { mods: [{ source: "formula", value: 9 }, { source: "effect", value: 1 }],
    _processFormula(formula) { assert.equal(formula, "3d6+2"); this.mods.push({ source: "formula", value: 2 }); return "3d6"; } };
  const deck = { id: "d", getInstalledItems: () => [program], createRoll: () => roll };
  adapter.deck = () => deck; adapter.role = () => ({}); adapter.execute = async r => r;
  globalThis.game = { i18n: { localize: () => "formula" } }; globalThis.Roll = { validate: () => true };
  await adapter.program({}, "d", "p", "damage", { targetKind: "ice" });
  assert.equal(roll.formula, "3d6"); assert.deepEqual(roll.mods.map(m => m.value), [1, 2]);
});
test("player native roll posts a normal authored CPR card and spends LUCK on that actor", async () => {
  const adapter = new CPRSystemAdapter();
  adapter.nativeChat = { ChatDataSetup: html => ({ content: html, user: "player", rollMode: "roll" }) };
  globalThis.renderTemplate = async () => "<div>Native CPR roll: 14</div>";
  let posted, update, dialog = 0;
  globalThis.ChatMessage = { getSpeaker: ({ actor }) => ({ actor: actor.id }), create: async data => { posted = data; return { id: "chat1" }; } };
  const actor = { id: "a", uuid: "Actor.a", system: { stats: { luck: { value: 4 } } }, update: async data => { update = data; } };
  const roll = { resultTotal: 14, luck: 2, initialRoll: 7, rollCard: "native", handleRollDialog: async () => { dialog++; return true; }, roll: async () => {}, wasCritical: () => false, wasCritSuccess: () => false, wasCritFail: () => false };
  const result = await adapter.execute(roll, actor, null, { playerGrant: { token: "grant" } });
  assert.equal(dialog, 1);
  assert.equal(result.messageId, "chat1");
  assert.equal(posted.user, "player");
  assert.equal(posted.content, "<div>Native CPR roll: 14</div>");
  assert.deepEqual(posted.flags["cpr-net-architect"].playerRoll, { token: "grant", actorUuid: actor.uuid, total: 14 });
  assert.deepEqual(update, { "system.stats.luck.value": 2 });
});
test("runner UI executes authorized rolls locally and submits only the chat reference", async () => {
  const calls = [];
  const runtime = { view: { id: "session", revision: 4 }, socket: { request: async request => { calls.push(request); return request.action === "attempt" ? { rollGrant: { token: "grant", actorUuid: "Actor.a", ability: "backdoor" } } : undefined; } }, adapter: { resolve: async () => ({}), rollInterface: async (_actor, options) => { assert.equal(options.playerGrant.token, "grant"); return { total: 100, messageId: "chat" }; } } };
  const app = new NetrunApp(runtime);
  await app.send("attempt");
  assert.deepEqual(calls[1], { action: "completeRoll", sessionId: "session", token: "grant", messageId: "chat" });
  runtime.adapter.rollInterface = async () => null;
  await app.send("attempt");
  assert.equal(calls.at(-1).action, "cancelRoll");
});
test("inline journal reader enriches allowed pages with secrets disabled and excludes forbidden pages", async () => {
  globalThis.game = { user: { isGM: false } };
  let enrichOptions;
  globalThis.TextEditor = { enrichHTML: async (html, options) => { enrichOptions = options; return html; } };
  const journal = { name: "Manifest", documentName: "JournalEntry", testUserPermission: () => true, pages: [
    { name: "Public", type: "text", sort: 0, text: { content: "Shipment 42" }, testUserPermission: () => true },
    { name: "Secret", type: "text", sort: 1, text: { content: "GM information" }, testUserPermission: () => false }
  ] };
  globalThis.fromUuid = async () => journal;
  const app = new NetrunApp({});
  const html = await app.journalContent("JournalEntry.a");
  assert.ok(html.includes("Shipment 42"));
  assert.ok(!html.includes("GM information"));
  assert.equal(enrichOptions.secrets, false);
  journal.testUserPermission = () => false;
  assert.ok(!(await app.journalContent("JournalEntry.a")).includes("Shipment 42"));
});
