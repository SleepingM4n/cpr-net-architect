import { mkdir, writeFile } from "node:fs/promises";
import { makeArchitecture, makeNode } from "../scripts/services/import-export-service.js";
const a = makeArchitecture("Kiroshi Warehouse");
a.id = "kiroshi-warehouse-example";
a.nodes[0].id = "access";
a.entryNodeId = "access";
a.nodes[0].name = "Service Port";
a.nodes[0].x = 50;
a.nodes[0].y = 190;
const defs = [["password", "password", "Security Gate", 320, 190, 8], ["blackice", "blackice", "ICE Countermeasure", 590, 80, 0], ["control", "control", "Lobby Security", 860, 80, 10], ["file", "file", "Shipping Manifest", 590, 320, 6], ["objective", "objective", "Extract Shipment Data", 860, 320, 0]];
for (const [id, type, name, x, y, dv] of defs) {
  const n = makeNode(type, x, y);
  Object.assign(n, {
    id,
    name
  });
  if (dv) n.challenge.dv = dv;
  a.nodes.push(n);
}
a.nodes[2].gmNotes = "Drag a native Black ICE Actor and its world Program Item here. The Program provides the native damage formula.";
a.nodes[3].gmNotes = "Select the lobby door Wall on the physical Scene, then Add Control Action. Keep the Wall UUID in this world.";
a.nodes[4].gmNotes = "Drag a JournalEntry here. Toggle Player-visible and give the runner/observers normal Foundry permission to read it.";
a.nodes[5].notes = "Shipment records recovered. Return through the gateway or Jack Out.";
a.edges = [["access", "password"], ["password", "blackice"], ["blackice", "control"], ["password", "file"], ["file", "objective"]].map(([from, to], i) => ({
  id: `path-${i + 1}`,
  from,
  to
}));
await mkdir(new URL("../examples/", import.meta.url), {
  recursive: true
});
await writeFile(new URL("../examples/kiroshi-warehouse.json", import.meta.url), JSON.stringify(a, null, 2) + "\n");
