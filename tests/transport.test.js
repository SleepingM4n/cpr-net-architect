import test from "node:test";
import assert from "node:assert/strict";
import { SocketService } from "../scripts/services/socket-service.js";
import { ID } from "../scripts/constants.js";
test("AES-GCM transport authenticates sender, encrypts state, rejects tampering and replay", async () => {
  const users = ["gm", "runner", "other"].map(id => ({
    id,
    isGM: id === "gm",
    active: true,
    flags: {},
    getFlag: (_scope, key) => users.find(u => u.id === id).flags[key],
    async setFlag(_scope, key, data) {
      this.flags[key] = data;
    }
  }));
  users.get = id => users.find(u => u.id === id);
  const packets = [];
  globalThis.game = {
    users,
    user: users[0],
    socket: {
      on() {},
      emit(_channel, p) {
        packets.push(p);
      }
    },
    settings: {
      get() {
        return false;
      }
    }
  };
  const services = {};
  let state = null;
  for (const user of users) {
    game.user = user;
    const svc = new SocketService();
    await svc.initialize(async () => {}, async value => {
      state = value;
    });
    services[user.id] = svc;
  }
  game.user = users[0];
  await services.gm.send("runner", {
    kind: "state",
    state: {
      id: "session1",
      secret: "SENSITIVE NODE LABEL"
    }
  });
  const packet = packets.pop();
  assert.ok(!JSON.stringify(packet).includes("SENSITIVE NODE LABEL"));
  game.user = users[1];
  await services.runner.receive(packet);
  assert.equal(state.secret, "SENSITIVE NODE LABEL");
  await assert.rejects(services.runner.receive(packet), /Replay/);
  game.user = users[0];
  await services.gm.send("runner", {
    kind: "state",
    state: {
      id: "session2"
    }
  });
  const second = packets.pop();
  game.user = users[1];
  await assert.rejects(services.runner.receive({
    ...second,
    from: "other"
  }));
  await assert.rejects(services.runner.receive({
    ...second,
    data: second.data.slice(0, -5) + "AAAAA"
  }));
  game.user = users[2];
  await assert.rejects(services.other.receive({
    ...second,
    to: "other"
  }));
  game.user = users[1];
  await services.runner.receive(second);
  assert.equal(state.id, "session2");
});
test("transport key flag contains no private key material", async () => {
  let value;
  globalThis.game = {
    user: {
      id: "gm",
      setFlag: async (scope, key, v) => {
        assert.equal(scope, ID);
        value = v;
      }
    },
    socket: {
      on() {}
    }
  };
  await new SocketService().initialize(() => {}, () => {});
  assert.equal(value.kty, "EC");
  assert.ok(value.x && value.y);
  assert.ok(!value.d);
  assert.equal(value.key_ops.length, 0);
});
