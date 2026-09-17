import { escapeHTML as e, assert } from "../constants.js";
import { button as b, options, formDialog } from "./ui.js";
import { MAX_RUNNERS } from "../services/runner-state.js";

export function runnerControls(s) {
  const gm = s.role === "gm";
  const roster = gm ? Object.values(s.runners ?? {}).map(r => ({ userId: r.runner.userId,
    name: r.runner.profile.name, status: r.status })) : s.playerRunners ?? [];
  return `<div class="neta-runner-controls"><span>NETRUNNERS ${s.runners || s.playerRunners ? roster.length : 1} / ${MAX_RUNNERS} · ${roster.map(r => `${e(r.name)} (${r.status === "active" ? "connected" : "awaiting Jack In"})`).join(" · ")}</span>${gm ? `<div class="neta-toolbar"><strong>Selected: ${e(s.runner.profile.name)}</strong>${b("chooseRunner", "Switch Netrunner")}${b("addRunner", "Add Player Netrunner", roster.length >= MAX_RUNNERS ? "disabled" : "")}</div>` : ""}</div>`;
}
export async function runnerAction(app, action) {
  if (!["chooseRunner", "addRunner"].includes(action)) return false;
  const s = app.runtime.view;
  assert(s.role === "gm", "GM only.");
  const send = (command, extra) => app.runtime.runApp.send(command, extra);
  if (action === "chooseRunner") {
    const f = await formDialog("Select Netrunner", `<p>Movement, Cyberdeck, NET action budget and ICE targeting controls use this runner. Players always control their own runner.</p><label>Netrunner<select name="runnerId">${options(Object.values(s.runners ?? {}).map(r => [r.runner.userId, r.runner.profile.name]), s.runner.userId)}</select></label>`);
    if (f) await send("selectRunner", f);
  } else {
    assert(Object.keys(s.runners ?? {}).length < MAX_RUNNERS, "Maximum six player Netrunners.");
    const actors = game.actors.filter(a => app.runtime.adapter.qualifies(a) && !Object.values(s.runners ?? {}).some(r => r.runner.actorUuid === a.uuid));
    const players = game.users.filter(u => !u.isGM && !s.runners?.[u.id]);
    assert(actors.length && players.length, "No additional player or configured Netrunner is available. Give the player ownership of an Actor with a positive NET Role rank.");
    const f = await formDialog("Add Player Netrunner", `<label>Netrunner Actor<select name="actorUuid">${options(actors.map(a => [a.uuid, a.name]))}</select></label><label>Owning player<select name="userId">${options(players.map(u => [u.id, u.name]))}</select></label><p>The player must own this Actor and will receive their own JACK IN screen. One Actor per player; maximum six players.</p>`, "Add Netrunner");
    if (f) await send("addRunner", f);
  }
  return true;
}
