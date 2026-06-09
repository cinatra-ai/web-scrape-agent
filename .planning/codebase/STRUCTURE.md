# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
web-scrape-agent/
├── cinatra/
│   └── oas.json              # Cinatra Flow definition (StartNode, ApiNode, EndNode, data/control flow edges)
├── skills/
│   └── web-scrape-agent/
│       └── SKILL.md          # LLM system prompt — crawl rules, extraction rules, output contract
├── .github/
│   └── workflows/
│       ├── ci.yml            # CI: install, typecheck, pack dry-run, kind-gates
│       └── release.yml       # Release pipeline
├── extension-kind-gate.mjs   # Zero-dependency CI gate (agent OAS scan + workflow BPMN validation)
├── package.json              # npm package manifest with cinatra metadata block
├── tsconfig.json             # TypeScript config (present; no TS source files tracked — content-only extension)
├── .npmrc                    # npm registry config (existence noted; contents not read)
├── LICENSE                   # Apache-2.0
└── README.md                 # User-facing documentation
```

## Directory Purposes

**`cinatra/`:**
- Purpose: Cinatra platform artefacts — the machine-readable flow definition consumed by the Cinatra runtime and marketplace
- Contains: `oas.json` (agentspec v26.1.0 Flow document with nodes, edges, input/output schemas, LLM config)
- Key files: `cinatra/oas.json`

**`skills/web-scrape-agent/`:**
- Purpose: LLM skill / system-prompt package for the extraction agent
- Contains: `SKILL.md` — the complete behavioural specification injected as the LLM system prompt by the bridge (auto-discovered via `agent_id: web-scrape-agent`)
- Key files: `skills/web-scrape-agent/SKILL.md`

**`.github/workflows/`:**
- Purpose: GitHub Actions CI/CD
- Contains: `ci.yml` (pre-publish validation: classify repo, optional install/typecheck/test, pack dry-run, kind-gate), `release.yml` (release pipeline)
- Key files: `.github/workflows/ci.yml`, `.github/workflows/release.yml`

## Key File Locations

**Flow Definition (entry point for Cinatra runtime):**
- `cinatra/oas.json`: Full agentspec Flow document — nodes, edges, input/output declarations, LLM provider preference, toolbox binding

**LLM Behaviour Specification:**
- `skills/web-scrape-agent/SKILL.md`: System prompt — tool discipline, bounded crawl rules, extraction rules, failure-handling protocol, output JSON envelope format with worked example

**CI Gate:**
- `extension-kind-gate.mjs`: Self-contained Node.js ESM script; exports `validateAgent`, `validateWorkflow`, `validateBpmnSanity`, `runGate`, `parseArgs`; invoked directly by CI (`node extension-kind-gate.mjs --package-root .`)

**Package Manifest:**
- `package.json`: npm package identity (`@cinatra-ai/web-scrape-agent@0.1.0`), `cinatra` metadata block (kind, packageType, riskLevel, toolAccess, sourceTemplateId), Apache-2.0 license

**TypeScript Config:**
- `tsconfig.json`: Present for CI typecheck step; no `.ts` source files are tracked — this is a content-only extension

## Naming Conventions

**Files:**
- Cinatra platform artefacts: `cinatra/<type>.json` (e.g., `cinatra/oas.json`)
- Skills: `skills/<agent-id>/SKILL.md` — kebab-case agent ID directory, UPPERCASE filename
- Gate script: `extension-kind-gate.mjs` — kebab-case, `.mjs` suffix for ESM
- Workflows: `.github/workflows/<name>.yml` — lowercase kebab-case

**Directories:**
- Skill directories match the `agent_id` value used in the ApiNode's `data.agent_id` field (`web-scrape-agent`)
- Top-level: flat; no `src/` directory — this is a content-only / configuration-only package

## Where to Add New Code

**Modify extraction behaviour (crawl rules, output contract, tool discipline):**
- Edit: `skills/web-scrape-agent/SKILL.md`

**Change flow topology (add nodes, change inputs/outputs, update LLM model):**
- Edit: `cinatra/oas.json`

**Add a new skill variant or sub-agent:**
- Create: `skills/<new-agent-id>/SKILL.md`
- Register new `agent_id` in corresponding ApiNode in `cinatra/oas.json`

**Extend CI validation (new banned primitives, new kind-specific gate):**
- Edit: `extension-kind-gate.mjs` — add to `BANNED_PRIMITIVES` or `BANNED_TYPEHINTS` arrays, or add a new `validate<Kind>` export and wire it in `runGate`

**Add TypeScript utilities (if this repo ever gains executable code):**
- Place under a new top-level `src/` directory (no convention established yet — none exist)
- Register a `typecheck` script in `package.json` to opt into the CI typecheck step

## Special Directories

**`.planning/`:**
- Purpose: GSD planning and codebase map documents
- Generated: Yes (by GSD tools)
- Committed: Project-dependent; not in `.gitignore` by default

**`.github/`:**
- Purpose: GitHub Actions workflow definitions
- Generated: No (authored)
- Committed: Yes

---

*Structure analysis: 2026-06-09*
