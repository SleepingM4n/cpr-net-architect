import { clone } from "../constants.js";

export const MAX_RUNNERS = 6;
const fields = ["runner", "override", "status", "currentNodeId", "previousNodeId", "discoveredNodeIds", "failedNodeIds", "actions", "combat", "runnerTargetId", "event"];
export function runnerSnapshot(s) {
  return Object.fromEntries(fields.map(key => [key, clone(s[key] ?? null)]));
}
export function syncRunner(s) {
  if (s?.runners) s.runners[s.runner.userId] = runnerSnapshot(s);
}
export function ensureRunners(s) {
  if (s && !s.runners) {
    s.runners = { [s.runner.userId]: runnerSnapshot(s) };
    // Old encounters implicitly targeted the only runner. Bind them before adding anyone else.
    for (const target of [...Object.values(s.iceStates ?? {}).map(i => i.target),
      ...(s.netCombat ?? []).flatMap(entry => [entry.source, entry.target])]) {
      if (target && ["runner", "program"].includes(target.kind)) target.runnerId ??= s.runner.userId;
    }
  }
  return s;
}
export function selectRunner(s, userId) {
  if (!s?.runners?.[userId]) return;
  syncRunner(s);
  Object.assign(s, clone(s.runners[userId]));
}
export function runnerView(s, user) {
  if (!s?.runners) return s;
  const id = user.isGM ? s.gmRunnerIds?.[user.id] : user.id;
  const record = s.runners[id] ?? Object.values(s.runners)[0];
  return { ...s, ...record };
}
