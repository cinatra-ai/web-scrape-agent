<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      Caller / Orchestrator                   │
│              (upstream cinatra workflow or UI)               │
└────────────────────────┬────────────────────────────────────┘
                         │  inputs: seedUrls, outputSchema,
                         │          instructions, maxUrls,
                         │          followLinks, maxDepth
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    StartNode — "Inputs"                      │
│              `cinatra/oas.json` ($referenced_components.start)│
│  Validates required fields; exposes hidden bounds params     │
└────────────────────────┬────────────────────────────────────┘
                         │ DataFlowEdge (all 6 inputs)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          ApiNode — "Extract via /api/llm-bridge"            │
│              `cinatra/oas.json` ($referenced_components.extract)│
│  POST {{CINATRA_BASE_URL}}/api/llm-bridge                   │
│  LLM: openai / gpt-5.5 + web_search toolbox                │
│  System prompt: `skills/web-scrape-agent/SKILL.md`          │
└────────────────────────┬────────────────────────────────────┘
                         │ DataFlowEdge (items, sourceUrls,
                         │               extractionNotes, failures)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    EndNode — "End"                           │
│              `cinatra/oas.json` ($referenced_components.end) │
│  Returns 4-key JSON envelope to caller                      │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| StartNode (`start`) | Declares and validates flow inputs; gates required vs. hidden fields | `cinatra/oas.json` |
| ApiNode (`extract`) | Calls the LLM bridge with a Jinja2-rendered prompt; drives web_search tool; returns structured JSON | `cinatra/oas.json` |
| EndNode (`end`) | Collects outputs and returns them to the caller | `cinatra/oas.json` |
| SKILL.md | LLM system prompt: extraction rules, crawl bounds, failure handling, output schema | `skills/web-scrape-agent/SKILL.md` |
| extension-kind-gate.mjs | Zero-dependency CI gate: validates OAS (agent kind) or BPMN (workflow kind) | `extension-kind-gate.mjs` |

## Pattern Overview

**Overall:** Single-node LLM agent flow (Cinatra `agentspec_version 26.1.0`, `component_type: Flow`).

**Key Characteristics:**
- Fully stateless — no MCP write primitives called, no persistence
- Schema-driven extraction — caller supplies a JSON Schema; LLM must conform every extracted item to it
- Tool-restricted — LLM is granted only the `web_search` toolbox; all CRM/MCP primitives are explicitly forbidden in SKILL.md
- Failure-safe — per-URL failures are accumulated in `failures[]` rather than aborting the run

## Layers

**Flow Definition Layer:**
- Purpose: Declares the agent as a Cinatra Flow with typed inputs/outputs and control/data flow edges
- Location: `cinatra/oas.json`
- Contains: StartNode, ApiNode, EndNode; ControlFlowEdge list; DataFlowEdge list; LLM configuration
- Depends on: Cinatra platform runtime (`{{CINATRA_BASE_URL}}/api/llm-bridge`)
- Used by: Cinatra marketplace / orchestrating workflows

**LLM Behavior Layer:**
- Purpose: Governs what the LLM does — crawl rules, extraction discipline, deduplication, output format
- Location: `skills/web-scrape-agent/SKILL.md`
- Contains: Tool discipline rules, bounded crawl rules, extraction rules, failure-handling protocol, output JSON envelope spec with example
- Depends on: web_search tool availability at runtime
- Used by: ApiNode via `agent_id: web-scrape-agent` (bridge auto-discovers SKILL.md)

**CI Validation Layer:**
- Purpose: Pre-publish sanity gate — scans OAS for banned/retired CRM primitive references in LLM-visible prompt strings
- Location: `extension-kind-gate.mjs`
- Contains: `validateAgent`, `validateWorkflow`, `validateBpmnSanity`, `runGate`, banned-primitive list
- Depends on: Node.js built-ins only (zero external dependencies)
- Used by: `.github/workflows/ci.yml` (`kind-gates` job)

## Data Flow

### Primary Request Path

1. Caller invokes the flow with `seedUrls` (required), `outputSchema` (required), `instructions` (required), and optional `maxUrls` / `followLinks` / `maxDepth` — StartNode (`cinatra/oas.json`, `start` component)
2. All 6 inputs forwarded over DataFlowEdges to the ApiNode (`cinatra/oas.json`, `extract` component)
3. ApiNode renders a Jinja2 prompt (inline in `cinatra/oas.json`, `data.user` field) combining the inputs, then POSTs to `/api/llm-bridge` with `agent_id: web-scrape-agent` and `toolbox_ids: [web_search]`
4. LLM bridge injects SKILL.md as system prompt; LLM uses `web_search` to fetch each seed URL, optionally follows links, and extracts schema-conforming items
5. LLM returns a JSON envelope: `{ items, sourceUrls, extractionNotes, failures }`
6. ApiNode outputs forwarded over DataFlowEdges to EndNode — flow result returned to caller

### Failure Path

1. Any URL that returns 404 / timeout / CAPTCHA / no schema-conforming items → LLM appends an entry to `failures` array and continues
2. No exception raised; full `failures[]` returned in the envelope alongside whatever `items[]` were collected

**State Management:**
- No state. Stateless by design — no objects_save, no MCP write primitive, no session data.

## Key Abstractions

**Output JSON Envelope:**
- Purpose: Standardized 4-key response contract between LLM extraction and caller
- Keys: `items` (schema-conforming extracted records), `sourceUrls` (visited URL log), `extractionNotes` (prose crawl summary), `failures` (per-URL error list)
- Pattern: Defined in `skills/web-scrape-agent/SKILL.md` (spec + example); enforced by ApiNode output declarations in `cinatra/oas.json`

**outputSchema passthrough:**
- Purpose: Allows callers to specify arbitrary item shapes without modifying the agent
- Pattern: Caller provides a JSON Schema object; LLM uses it verbatim to validate each item before including it in `items`

**Bounded Crawl:**
- Purpose: Hard caps prevent unbounded web traversal
- Defaults: `maxUrls=50`, `maxDepth=1`, `followLinks=false`; hard ceilings `maxUrls≤200`, `maxDepth≤3`
- Pattern: Defined in SKILL.md; enforced by LLM instruction

## Entry Points

**Flow Invocation:**
- Location: `cinatra/oas.json` (StartNode, `start` component)
- Triggers: Called by an external orchestrator (Cinatra platform, another workflow, or direct API invocation)
- Responsibilities: Accepts and validates `seedUrls`, `outputSchema`, `instructions` (required) plus optional crawl-bound parameters

**CI Gate:**
- Location: `extension-kind-gate.mjs` (exported `main()` function, invoked via `node extension-kind-gate.mjs --package-root .`)
- Triggers: `.github/workflows/ci.yml`, `kind-gates` job, on every push/PR to `main`
- Responsibilities: Parses `cinatra/oas.json`, walks LLM-visible string fields (`system`, `user`, `description`), fails if any banned CRM primitive is referenced

## Architectural Constraints

- **Stateless:** LLM MUST NOT call `objects_save` or any MCP write primitive (enforced via SKILL.md instructions and OAS primitive scan in CI)
- **Tool restriction:** Only `web_search` toolbox is declared in `cinatra/oas.json` (`metadata.cinatra.toolboxes`); no other tools are injected
- **Preferred LLM:** `openai / gpt-5.5` declared in both `cinatra/oas.json` and the ApiNode's `data.cinatra_llm` field
- **No global state:** No module-level singletons; `extension-kind-gate.mjs` exports pure functions
- **Circular imports:** Not applicable — no import graph beyond Node built-ins in `extension-kind-gate.mjs`
- **URL ceiling:** Hard-coded in SKILL.md: `maxUrls` absolute max 200, `maxDepth` absolute max 3

## Anti-Patterns

### Calling MCP primitives from the LLM

**What happens:** LLM calls `contacts_list`, `accounts_get`, or any other listed CRM primitive directly
**Why it's wrong:** These primitives are reserved for external callers and are retired from internal agent use; they bypass the `crm_*` facade and break CRM routing
**Do this instead:** Use only `web_search` (declared in `toolbox_ids`); route any CRM needs through the `crm_*` facade at the caller level

### Fabricating missing fields

**What happens:** LLM infers or guesses a required `outputSchema` field not found on the page
**Why it's wrong:** Produces data that does not reflect actual page content; corrupts downstream records
**Do this instead:** Omit any item where a required schema field is absent (per SKILL.md extraction rule 3)

## Error Handling

**Strategy:** Accumulate-and-continue — never abort on per-URL failure

**Patterns:**
- Failed URLs appended to `failures[]` with `{ url, error }` shape
- Fetchable but schema-empty URLs also recorded in `failures[]` with `error: "no schema-conforming items found"`
- `failures` is never null; `[]` when all URLs succeeded

## Cross-Cutting Concerns

**Logging:** `extractionNotes` field in output envelope provides a 1–3 sentence crawl summary (not structured logging)
**Validation:** Caller-supplied `outputSchema` (JSON Schema) governs item shape; SKILL.md rules govern agent behavior; CI gate (`extension-kind-gate.mjs`) validates OAS at publish time
**Authentication:** Not applicable within the agent — auth is a platform/caller concern handled by the Cinatra runtime before flow invocation

---

*Architecture analysis: 2026-06-09*
