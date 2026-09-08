import test from "node:test";
import assert from "node:assert/strict";
import { validateArchitecture } from "../scripts/services/import-export-service.js";
import { reachable } from "../scripts/graph/graph-layout.js";
import { renderGraph } from "../scripts/graph/graph-renderer.js";
globalThis.Application = class {};
const {
  generateWeighted
} = await import("../scripts/apps/random-generator.js");
test("weighted 50-node generation is connected, editable and renders 100 connections", () => {
  let seed = 42;
  const random = () => {
    seed = 1664525 * seed + 1013904223 >>> 0;
    return seed / 4294967296;
  };
  const a = generateWeighted({
    count: 50,
    branches: true,
    weights: {
      password: 2,
      blackice: 2,
      file: 1
    }
  }, random);
  assert.equal(a.nodes.length, 50);
  assert.equal(reachable(a, a.entryNodeId).size, 50);
  for (let i = 0; a.edges.length < 100; i++) {
    const from = a.nodes[i % 50].id,
      to = a.nodes[(i + 5) % 50].id;
    if (!a.edges.some(e => e.from === from && e.to === to || e.to === from && e.from === to)) a.edges.push({
      id: crypto.randomUUID(),
      from,
      to
    });
    if (i === 100) break;
  }
  // Fill any remaining pair without duplicating undirected edges.
  for (let i = 0; a.edges.length < 100; i++) {
    const from = a.nodes[0].id,
      to = a.nodes[i + 1].id;
    if (!a.edges.some(e => e.from === from && e.to === to || e.to === from && e.from === to)) a.edges.push({
      id: crypto.randomUUID(),
      from,
      to
    });
  }
  const valid = validateArchitecture(a);
  assert.equal(valid.edges.length, 100);
  const html = renderGraph(valid);
  assert.equal((html.match(/data-node=/g) ?? []).length, 50);
  assert.equal((html.match(/data-edge=/g) ?? []).length, 100);
  valid.nodes[0].name = "Edited";
  assert.equal(validateArchitecture(valid).nodes[0].name, "Edited");
});
test("invalid weighted generator sizes and weights are rejected", () => {
  assert.throws(() => generateWeighted({
    count: 200
  }));
  assert.throws(() => generateWeighted({
    count: 5,
    weights: {
      file: 0
    }
  }));
});
