import { ID, setting, requireGM, log } from "./constants.js";
import { registerSettings } from "./settings.js";
import { ArchitectureService } from "./services/architecture-service.js";
import { CPRSystemAdapter } from "./services/cpr-system-adapter.js";
import { SocketService, authority } from "./services/socket-service.js";
import { SessionService } from "./services/session-service.js";
import { ControlNodeService } from "./services/control-node-service.js";
import { ChatService } from "./services/chat-service.js";
import { ArchitectureManager } from "./apps/architecture-manager.js";
import { ArchitectureEditor } from "./apps/architecture-editor.js";
import { NetrunApp } from "./apps/netrun-app.js";
import { buildAPI } from "./api.js";
let runtime;
Hooks.once("init", () => {
  registerSettings();
});
Hooks.once("ready", async () => {
  try {
    const adapter = new CPRSystemAdapter();
    adapter.verify();
    runtime = {
      adapter,
      store: new ArchitectureService(),
      socket: new SocketService(),
      view: null,
      locallyClosed: false,
      ready: false
    };
    runtime.sessions = new SessionService(runtime.store, adapter, runtime.socket, new ControlNodeService());
    runtime.chat = new ChatService(runtime.store, runtime.socket, adapter);
    adapter.chat = runtime.chat;
    runtime.sessions.chat = runtime.chat;
    runtime.socket.onChat = card => runtime.chat.receive(card);
    runtime.runApp = new NetrunApp(runtime);
    runtime.openEditor = a => new ArchitectureEditor(runtime, a).render(true);
    runtime.openManager = () => {
      requireGM();
      if (!runtime.ready) return ui.notifications.warn("NET Architect is still connecting.");
      runtime.manager ??= new ArchitectureManager(runtime);
      return runtime.manager.render(true);
    };
    runtime.rejoin = async () => {
      runtime.locallyClosed = false;
      runtime.manualOpen = true;
      await runtime.socket.request({
        action: "sync",
        open: true
      });
      if (!runtime.view) ui.notifications.info("No NETRUN is currently shared with you.");
    };
    if (game.user.isGM) await runtime.store.initialize();
    await runtime.socket.initialize((user, req) => runtime.sessions.request(user, req), async (state, open) => {
      if (state && runtime.view?.id === state.id && state.revision < runtime.view.revision) return;
      const newSession = state && runtime.view?.id !== state.id;
      runtime.view = state;
      if (runtime.combatApp?.rendered) runtime.combatApp.render(false, { focus: false });
      if (newSession) {
        runtime.locallyClosed = false;
        runtime.runApp.selected = null;
        runtime.runApp.graphView = null;
      }
      if (!state) {
        runtime.manualOpen = false;
        if (runtime.runApp.rendered) runtime.runApp.render(false, { focus: false });
        return;
      }
      const auto = state.role === "gm" ? setting("openGM") : state.role === "runner" ? setting("openRunner") : setting("openObserver") && setting("promptObservers");
      if (open && auto) runtime.locallyClosed = false;
      if (!runtime.locallyClosed && (runtime.runApp.rendered || auto || runtime.manualOpen)) {
        const renderOptions = { focus: !!runtime.manualOpen || !!newSession };
        const position = setting("rememberPosition") ? localStorage.getItem(`${ID}.position.${game.world.id}.${game.user.id}`) : null;
        if (position && !runtime.runApp.rendered) {
          try {
            const p = JSON.parse(position);
            for (const key of ["left", "top", "width", "height"]) if (Number.isFinite(p[key])) renderOptions[key] = Math.max(0, p[key]);
          } catch (error) {
            log.debug("Saved window position invalid", error.message);
          }
        }
        runtime.runApp.render(true, renderOptions);
      }
      runtime.manualOpen = false;
    });
    runtime.ready = true;
    runtime.chat.initialize();
    game.modules.get(ID).api = buildAPI(runtime);
    ui.chat?.render(false);
    runtime.authorityId = authority()?.id;
    if (runtime.sessions.isAuthority()) await runtime.sessions.restore();else if (authority()) await runtime.socket.request({
      action: "sync"
    });
    ui.controls?.render();
  } catch (error) {
    log.error(error);
  }
});
Hooks.on("getSceneControlButtons", controls => {
  if (game.system.id !== "cyberpunk-red-core") return;
  const token = controls.find(c => c.name === "token");
  if (!token) return;
  token.tools.push({
    name: ID,
    title: game.user.isGM ? "NET Architect" : "REJOIN NET VIEW",
    icon: "fas fa-network-wired",
    button: true,
    onClick: () => {
      if (!runtime?.ready) return ui.notifications.warn("NET Architect is not ready. Check the startup error, supported system version, and HTTPS connection or GM HTTP compatibility setting. Reload all clients after changing transport mode.");
      Promise.resolve(game.user.isGM ? runtime.openManager() : runtime.rejoin()).catch(log.error);
    }
  });
});
Hooks.on("renderSettings", (app, html) => {
  if (!runtime?.ready || html.find(".neta-launch").length) return;
  const button = $('<button class="neta-launch"><i class="fas fa-network-wired"></i> NET Architect</button>');
  button.on("click", () => Promise.resolve(game.user.isGM ? runtime.openManager() : runtime.rejoin()).catch(log.error));
  html.find(".settings-sidebar").first().append(button);
});
let refreshTimer;
function refreshRelevant(document) {
  if (!runtime?.ready || !runtime.sessions.isAuthority() || !runtime.sessions.session) return;
  const s = runtime.sessions.session;
  const runners = s.runners ? Object.values(s.runners) : [s];
  if (document && !runners.some(r => document.uuid === r.runner.actorUuid || document.parent?.uuid === r.runner.actorUuid)) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    const service = runtime.sessions;
    const task = service.queue.then(async () => {
      if (!service.session) return;
      await service.commit();
    });
    service.queue = task.catch(log.error);
  }, 120);
}
for (const hook of ["updateActor", "createItem", "updateItem", "deleteItem"]) Hooks.on(hook, document => refreshRelevant(document));
Hooks.on("updateCombat", (combat, changes) => {
  if (!runtime?.ready || !runtime.sessions.isAuthority() || !runtime.sessions.session) return;
  const service = runtime.sessions;
  const task = service.queue.then(async () => {
    if (!service.session) return;
    if ("turn" in changes || "round" in changes) {
      const s = service.session;
      if (combat.combatant?.actor?.uuid === s.runner.actorUuid) s.actions.used = 0;
      for (const r of Object.values(s.runners ?? {})) if (combat.combatant?.actor?.uuid === r.runner.actorUuid) r.actions.used = 0;
    }
    await service.commit();
  });
  service.queue = task.catch(log.error);
});
Hooks.on("deleteCombat", () => refreshRelevant());
Hooks.on("userConnected", () => {
  if (!runtime?.ready) return;
  setTimeout(async () => {
    try {
      const id = authority()?.id,
        changed = id !== runtime.authorityId;
      runtime.authorityId = id;
      if (runtime.sessions.isAuthority()) {
        const service = runtime.sessions;
        const task = service.queue.then(() => changed ? service.restore() : service.publish(false));
        service.queue = task.catch(log.error);
        await task;
      } else if (id) await runtime.socket.request({
        action: "sync"
      });
    } catch (error) {
      log.debug("Reconnect pending", error.message);
    }
  }, 1200);
});
Hooks.on("updateUser", (user, changes) => {
  if (!runtime?.ready || !runtime.sessions.isAuthority()) return;
  if (foundry.utils.getProperty(changes, `flags.${ID}.transportKey`)) setTimeout(() => runtime.sessions.publish(false).catch(log.error), 100);
});
