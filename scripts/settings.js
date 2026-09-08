import { ID } from "./constants.js";
export function registerSettings() {
  const fields = {
    defaultTheme: ["world", String, "red", {
      red: "Cyberpunk RED",
      "2077": "Neon 2077"
    }],
    allowObservers: ["world", Boolean, true],
    promptObservers: ["world", Boolean, true],
    generatorOptions: ["world", String, '{"count":8,"branches":true,"weights":{"password":2,"blackice":2,"control":2,"file":2,"data":1}}'],
    chatLevel: ["world", String, "rolls", {
      all: "All",
      rolls: "Rolls Only",
      events: "Important Events",
      none: "None"
    }],
    openGM: ["world", Boolean, true],
    openRunner: ["world", Boolean, true],
    confirmJackOut: ["world", Boolean, true],
    storeLogs: ["world", Boolean, false],
    automation: ["world", Boolean, true],
    debug: ["world", Boolean, false],
    sounds: ["client", Boolean, false],
    animations: ["client", Boolean, true],
    reducedMotion: ["client", Boolean, false],
    intensity: ["client", Number, 0.6],
    uiScale: ["client", Number, 1],
    openObserver: ["client", Boolean, true],
    rememberPosition: ["client", Boolean, true]
  };
  for (const [key, [scope, type, value, choices]] of Object.entries(fields)) game.settings.register(ID, key, {
    name: `NETA.settings.${key}`,
    scope,
    config: true,
    type,
    default: value,
    ...(choices ? {
      choices
    } : {}),
    ...(key === "intensity" ? {
      range: {
        min: 0,
        max: 1,
        step: 0.1
      }
    } : {}),
    ...(key === "uiScale" ? {
      range: {
        min: 0.8,
        max: 1.4,
        step: 0.1
      }
    } : {})
  });
}
