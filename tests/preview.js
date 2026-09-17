import { ensureRunners, selectRunner, syncRunner } from "../scripts/services/runner-state.js";
// Browser harness exercises the real module applications, never represents a Foundry runtime certification.
function wrap(nodes) {
  const a = Array.from(nodes);
  a.find = selector => wrap(a.flatMap(n => [...n.querySelectorAll(selector)]));
  a.on = (event, fn) => {
    a.forEach(n => n.addEventListener(event, fn));
    return a;
  };
  return a;
}
globalThis.Application = class {
  static get defaultOptions() {
    return {};
  }
  constructor(options) {
    this.options = options;
    this.position = {
      left: 0,
      top: 0,
      width: 1200,
      height: 760
    };
  }
  render() {
    this.renderPromise = this.getData().then(data => {
      const root = document.getElementById("app");
      root.innerHTML = data.body;
      this.rendered = true;
      this.activateListeners(wrap([root]));
    });
    return this;
  }
  activateListeners() {}
  async close() {
    document.getElementById("app").innerHTML = "<h2>VIEW CLOSED — session remains active</h2>";
    this.rendered = false;
  }
};
globalThis.foundry = {
  utils: {
    mergeObject: (a, b) => ({
      ...a,
      ...b
    })
  }
};
globalThis.ui = {
  notifications: {
    info: console.info,
    warn: console.warn,
    error: console.error
  }
};
globalThis.Hooks = {
  callAll() {}
};
globalThis.Dialog = class {
  static async confirm() {
    return true;
  }
  constructor(data) {
    this.data = data;
  }
  render() {
    const el = document.createElement("div");
    el.className = "neta-dialog-test";
    el.innerHTML = `<h2>${this.data.title}</h2>${this.data.content}`;
    for (const button of Object.values(this.data.buttons)) {
      const b = document.createElement("button");
      b.textContent = button.label;
      b.onclick = () => {
        button.callback?.(wrap([el]));
        this.data.close?.();
        el.remove();
      };
      el.append(b);
    }
    document.body.append(el);
  }
};
globalThis.canvas = {
  walls: {
    controlled: []
  },
  tiles: {
    controlled: []
  },
  tokens: {
    controlled: []
  }
};
const params = new URLSearchParams(location.search),
  mode = params.get("mode") ?? "manager";
const gm = {
    id: "gm",
    isGM: true,
    active: true,
    name: "Game Master"
  },
  runner = {
    id: "runner",
    isGM: false,
    active: true,
    name: "Emanuel"
  },
  observer = {
    id: "observer",
    isGM: false,
    active: true,
    name: "Observer"
  };
const users = [gm, runner, observer];
users.get = id => users.find(u => u.id === id);
users.has = id => !!users.get(id);
const settings = {
  uiScale: 1,
  animations: true,
  intensity: 0.6,
  sounds: false,
  reducedMotion: false,
  defaultTheme: "red",
  rememberPosition: true,
  chatLevel: "none",
  allowObservers: true,
  automation: true
};
globalThis.game = {
  user: ["gm", "editor", "manager"].includes(mode) ? gm : mode === "observer" ? observer : runner,
  users,
  world: {
    id: "preview"
  },
  settings: {
    get: (_id, key) => settings[key]
  },
  actors: [],
  items: [],
  i18n: {
    localize: k => k
  }
};
globalThis.fromUuid = async () => null;
globalThis.TextEditor = {
  getDragEventData: event => JSON.parse(event.dataTransfer.getData("text/plain"))
};
globalThis.saveDataToFile = (text, type, name) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], {
    type
  }));
  a.download = name;
  a.click();
};
const [{
  ArchitectureManager
}, {
  ArchitectureEditor
}, {
  NetrunApp
}, {
  getVisibleSessionStateForUser
}, {
  clone
}] = await Promise.all([import("../scripts/apps/architecture-manager.js"), import("../scripts/apps/architecture-editor.js"), import("../scripts/apps/netrun-app.js"), import("../scripts/services/permission-service.js"), import("../scripts/constants.js")]);
const architecture = await (await fetch("../examples/kiroshi-warehouse.json")).json();
architecture.theme = params.get("theme") ?? "red";
const portrait = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#293f4b"/><circle cx="60" cy="46" r="23" fill="#69d9d1"/><path d="M15 120Q20 66 60 76Q100 66 105 120" fill="#69d9d1"/></svg>');
let session = {
  id: "preview",
  revision: 1,
  status: mode === "login" ? "login" : "active",
  architecture,
  runner: {
    userId: "runner",
    actorUuid: "Actor.runner",
    profile: {
      name: "Ghost",
      rank: 7,
      img: portrait,
      deckName: "Raven Microcyb",
      deckId: "deck",
      decks: [{
        id: "deck",
        name: "Raven Microcyb"
      }],
      programs: [{
        id: "armor",
        uuid: "Item.armor",
        name: "Armor",
        class: "defender",
        active: true,
        rez: 7
      }, {
        id: "sword",
        uuid: "Item.sword",
        name: "Sword",
        class: "antiprogramattacker",
        active: true,
        rez: 5
      }, {
        id: "worm",
        uuid: "Item.worm",
        name: "Worm",
        class: "booster",
        active: false,
        rez: 0
      }]
    }
  },
  observers: ["observer"],
  currentNodeId: "password",
  previousNodeId: "access",
  discoveredNodeIds: mode === "login" ? [] : ["access", "password"],
  clearedNodeIds: ["access", "password"],
  failedNodeIds: [],
  compromisedNodeIds: [],
  iceStates: {},
  actions: {
    used: 1,
    max: 3
  },
  combat: {
    round: 2,
    turn: 1,
    isRunnerTurn: true
  },
  event: null
};
let library = [architecture];
if (params.has("npcs")) {
  const actors = [{ uuid: "Actor.rival", name: "Rival Netrunner", type: "mook", documentName: "Actor" },
    { uuid: "Actor.imp", name: "Security Demon", type: "demon", documentName: "Actor" }];
  game.actors = actors;
  globalThis.fromUuid = async uuid => actors.find(a => a.uuid === uuid) ?? null;
  session.participants = actors.map((a, i) => ({ id: `npc${i}`, actorUuid: a.uuid, name: a.name, kind: a.type === "demon" ? "demon" : "netrunner", nodeId: "password", visible: true }));
  architecture.participants = clone(session.participants);
  architecture.name = "Arasaka Research Datafort";
  architecture.nodes.find(n => n.id === "password").name = "Employee Authentication Gateway";
}
if (params.has("combat")) {
  session.runner.profile.hp = 35;
  session.runner.profile.maxHp = 40;
  session.iceStates = { sentinel: { name: "Sentinel / Custom ICE", nodeId: "password", rezzed: true, visible: true, defeated: false,
    stats: { per: 6, spd: 7, atk: 9, def: 5 }, rez: { value: 22, max: 30 },
    target: { kind: "runner", name: "Ghost" }, programs: [{ id: "attack", name: "ICE Attack", system: {} }] } };
  session.runnerTargetId = "sentinel";
  session.netCombat = [{ id: "attack", source: { kind: "ice", id: "sentinel", name: "Sentinel / Custom ICE" }, target: { kind: "runner", name: "Ghost" }, kind: "atk", total: 16, status: "rolled" },
    { id: "damage", source: { kind: "runner", name: "Ghost" }, target: { kind: "ice", id: "sentinel", name: "Sentinel / Custom ICE" }, kind: "damage", total: 8, status: "rolled" }];
  architecture.nodes.at(-1).alwaysVisible = true;
  session.bypassNodeIds = ["password"];
}
if (mode === "loot") {
  const node = architecture.nodes.find(n => n.id === "password");
  node.attachments = [
    { id: "reward", uuid: "Item.reward", name: "Recovered Program", documentType: "Item", visible: true },
    { id: "journal", uuid: "JournalEntry.manifest", name: "Shipping Manifest", documentType: "JournalEntry", visible: true }
  ];
  globalThis.fromUuid = async uuid => uuid === "JournalEntry.manifest" ? {
    name: "Shipping Manifest", documentName: "JournalEntry", testUserPermission: () => true,
    pages: [{ name: "Warehouse Delivery", type: "text", sort: 0, testUserPermission: () => true,
      text: { content: "<p>Crate 42 contains the recovered data. Delivery is scheduled for midnight.</p><p><strong>Destination:</strong> Kiroshi warehouse, loading bay three.</p>" } }]
  } : null;
  TextEditor.enrichHTML = async html => html;
}
if (params.has("players")) {
  ensureRunners(session);
  for (let i = 1; i < Math.min(6, Number(params.get("players")) || 2); i++) {
    const id = `player${i}`;
    users.push({ id, name: `Player ${i + 1}`, isGM: false, active: true });
    const r = clone(session.runners.runner);
    r.runner = { ...r.runner, userId: id, actorUuid: `Actor.${id}`, profile: { ...r.runner.profile, name: `Netrunner ${i + 1}` } };
    r.currentNodeId = i % 2 ? "access" : "password";
    session.runners[id] = r;
  }
}
function projectedView() {
  const view = getVisibleSessionStateForUser(session, game.user);
  if (mode === "loot") view.architecture.nodes.find(n => n.id === "password").attachments = architecture.nodes.find(n => n.id === "password").attachments;
  return view;
}
const runtime = {
  view: null,
  adapter: {
    isIce: () => false,
    resolve: async () => {
      throw Error("No live Foundry Documents in preview.");
    }
  },
  store: {
    list: () => clone(library),
    get: id => clone(library.find(a => a.id === id)),
    save: async a => {
      library = library.filter(x => x.id !== a.id);
      library.push(clone(a));
      return clone(a);
    },
    delete: async id => {
      library = library.filter(x => x.id !== id);
    }
  },
  socket: {
    request: async req => {
      if (session.runners && req.runnerId) selectRunner(session, req.runnerId);
      if (req.action === "selectRunner") session.gmRunnerIds = { [game.user.id]: req.runnerId };
      if (req.action === "jackIn") {
        session.status = "active";
        session.discoveredNodeIds = ["access"];
        session.currentNodeId = "access";
      }
      if (req.action === "attempt") {
        session.discoveredNodeIds.push(req.nodeId);
        session.clearedNodeIds.push(req.nodeId);
        session.event = {
          id: crypto.randomUUID(),
          text: "ACCESS GRANTED — SIMULATED",
          success: true
        };
      }
      if (req.action === "move") {
        session.previousNodeId = session.currentNodeId;
        session.currentNodeId = req.nodeId;
      }
      if (req.action === "takeItem") architecture.nodes.find(n => n.id === req.nodeId).attachments.find(a => a.id === req.attachmentId).taken = true;
      if (req.action === "npc-add") session.participants.push({ ...req, kind: game.actors.find(a => a.uuid === req.actorUuid)?.type === "demon" ? "demon" : "netrunner" });
      if (req.action === "npc-move") session.participants.find(p => p.id === req.participantId).nodeId = req.destinationId;
      syncRunner(session);
      session.revision++;
      runtime.view = projectedView();
      runtime.runApp.render();
    }
  },
  openEditor: a => new ArchitectureEditor(runtime, a).render(),
  rejoin: async () => {}
};
runtime.view = projectedView();
runtime.runApp = new NetrunApp(runtime);
runtime.runApp.selected = mode === "gm" ? "control" : "password";
const { NetCombatApp } = await import("../scripts/apps/net-combat-app.js");
const app = params.get("combat") === "window" ? new NetCombatApp(runtime) : mode === "manager" ? new ArchitectureManager(runtime) : mode === "editor" ? new ArchitectureEditor(runtime, architecture) : runtime.runApp;
globalThis.preview = {
  app,
  runtime,
  session
};
app.render();
await app.renderPromise;
document.documentElement.dataset.ready = "true";
