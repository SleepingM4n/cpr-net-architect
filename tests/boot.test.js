import test from "node:test";
import assert from "node:assert/strict";
const hooks = new Map();
globalThis.Hooks = {
  once: (name, fn) => hooks.set(name, [fn]),
  on: (name, fn) => hooks.set(name, [...(hooks.get(name) ?? []), fn]),
  callAll() {}
};
globalThis.Application = class {
  static get defaultOptions() {
    return {};
  }
  constructor(options) {
    this.options = options;
  }
};
globalThis.foundry = {
  utils: {
    mergeObject: (a, b) => ({
      ...a,
      ...b
    }),
    getProperty: () => undefined
  }
};
test("module initializes under v12-shaped API and publishes controls/API without a Scene switch", async () => {
  const settings = new Map();
  const gm = {
    id: "gm",
    isGM: true,
    active: true,
    flags: {},
    async setFlag(_scope, key, value) {
      this.flags[key] = value;
    },
    getFlag(_scope, key) {
      return this.flags[key];
    }
  };
  const users = [gm];
  users.get = id => users.find(u => u.id === id);
  const module = {};
  const pack = {
    docs: [],
    configure: async () => {},
    getDocuments: async () => [],
    testUserPermission: () => false
  };
  globalThis.game = {
    system: {
      id: "cyberpunk-red-core",
      version: "v0.92.4"
    },
    release: {
      generation: 12,
      build: 343
    },
    user: gm,
    users,
    settings: {
      register: (id, key, config) => settings.set(key, config.default),
      get: (id, key) => settings.get(key)
    },
    packs: new Map(),
    modules: new Map([["cpr-net-architect", module]]),
    socket: {
      on() {},
      emit() {}
    },
    world: {
      id: "test"
    }
  };
  globalThis.CompendiumCollection = {
    createCompendium: async data => {
      assert.equal(data.type, "JournalEntry");
      assert.equal(data.ownership.PLAYER, "NONE");
      return pack;
    }
  };
  const errors = [];
  globalThis.ui = {
    notifications: {
      error: e => errors.push(e)
    },
    controls: {
      render() {}
    }
  };
  await import("../scripts/main.js");
  await hooks.get("init")[0]();
  await hooks.get("ready")[0]();
  assert.deepEqual(errors, []);
  assert.equal(typeof module.api.openManager, "function");
  assert.equal(module.api.getActiveSession(), null);
  const controls = [{
    name: "token",
    tools: []
  }];
  hooks.get("getSceneControlButtons")[0](controls);
  assert.equal(controls[0].tools[0].name, "cpr-net-architect");
  assert.ok(settings.has("allowObservers"));
  assert.ok(settings.has("reducedMotion"));
});
