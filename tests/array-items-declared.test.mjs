// Every array in the shipped service description declares its item schema.
//
// The runtime derives the model's structured-output response format from
// `cinatra/oas.json`. The model service refuses a response format in which any
// array is declared without an item schema — verbatim, on three List Curator
// child runs:
//
//   400 Invalid schema for response_format 'response': In context=
//   ('properties', 'items'), array schema missing items.
//
// So an array declared anywhere in this document — a flow input or output, a
// node input or output, or a nested JSON-Schema level inside one — carries an
// item schema. The two spellings are not interchangeable: a DECLARATION (an
// entry of an `inputs`/`outputs` list) carries it at `json_schema.items`, while
// a plain JSON-Schema level carries it at the JSON-Schema keyword `items`. A
// nested level that spells it `json_schema.items` declares nothing the runtime
// reads, so this file does not accept that spelling there.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "cinatra/oas.json"), "utf8");
const oas = JSON.parse(source);

/**
 * Every place in the document that declares `type: "array"`, with its path and
 * whether it is a declaration (an entry of an `inputs`/`outputs` list) or a
 * plain JSON-Schema level.
 */
function arraySites(value, path = "$", key = null, found = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => arraySites(v, `${path}[${i}]`, key, found));
    return found;
  }
  if (!value || typeof value !== "object") return found;
  if (value.type === "array") {
    found.push({
      path: value.title ? `${path} (${value.title})` : path,
      node: value,
      isDeclaration: key === "inputs" || key === "outputs",
    });
  }
  for (const [k, v] of Object.entries(value)) arraySites(v, `${path}.${k}`, k, found);
  return found;
}

/** The item schema of an array site, read at the spelling that site's position allows. */
function itemSchema(site) {
  return site.isDeclaration ? site.node.json_schema?.items ?? site.node.items : site.node.items;
}

const sites = arraySites(oas);

test("the walk finds every array the document declares", () => {
  const spelled = source.match(/"type":\s*"array"/g) ?? [];
  assert.ok(spelled.length > 0, "no array declaration found in cinatra/oas.json");
  assert.equal(
    sites.length,
    spelled.length,
    `the walk found ${sites.length} array site(s) but the document spells "type": "array" ${spelled.length} time(s) — the walk misses sites this file is supposed to guard`,
  );
});

test("every array declares an item schema", () => {
  const missing = sites
    .filter((site) => {
      const schema = itemSchema(site);
      return !schema || typeof schema !== "object" || Array.isArray(schema);
    })
    .map((site) => site.path);
  assert.deepEqual(
    missing,
    [],
    `arrays declared without an item schema — the model service refuses the derived response format: ${missing.join(", ")}`,
  );
});

test("every declared item schema declares its own type", () => {
  for (const site of sites) {
    const schema = itemSchema(site);
    assert.equal(
      typeof schema?.type,
      "string",
      `the item schema at ${site.path} declares no type`,
    );
  }
});

test("seedUrls declares string items everywhere it appears", () => {
  const seeds = sites.filter((site) => site.node.title === "seedUrls");
  assert.ok(seeds.length > 0, "no seedUrls array declaration found");
  for (const site of seeds) {
    assert.equal(itemSchema(site)?.type, "string", `seedUrls items at ${site.path}`);
  }
});

test("items declares an open object item schema — each item is the caller's outputSchema", () => {
  const itemsSites = sites.filter((site) => site.node.title === "items");
  assert.ok(itemsSites.length > 0, "no items array declaration found");
  for (const site of itemsSites) {
    const schema = itemSchema(site);
    assert.equal(schema?.type, "object", `items item schema at ${site.path} is not an object level`);
    assert.equal(
      schema?.additionalProperties,
      true,
      `items item schema at ${site.path} does not allow additional properties, but each item's shape is the caller's outputSchema`,
    );
  }
});

test("a nested schema level must spell its item schema `items`, not `json_schema.items`", () => {
  const walked = arraySites(
    {
      title: "outer",
      type: "array",
      json_schema: { items: { type: "array", json_schema: { items: { type: "string" } } } },
    },
    "$",
    "outputs",
  );
  const nested = walked.find((site) => !site.isDeclaration);
  assert.ok(nested, "the walk did not reach the nested array level");
  assert.equal(
    itemSchema(nested),
    undefined,
    "a nested array level's `json_schema.items` was accepted as an item schema — the runtime reads `items` there",
  );
});
