import { TYPES, setting, assert, uid } from "../constants.js";
import { makeArchitecture, makeNode } from "../services/import-export-service.js";
import { autoLayout } from "../graph/graph-layout.js";
import { field, check, formDialog, options } from "./ui.js";
export function generateWeighted({
  name = "Generated Architecture",
  count = 8,
  branches = true,
  weights = {
    password: 2,
    blackice: 2,
    control: 2,
    file: 2,
    data: 1
  },
  dv = 8
}, random = Math.random) {
  assert(Number.isInteger(count) && count >= 2 && count <= 50, "Size must be 2–50 nodes.");
  const entries = Object.entries(weights).filter(([type, w]) => TYPES.includes(type) && type !== "access" && Number.isFinite(Number(w)) && Number(w) > 0).map(([t, w]) => [t, Number(w)]);
  const sum = entries.reduce((s, [, w]) => s + w, 0);
  assert(sum > 0, "At least one node weight must be positive.");
  const a = makeArchitecture(name);
  for (let i = 1; i < count; i++) {
    let roll = random() * sum;
    const type = entries.find(([, w]) => (roll -= w) < 0)?.[0] ?? entries.at(-1)[0];
    const node = makeNode(type);
    node.challenge.dv = dv;
    const parent = branches && i > 2 && random() < 0.35 ? a.nodes[Math.floor(random() * a.nodes.length)] : a.nodes.at(-1);
    a.nodes.push(node);
    a.edges.push({
      id: uid(),
      from: parent.id,
      to: node.id
    });
  }
  return autoLayout(a);
}
export async function randomGenerator(runtime) {
  let defaults;
  try {
    defaults = JSON.parse(setting("generatorOptions"));
  } catch {
    throw new Error("Default generator options must be valid JSON in Module Settings.");
  }
  const f = await formDialog("Random Architecture — GM-defined weights", `${field("name", "Architecture name", "Generated Architecture")}${field("count", "Total nodes (Small 5 / Medium 10 / Large 20 / Custom 2–50)", defaults.count ?? 8, "number")}${check("branches", "Allow branches", defaults.branches !== false)}${field("dv", "Default DV (GM choice)", 8, "number")}${["password", "blackice", "control", "file", "data"].map(t => field(t, `${t} weight (Low 1 / Standard 2 / High 4)`, defaults.weights?.[t] ?? 2, "number")).join("")}<p>This is a configurable graph generator, not a reproduction of rulebook tables. For CPR's native RollTables, use <b>Native Table Generator</b> in the library.</p>`, "Generate");
  if (!f) return;
  const a = generateWeighted({
    ...f,
    count: Number(f.count),
    dv: Number(f.dv),
    weights: Object.fromEntries(["password", "blackice", "control", "file", "data"].map(t => [t, Number(f[t])]))
  });
  a.theme = setting("defaultTheme");
  await runtime.store.save(a);
  runtime.openEditor(a);
}
export async function nativeGenerator(runtime) {
  const items = game.items.filter(i => i.type === "netarch");
  assert(items.length, "Create a native CPR NET Architecture Item first. Its native generator will configure the rules tables.");
  const f = await formDialog("Native CPR Table Generator", `<label>Generate floors on this native Item<select name="id">${options(items.map(i => [i.id, i.name]))}</select></label><p>This changes the selected native Item's floors using CPR's own generator. Use a new empty Item to preserve existing designs.</p>`, "Open CPR Generator");
  if (!f) return;
  const item = game.items.get(f.id);
  await runtime.adapter.nativeGenerator(item);
  // CPR's sheet does not await its final Item.update. Re-fetch before importing.
  ui.notifications.info("When CPR finishes generating floors, use Import from CPR in the library.");
  item.sheet.render(true);
}
