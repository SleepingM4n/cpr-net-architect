import { escapeHTML as e } from "../constants.js";
import { button as b } from "./ui.js";
export function loginView(state) {
  const p = state.runner.profile;
  return `<section class="neta-login"><span class="neta-kicker">${e(state.architecture.name)} // NEURAL ACCESS</span><h1>NIGHT CITY<br>DATAFORT</h1><div class="neta-login-log"><p>INITIALIZING CYBERDECK…</p><p>LINK ESTABLISHED</p><p>NEURAL HANDSHAKE…</p><p>ICE COUNTERMEASURES ONLINE</p><p>ROUTE VERIFIED</p></div><div class="neta-identity"><img src="${e(p.img)}" alt="Runner portrait"><div><p>IDENTITY: <b>${e(p.name)}</b></p><p>INTERFACE: <b>${p.rank}</b></p><p>CYBERDECK: <b>${e(p.deckName)}</b></p></div></div>${state.role === "runner" ? b("jackIn", "JACK IN", 'class="neta-jack-in"') : '<p class="neta-badge">AWAITING PLAYER JACK IN</p>'}</section>`;
}
