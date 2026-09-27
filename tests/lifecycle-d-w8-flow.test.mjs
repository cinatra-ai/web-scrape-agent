// W8 (cinatra#3096) item (14) — the instructions as one text field, the
// per-item schema from an artifact or a file.
// The setup form draws the fields named in metadata.cinatra.required; a field
// left out of both lists is never shown and never prompted for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const oas = JSON.parse(readFileSync(path.join(root, "cinatra/oas.json"), "utf8"));
const refs = oas.$referenced_components;
const start = refs.start;
const extract = refs.extract;
const meta = start.metadata.cinatra;
const required = meta.required ?? [];
const hidden = meta.hidden ?? [];

test("(14) the instructions are one text field the person writes", () => {
  for (const inputs of [start.inputs, oas.inputs]) {
    const instructions = inputs.filter((i) => i.title === "instructions");
    assert.equal(instructions.length, 1, "the instructions are not one field");
    assert.equal(instructions[0].type, "string");
    assert.equal(instructions[0].default, "");
    assert.ok(instructions[0].description, "the instructions field does not say what it is for");
  }
  assert.ok(required.includes("instructions"), "the instructions are not drawn on the setup form");
  assert.ok(!hidden.includes("instructions"), "the instructions are hidden from the person");
});

test("(14) the schema comes from an artifact or a file", () => {
  for (const inputs of [start.inputs, oas.inputs]) {
    const source = inputs.find((i) => i.title === "outputSchemaSource");
    assert.ok(source, "there is no way to name where the schema comes from");
    assert.equal(source.type, "object");
    assert.deepEqual(source.json_schema, {
      type: "object",
      properties: {
        type: { type: "string", enum: ["artifact", "file"] },
        ref: { type: "string" },
      },
      required: ["type", "ref"],
    });
    assert.deepEqual(source.default, {});
    assert.ok(source.description, "the schema source does not say what it is for");
    const schema = inputs.find((i) => i.title === "outputSchema");
    assert.deepEqual(schema.default, {}, "the raw schema is still demanded up front");
  }
  assert.deepEqual(required, ["seedUrls", "outputSchemaSource", "instructions"]);
  assert.deepEqual(hidden, ["maxUrls", "followLinks", "maxDepth", "outputSchema"]);
  const system = extract.data.system;
  assert.match(system, /When outputSchema is empty, read the schema from outputSchemaSource first/, "the step never reads the source");
  assert.match(system, /for type "artifact" call artifact_representation_get with the ref/);
  assert.match(system, /for type "file" read the file the ref names/);
  assert.match(system, /The only exception is that one schema read[^\n]*artifact_representation_get[^\n]*read the file its ref names/, "the tool discipline forbids the schema read");
  assert.match(system, /verbatim\*\* \(when it is empty, the schema read from `outputSchemaSource`\)/, "the extraction rule ignores the schema read from the source");
  assert.ok(
    (oas.data_flow_connections ?? []).some(
      (e) =>
        e.source_node.$component_ref === "start" &&
        e.source_output === "outputSchemaSource" &&
        e.destination_node.$component_ref === "extract" &&
        e.destination_input === "outputSchemaSource",
    ),
    "the source never reaches the step",
  );
});

test("every setup input is either drawn or declared as plumbing", () => {
  const declared = new Set([...required, ...hidden]);
  assert.deepEqual(
    start.inputs.map((i) => i.title).filter((t) => !declared.has(t)),
    [],
    "these inputs are in neither required nor hidden",
  );
});

test("(14) the extract step declares every input it references", () => {
  const declared = new Set(extract.inputs.map((i) => i.title));
  const body = JSON.stringify([extract.url, extract.data, extract.query_params, extract.headers]);
  const referenced = new Set([...body.matchAll(/{{\s*([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]));
  referenced.delete("CINATRA_BASE_URL");
  for (const name of referenced) {
    assert.ok(declared.has(name), `${name} is referenced by the step but not declared in its inputs`);
  }
  assert.ok(declared.has("outputSchemaSource"), "the schema source is not declared on the step");
  assert.ok(extract.data.user.includes("{{ outputSchemaSource | tojson }}"), "the step's text never carries the source");
  assert.match(extract.data.user, /pyagentspec-input-hint[^#]*\{\{ outputSchemaSource \}\}/, "the input hint does not name the source");
});

test("(14) the flow and the start node declare the same inputs", () => {
  assert.deepEqual(
    oas.inputs.map((i) => i.title),
    start.inputs.map((i) => i.title),
  );
  assert.deepEqual(oas.inputs, start.inputs, "the flow and the start node describe an input differently");
});
