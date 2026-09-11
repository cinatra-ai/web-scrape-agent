// Bridge-output item members — the extract node's list outputs.
//
// The runtime asks the model for exactly the shape this agent declares: an
// object level with no declared members is sent closed and empty, so an answer
// carries nothing inside it. `failures` has one fixed shape, spelled out in the
// node's own system prompt ({ url, error }), so it is DECLARED here. `items` is
// genuinely per-call: each item conforms to the caller-supplied `outputSchema`
// input plus the always-added `sourceUrl`, so it is RECORDED as intentionally
// free-form in its own OAS `description` instead — declaring a fixed member set
// there would misrepresent the contract.
//
// Both facts are asserted at every place the OAS repeats the output list: the
// flow-level outputs, the bridge ApiNode's outputs and the EndNode's outputs.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const oas = JSON.parse(readFileSync(join(root, "cinatra/oas.json"), "utf8"));
const components = oas.$referenced_components ?? {};

const LLM_BRIDGE = "/api/llm-bridge";

/** Every output list that carries the extract node's bridge outputs. */
function outputLists() {
  const lists = [];
  if (Array.isArray(oas.outputs)) lists.push({ where: "flow", outputs: oas.outputs });
  for (const [id, comp] of Object.entries(components)) {
    if (!comp || typeof comp !== "object") continue;
    const isBridge =
      comp.component_type === "ApiNode" && String(comp.url ?? "").includes(LLM_BRIDGE);
    const isEnd = comp.component_type === "EndNode";
    if (!isBridge && !isEnd) continue;
    if (!Array.isArray(comp.outputs)) continue;
    lists.push({ where: `${comp.component_type} ${id}`, outputs: comp.outputs });
  }
  return lists;
}

function output(list, title) {
  return list.outputs.find((o) => o && o.title === title);
}

const lists = outputLists();

const FREEFORM_WORDS = [
  "free-form",
  "free form",
  "freeform",
  "arbitrary",
  "unstructured",
  "no fixed shape",
  "opaque",
];

test("the OAS repeats the extract node's outputs in three places", () => {
  assert.equal(lists.length, 3, `output lists found: ${lists.map((l) => l.where).join(", ")}`);
  for (const list of lists) {
    assert.ok(output(list, "items"), `no items output on ${list.where}`);
    assert.ok(output(list, "failures"), `no failures output on ${list.where}`);
  }
});

test("failures declares its item members (url, error) everywhere it appears", () => {
  for (const list of lists) {
    const failures = output(list, "failures");
    const items = failures?.json_schema?.items;
    assert.ok(
      items && typeof items === "object",
      `failures on ${list.where} declares no json_schema.items`,
    );
    assert.equal(items.type, "object", `failures items on ${list.where} is not an object level`);
    const properties = items.properties;
    assert.ok(
      properties && typeof properties === "object",
      `failures items on ${list.where} declares no properties — the request is sent closed and empty there`,
    );
    assert.deepEqual(
      Object.keys(properties).sort(),
      ["error", "url"],
      `failures item members on ${list.where}`,
    );
    assert.equal(properties.url.type, "string");
    assert.equal(properties.error.type, "string");
    assert.deepEqual(
      [...(items.required ?? [])].sort(),
      ["error", "url"],
      `failures required members on ${list.where}`,
    );
  }
});

test("the declared failures members are the shape the system prompt fixes", () => {
  const extract = components.extract;
  const system = extract?.data?.system ?? extract?.inputs_mapping?.system ?? "";
  const prompt = typeof system === "string" ? system : JSON.stringify(system);
  assert.ok(prompt.includes("`failures`"), "the system prompt does not mention failures");
  for (const member of ["url", "error"]) {
    assert.ok(
      prompt.includes(`"${member}"`),
      `the system prompt does not spell out the ${member} member`,
    );
  }
});

test("items records in its own description that it is intentionally free-form, and why", () => {
  for (const list of lists) {
    const items = output(list, "items");
    const description = items?.description;
    assert.ok(
      typeof description === "string" && description.trim().length > 0,
      `items on ${list.where} carries no description`,
    );
    const low = description.toLowerCase();
    assert.ok(
      FREEFORM_WORDS.some((word) => low.includes(word)),
      `items description on ${list.where} does not record the shape as free-form: ${description}`,
    );
    assert.ok(
      low.includes("outputschema"),
      `items description on ${list.where} does not say why (the caller-supplied outputSchema): ${description}`,
    );
    assert.ok(
      low.includes("sourceurl"),
      `items description on ${list.where} does not name the always-added sourceUrl member: ${description}`,
    );
  }
});

test("items is NOT given a fixed member set that would misrepresent the contract", () => {
  for (const list of lists) {
    const items = output(list, "items");
    assert.equal(
      items?.json_schema?.items?.properties,
      undefined,
      `items on ${list.where} declares fixed members, but each item's shape is the caller's outputSchema`,
    );
  }
});
