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
        type: { type: "string", enum: ["artifact"] },
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
  assert.deepEqual(hidden, ["maxUrls", "followLinks", "maxDepth", "outputSchema", "cinatra_run_id"]);
  const system = extract.data.system;
  assert.match(system, /When outputSchema is empty, the schema is the text in schemaText/, "the step never takes the schema that was read");
  assert.doesNotMatch(system, /artifact_representation_get/, "the step names a tool it cannot reach");
  assert.match(system, /A schema file becomes such an artifact when it is uploaded to the Artifacts library/, "the step does not say how a schema file is given");
  assert.match(system, /The schema is read for you before this step; you call no tool to read it\./, "the tool discipline still asks the model to read the schema");
  assert.match(system, /verbatim\*\* \(when it is empty, the schema in `schemaText`\)/, "the extraction rule ignores the schema that was read");
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

const LLM_BRIDGE = "/api/llm-bridge";
const PASSTHROUGH = "/api/agents/passthrough";
// The tools the host's deterministic passthrough serves, as declared in the
// host's src/lib/extension-scoped-tools.ts.
const PASSTHROUGH_TOOLS = ["extension_data", "extension_tool", "artifacts_list", "artifacts_get", "artifact_content_read"];
const SCHEMA_ROAD =
  '{% if outputSchema %}given{% elif outputSchemaSource and outputSchemaSource.type == "artifact" %}artifact{% else %}given{% endif %}';

/** The node ids a run passes, from `start`, when `schema_road` renders `road`. */
function walk(road) {
  const edges = oas.control_flow_connections ?? [];
  const ids = ["start"];
  let at = "start";
  while (at !== "end" && ids.length < 20) {
    const out = edges.filter((e) => e.from_node.$component_ref === at);
    let next;
    if (refs[at]?.component_type === "BranchingNode") {
      const branch = refs[at].mapping?.[road] ?? "default";
      next = out.filter((e) => e.from_branch === branch);
    } else {
      next = out;
    }
    assert.equal(next.length, 1, `node ${at} has ${next.length} way(s) on for the road ${road}`);
    at = next[0].to_node.$component_ref;
    ids.push(at);
  }
  return ids;
}

test("(14) a schema handed over directly never reaches the read", () => {
  assert.equal(refs.schema_road?.template, SCHEMA_ROAD, "the road is not chosen by the schema and its source");
  assert.ok(!("given" in (refs.schema_source.mapping ?? {})), "a given schema is mapped to a branch");
  const ids = walk("given");
  assert.deepEqual(ids, ["start", "schema_road", "schema_source", "extract", "end"]);
  assert.deepEqual(
    ids.filter((id) => refs[id]?.component_type === "ApiNode" && String(refs[id].url).includes(PASSTHROUGH)),
    [],
    "a given schema is read again",
  );
});

test("(14) a schema artifact is read before the scrape", () => {
  assert.equal(refs.schema_source?.mapping?.artifact, "artifact");
  assert.deepEqual(walk("artifact"), ["start", "schema_road", "schema_source", "schema_ref", "read_schema", "extract", "end"]);
  assert.equal(refs.schema_ref.template, "{{ outputSchemaSource.ref }}");
  const read = refs.read_schema;
  assert.ok(read.url.endsWith("/api/agents/passthrough"), "the read does not go through the passthrough");
  assert.deepEqual(read.data, {
    tool: "artifact_content_read",
    input: { artifactId: "{{ schemaArtifactId }}" },
    agent_run_id: "{{ cinatra_run_id }}",
  });
  assert.ok(
    (oas.data_flow_connections ?? []).some(
      (e) =>
        e.source_node.$component_ref === "read_schema" &&
        e.source_output === "text" &&
        e.destination_node.$component_ref === "extract" &&
        e.destination_input === "schemaText",
    ),
    "the schema that was read never reaches the step",
  );
  const schemaText = extract.inputs.find((i) => i.title === "schemaText");
  assert.equal(schemaText?.default, "", "the step has no schema text when nothing was read");
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(
    (pkg.cinatra.dependencies ?? []).some((d) => d.kind === "artifact"),
    "the package declares no artifact kind, so the read is not admitted",
  );
});

test("(14) a schema file is given as the artifact it becomes when it is uploaded", () => {
  assert.deepEqual(refs.schema_source.branches, ["default", "artifact"]);
  assert.deepEqual(refs.schema_source.mapping, { artifact: "artifact" });
  assert.equal("schema_not_read" in refs, false, "the ending for a file source is still declared");
  assert.deepEqual(
    (oas.nodes ?? []).map((n) => n.$component_ref).filter((id) => !(id in refs)),
    [],
    "the flow names a node it does not declare",
  );
  assert.deepEqual(
    (oas.control_flow_connections ?? [])
      .filter((e) => e.from_branch === "file" || !(e.to_node.$component_ref in refs))
      .map((e) => e.name),
    [],
    "a control edge still takes a file road or leads to an undeclared node",
  );
  assert.ok(!JSON.stringify(oas).includes("not read yet"), "the flow still says a schema file is not read yet");
  for (const inputs of [start.inputs, oas.inputs]) {
    const source = inputs.find((i) => i.title === "outputSchemaSource");
    assert.ok(
      source.description.includes("A schema file becomes such an artifact when it is uploaded to the Artifacts library"),
      "the source does not say how a schema file is given",
    );
  }
  for (const outputs of [refs.end.outputs, oas.outputs]) {
    for (const o of outputs) assert.ok("default" in o, `the output ${o.title} has no default`);
  }
});

test("(14) every tool a step's text names is one the flow can reach", () => {
  const offenders = new Set();
  const texts = [];
  for (const comp of Object.values(refs)) {
    if (comp?.component_type !== "ApiNode") continue;
    for (const text of [comp.data?.system, comp.data?.user]) if (typeof text === "string") texts.push(text);
    if (!String(comp.url).includes(LLM_BRIDGE)) continue;
    const tools = new Set(comp.data?.toolbox_ids ?? []);
    for (const text of [comp.data?.system ?? "", comp.data?.user ?? ""]) {
      for (const line of text.split("\n")) {
        // A prohibition excuses only its own sentence, never a call named
        // beside it on the same line.
        for (const sentence of line.split(/(?<=[.!?])\s+/)) {
          if (sentence.includes("Do not call") || sentence.includes("Do NOT call")) continue;
          for (const token of sentence.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? []) if (!tools.has(token)) offenders.add(token);
        }
      }
    }
  }
  assert.deepEqual([...offenders], [], "a step's text names a tool its node cannot reach");
  for (const text of texts) assert.ok(!text.includes("read the file"), "a step's text asks for a file read");
  for (const comp of Object.values(refs)) {
    if (comp?.component_type !== "ApiNode" || !String(comp.url).includes(PASSTHROUGH)) continue;
    assert.ok(PASSTHROUGH_TOOLS.includes(comp.data?.tool), `${comp.id} calls ${comp.data?.tool}, which the passthrough does not serve`);
  }
});
