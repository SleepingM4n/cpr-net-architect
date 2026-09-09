import test from "node:test";
import assert from "node:assert/strict";
import { SocketService } from "../scripts/services/socket-service.js";
import { uid, ID } from "../scripts/constants.js";
import { registerSettings } from "../scripts/settings.js";

test("HTTP toggle is GM/world scoped, defaults off, and requests a reload", () => {
  const settings = new Map();
  globalThis.game = { settings: { register: (_id, key, config) => settings.set(key, config) } };
  registerSettings();
  const config = settings.get("httpCompatibility");
  assert.equal(config.default, false);
  assert.equal(config.scope, "world");
  assert.equal(config.restricted, true);
  assert.equal(config.requiresReload, true);
});

test("HTTP mode works without subtle/randomUUID and rejects tampering, replay, wrong modes and weak keys", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const nativeCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues: nativeCrypto.getRandomValues.bind(nativeCrypto) } });
  try {
    let enabled = false;
    const users = ["gm", "runner", "observer"].map(id => ({ id, isGM: id === "gm", active: true, flags: {}, getFlag(_id, key) { return this.flags[key]; }, async setFlag(_id, key, value) { this.flags[key] = value; } }));
    users.get = id => users.find(u => u.id === id);
    const packets = [];
    globalThis.game = { users, user: users[0], settings: { get: (_id, key) => key === "httpCompatibility" && enabled }, socket: { on() {}, emit(_channel, packet) { packets.push(packet); } } };
    await assert.rejects(new SocketService().initialize(() => {}, () => {}), /HTTP compatibility/);
    enabled = true;
    let received, requestUser;
    const services = {};
    for (const user of users) {
      game.user = user;
      const service = new SocketService();
      await service.initialize(async (sender, request) => { requestUser = sender.id; return { answer: request.question }; }, async state => { received = state; });
      services[user.id] = service;
      assert.deepEqual(Object.keys(user.flags.transportKey).sort(), ["protocol", "publicKey"]);
    }
    const ids = new Set(Array.from({ length: 100 }, uid));
    assert.equal(ids.size, 100);
    assert.ok([...ids].every(id => /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/.test(id)));
    game.user = users[0];
    await services.gm.send("runner", { kind: "state", state: { secret: "HIDDEN GM CONTENT" } });
    const packet = packets.pop();
    assert.ok(!JSON.stringify(packet).includes("HIDDEN GM CONTENT"));
    assert.equal(Buffer.from(packet.iv, "base64").length, 24);
    game.user = users[1];
    for (const change of [{ id: uid() }, { time: packet.time + 1 }, { from: "observer" }, { iv: Buffer.alloc(24).toString("base64") }, { data: Buffer.alloc(100).toString("base64") }]) {
      await assert.rejects(services.runner.receive({ ...packet, ...change }));
    }
    await services.runner.receive(packet);
    assert.equal(received.secret, "HIDDEN GM CONTENT");
    await assert.rejects(services.runner.receive(packet), /Replay/);
    game.user = users[2];
    await assert.rejects(services.observer.receive({ ...packet, to: "observer" }));
    game.user = users[1];
    const reply = services.runner.request({ question: "OK" });
    // send() awaits peer-key derivation before emitting the request packet.
    await new Promise(resolve => setImmediate(resolve));
    game.user = users[0];
    await services.gm.receive(packets.shift());
    assert.equal(requestUser, "runner");
    game.user = users[1];
    await services.runner.receive(packets.shift());
    assert.deepEqual(await reply, { answer: "OK" });
    users[0].flags.transportKey = { kty: "EC" };
    await assert.rejects(services.runner.key("gm"), /Reload/);
    users[0].flags.transportKey = { protocol: "nacl-box-v1", publicKey: Buffer.alloc(32).toString("base64") };
    await assert.rejects(services.runner.key("gm"), /Invalid peer/);
    // Key rotation after a reload invalidates the cached shared key.
    game.user = users[0];
    const freshGM = new SocketService();
    await freshGM.initialize(() => {}, () => {});
    await freshGM.send("runner", { kind: "state", state: "reconnected" });
    game.user = users[1];
    await services.runner.receive(packets.shift());
    assert.equal(received, "reconnected");
  } finally {
    Object.defineProperty(globalThis, "crypto", descriptor);
  }
});
