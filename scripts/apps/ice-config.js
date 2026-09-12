import { escapeHTML as e, optionalDocument } from "../constants.js";
import { field, check, formDialog } from "./ui.js";
import { normalizeIceConfig } from "../services/net-combat-service.js";

export async function iceConfigDialog(config = {}, encounter = null) {
  const choices = (game.items ?? []).filter(p => p.type === "program");
  if (encounter) config = { ...config, programUuids: encounter.programs.map(p => p.sourceUuid) };
  for (const uuid of config.programUuids ?? []) if (uuid && !choices.some(p => p.uuid === uuid)) {
    const p = await optionalDocument(uuid);
    if (p?.type === "program") choices.push(p);
  }
  const f = await formDialog(encounter ? "Edit ICE Encounter" : "Configure Node ICE", `<p>Changes affect this encounter only. The original Actor and Programs are unchanged.</p>${field("name", "Encounter name (blank = source)", encounter?.name ?? config.name ?? "")}${["per", "spd", "atk", "def", "rezMax"].map(key => field(key, key === "rezMax" ? "Maximum REZ" : key.toUpperCase(), encounter ? key === "rezMax" ? encounter.rez.max : encounter.stats[key] : config.stats?.[key] ?? "", "number")).join("")}${encounter ? field("rez", "Current REZ", encounter.rez.value, "number") : "<p>Blank stats use the linked Document's values.</p>"}<h4>PROGRAMS</h4>${encounter ? `<p>Current: ${e(encounter.programs.map(p => p.name).join(", ") || "None")}</p>${check("replacePrograms", "Replace the encounter's Program list with the selection below", false)}` : "<p>Select Programs to copy into each encounter. No selection uses the attached source Program(s).</p>"}${choices.map((p, i) => check(`program${i}`, p.name, config.programUuids?.includes(p.uuid))).join("")}`, "Save ICE");
  if (!f) return null;
  const stats = Object.fromEntries(["per", "spd", "atk", "def", "rezMax"].filter(k => f[k] !== "").map(k => [k, Number(f[k])]));
  return { config: normalizeIceConfig({ name: f.name, stats, programUuids: choices.filter((p, i) => f[`program${i}`]).map(p => p.uuid) }),
    ...(encounter ? { rez: Number(f.rez), replacePrograms: !!f.replacePrograms } : {}) };
}
