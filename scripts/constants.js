export const ID = "cpr-net-architect";
export const PACK = `world.${ID}`;
export const VERSION = 1;
export const TYPES = ["access", "password", "file", "control", "blackice", "demon", "data", "objective", "custom"];
export const ABILITIES = ["scanner", "backdoor", "cloak", "control", "eyedee", "pathfinder", "slide", "virus", "zap", "speed", "defense"];
export const CONTROL_TYPES = {
  Wall: ["open", "close", "lock", "unlock"],
  Tile: ["show", "hide"],
  Token: ["show", "hide"],
  AmbientLight: ["enable", "disable"],
  AmbientSound: ["enable", "disable"],
  Macro: ["execute"]
};
export const clone = data => structuredClone(data);
export const uid = () => crypto.randomUUID();
export const setting = key => game.settings.get(ID, key);
export const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[c]);
export const log = {
  debug(...args) {
    if (setting("debug")) console.debug("CPR NET Architect |", ...args);
  },
  error(error) {
    console.error("CPR NET Architect |", error);
    ui.notifications.error(`NET Architect: ${error.message ?? error}`);
  }
};
export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
export function requireGM() {
  assert(game.user.isGM, "Only a GM can perform this action.");
}
export function safeImage(path) {
  return typeof path === "string" && !/^(?:javascript|data|vbscript):/i.test(path) ? path : "icons/svg/mystery-man.svg";
}
export async function optionalDocument(uuid) {
  if (typeof uuid !== "string" || !uuid) return null;
  try {
    return await fromUuid(uuid);
  } catch (error) {
    log.debug("Document reference could not be resolved", error.message);
    return null;
  }
}
