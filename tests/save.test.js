import test from "node:test";
import assert from "node:assert/strict";
import { ArchitectureService } from "../scripts/services/architecture-service.js";
import { makeArchitecture, makeNode } from "../scripts/services/import-export-service.js";
import { ID } from "../scripts/constants.js";
globalThis.Application = class { constructor() {} render() {} };
const { ArchitectureEditor } = await import("../scripts/apps/architecture-editor.js");
function globals() {
  globalThis.game = { user: { isGM: true }, users: [{ isGM: true }] };
  const messages = [];
  globalThis.ui = { notifications: { info: text => messages.push(text), error: text => messages.push(text) } };
  return messages;
}
function storage() {
  globals();
  const initial = makeArchitecture("Initial"), persisted = new Map([["journal", structuredClone(initial)]]);
  let writes = 0, creates = 0, fail = false, drop = false;
  function document(id) {
    return { id, getFlag: () => structuredClone(persisted.get(id)), async setFlag(scope, key, a) {
      assert.equal(scope, ID); assert.equal(key, "architecture"); writes++;
      if (fail) throw Error("Connection lost");
      if (!drop) persisted.set(id, structuredClone(a));
      return document(id);
    } };
  }
  const pack = { locked: false, testUserPermission: () => false,
    getDocuments: async query => [...persisted.keys()].filter(id => !query || query._id__in.includes(id)).map(document),
    getDocument: async id => persisted.has(id) ? document(id) : null };
  const store = new ArchitectureService(); store.pack = pack;
  store.docs = [{ id: "journal", getFlag: () => initial, setFlag: () => { throw Error("Expired document used"); } }];
  globalThis.JournalEntry = { create: async data => { const id = `new${++creates}`; persisted.set(id, structuredClone(data.flags[ID].architecture)); return document(id); } };
  return { store, initial, pack, persisted, get writes() { return writes; }, get creates() { return creates; }, fail: value => fail = value, drop: value => drop = value };
}
test("save reacquires expired compendium documents and verifies persisted edits", async () => {
  const f = storage(), draft = structuredClone(f.initial);
  draft.name = "Changed after cache expiry";
  const saved = await f.store.save(draft);
  assert.equal(saved.name, draft.name); assert.equal(f.persisted.get("journal").name, draft.name);
  assert.equal(f.store.get(draft.id).name, draft.name);
  saved.name = "Caller mutation";
  assert.equal(f.store.get(draft.id).name, draft.name);
});
test("unconfirmed writes fail rather than reporting success; a retry can save", async () => {
  const f = storage(), draft = { ...f.initial, name: "New name" };
  f.drop(true);
  await assert.rejects(f.store.save(draft), /did not confirm/);
  f.drop(false); f.fail(true);
  await assert.rejects(f.store.save(draft), /Connection lost/);
  f.fail(false);
  assert.equal((await f.store.save(draft)).name, "New name");
  f.pack.locked = true;
  await assert.rejects(f.store.save(draft), /locked/);
});
test("overlapping new saves create one document and capture each click's snapshot", async () => {
  const f = storage(), draft = makeArchitecture("First");
  const first = f.store.save(draft);
  draft.name = "Second";
  const second = f.store.save(draft);
  draft.name = "Not submitted";
  assert.equal((await first).name, "First"); assert.equal((await second).name, "Second");
  assert.equal(f.creates, 1); assert.equal(f.store.get(draft.id).name, "Second");
});
test("a failed editor save retains edits, displays failure, and allows retry", async () => {
  const messages = globals(); let failed = true;
  const editor = new ArchitectureEditor({ store: { save: async a => { if (failed) throw Error("Offline"); return structuredClone(a); } } }, makeArchitecture());
  editor.architecture.name = "Keep my work";
  await editor.saveArchitecture();
  assert.equal(editor.architecture.name, "Keep my work"); assert.equal(editor.dirty, true);
  assert.match(editor.saveError, /Offline/); assert.equal(editor.saving, null);
  assert.ok(!messages.some(m => m.includes("saved and verified")));
  failed = false; await editor.saveArchitecture();
  assert.equal(editor.dirty, false); assert.equal(editor.saveError, null);
});
test("slow saves never overwrite newer edits or mark them as saved; double clicks share a request", async () => {
  globals(); let complete, calls = 0;
  const editor = new ArchitectureEditor({ store: { save: a => { calls++; return new Promise(resolve => complete = () => resolve(structuredClone(a))); } } }, makeArchitecture("Before"));
  const first = editor.saveArchitecture(), second = editor.saveArchitecture();
  await Promise.resolve();
  assert.equal(calls, 1);
  editor.architecture.name = "Typed while saving";
  complete(); await Promise.all([first, second]);
  assert.equal(editor.architecture.name, "Typed while saving"); assert.equal(editor.dirty, true);
  editor.runtime.store.save = async a => structuredClone(a);
  await editor.saveArchitecture(); assert.equal(editor.dirty, false);
});
test("a synchronous save error does not leave the editor permanently busy", async () => {
  globals();
  const editor = new ArchitectureEditor({ store: { save: () => { throw Error("Not ready"); } } }, makeArchitecture());
  await editor.saveArchitecture(); assert.equal(editor.saving, null); assert.equal(editor.dirty, true);
});
test("reading an older rendered node form cannot overwrite the newly selected node", () => {
  globals(); const a = makeArchitecture(), other = makeNode(); a.nodes.push(other);
  const editor = new ArchitectureEditor({}, a), originalFormData = globalThis.FormData;
  const original = editor.architecture.nodes[0];
  const values = { name: "Edited original", type: original.type, customType: "", depth: "", icon: "x", color: "#112233", notes: "", gmNotes: "", action: "pathfinder", dv: "8" };
  const elements = Object.fromEntries(["alwaysVisible", "bypassAllowed", "enabled", "revealOnSuccess", "allowRetry", "blocksOnFailure", "activateIceOnFailure", "autoResolve", "requireApproval"].map(k => [k, { checked: false }]));
  globalThis.FormData = class { constructor() { return Object.entries(values); } };
  editor.root = { querySelector: () => ({ dataset: { nodeId: original.id }, elements }) }; editor.selected = other.id;
  try { editor.readNode(); } finally { globalThis.FormData = originalFormData; }
  assert.equal(original.name, "Edited original"); assert.equal(editor.architecture.nodes[1].name, other.name);
  assert.equal(editor.dirty, true);
});
