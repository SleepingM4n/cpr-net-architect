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
export function sameData(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && sameData(a[k], b[k]));
}
export const uid = () => {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // randomUUID is secure-context-only; getRandomValues also works on HTTP.
  assert(globalThis.crypto?.getRandomValues, "Your browser does not provide secure random numbers.");
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
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
