import test from "node:test";
import assert from "node:assert/strict";
import { CPRSystemAdapter } from "../scripts/services/cpr-system-adapter.js";
globalThis.Application = class { constructor() {} static get defaultOptions() { return {}; } };
const { NetrunApp } = await import("../scripts/apps/netrun-app.js");
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
