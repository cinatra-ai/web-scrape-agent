# Coding Conventions

**Analysis Date:** 2026-06-09

## Overview

This is a content-only Cinatra agent extension. The sole runtime code file is `extension-kind-gate.mjs` — a self-contained Node.js ESM script with zero npm dependencies. There is no `src/` directory. The agent behavior itself is defined via `skills/web-scrape-agent/SKILL.md` (a structured Markdown prompt) and `cinatra/oas.json` (OAS spec).

## Naming Patterns

**Files:**
- `kebab-case` for all files: `extension-kind-gate.mjs`, `web-scrape-agent/SKILL.md`
- `.mjs` extension for standalone ESM scripts (not `.js`) to avoid ambiguity with `"type": "module"` in `package.json`
- Cinatra artifacts live under `cinatra/`: `cinatra/oas.json`
- Skills live under `skills/<skill-name>/SKILL.md`

**Functions:**
- `camelCase` for all exported and internal functions: `parseArgs`, `validateAgent`, `validateWorkflow`, `runGate`, `walkLlmStrings`, `scanOasString`, `findWorkflowSidecars`, `validateBpmnSanity`, `validateWorkflowPackageShape`
- Internal helpers use descriptive verb-noun naming: `wordBoundary`, `prefixOf`, `localOf`

**Variables:**
- `camelCase` for local variables and function-scoped state
- `SCREAMING_SNAKE_CASE` for module-level constants: `LLM_VISIBLE_FIELDS`, `BANNED_PRIMITIVES`, `BANNED_TYPEHINTS`, `PRIMITIVE_PATTERNS`, `OBJECTS_LIST_CRM_RE`, `BPMN_MODEL_NS`, `WORKFLOW_PACKAGE_NAME_RE`

**Types:**
- Not applicable — `extension-kind-gate.mjs` is plain JavaScript (no TypeScript). The `tsconfig.json` targets a `src/` directory that does not exist in this repo, making it a placeholder for potential future TypeScript sources.

## Code Style

**Formatting:**
- No formatter config file detected (no `.prettierrc`, `.eslintrc`, `biome.json`). Style is enforced by the monorepo upstream before extraction.
- Indentation: 2 spaces (consistent throughout `extension-kind-gate.mjs`)
- Strings: double quotes for most string literals; template literals where interpolation is needed
- Trailing commas present in multi-line arrays and object literals

**Linting:**
- No standalone linter config detected. Linting is owned by the monorepo that extracts this repo.

## Import Organization

**Order (as seen in `extension-kind-gate.mjs`):**
1. Node built-in modules only — `node:fs`, `node:path`
2. No third-party or local imports

**Path Aliases:**
- None. Explicit `node:` protocol prefix used for all built-ins: `import { readFileSync, existsSync, readdirSync } from "node:fs"`.

## Error Handling

**Patterns:**
- Functions return `string[]` error arrays (pure, no throws): `validateAgent`, `validateWorkflow`, `validateBpmnSanity`, `validateWorkflowPackageShape` all return collected errors, never throw.
- `try/catch` wraps all I/O operations (file reads); caught errors are pushed into the errors array as strings: `err instanceof Error ? err.message : String(err)`.
- Early return on fatal precondition failure (e.g., missing OAS file returns `[]`, missing BPMN file appends error and returns immediately).
- `main()` is the only function that calls `process.exit()`. All other functions are pure and side-effect-free.
- Agent SKILL.md mandates a "NEVER ABORT" failure-handling policy: every URL failure is recorded in a `failures` array and execution continues — this mirrors the pure-accumulator pattern in the gate code.

## Logging

**Framework:** `console.log` / `console.error` (no logging library)

**Patterns:**
- Success: `console.log(...)` with a checkmark prefix (`✓ extension-kind-gate: ...`)
- Failure: `console.error(...)` with a cross prefix (`✗ extension-kind-gate: N violations`)
- Each violation is listed with a bullet: `  • <message>`
- Only `main()` logs; all validator functions are silent (pure).

## Comments

**When to Comment:**
- Section headers using dashed-line banners (`// ----------`) to separate logical blocks within `extension-kind-gate.mjs`
- Inline comments explain non-obvious decisions: regex choices, namespace URI semantics, why certain checks are deferred to marketplace-side validation
- JSDoc-style block comments on exported functions (using `/** */`) describe purpose, purity, and return type

**JSDoc/TSDoc:**
- Used on exported functions only: `validateAgent`, `validateBpmnSanity`, `validateWorkflow`, `findWorkflowSidecars`, `runGate`
- Style is plain JSDoc prose — no `@param`/`@returns` tags, just descriptive block comments

## Function Design

**Size:** Functions are focused and short (10–60 lines). Large validators are broken into pure helper sub-functions.

**Parameters:** Prefer simple primitives or plain objects. No class instances.

**Return Values:** Validators always return `string[]`. The gate dispatcher returns `{ kind, errors }`. `main()` returns `void` and calls `process.exit`.

## Module Design

**Exports:** Named exports for all testable functions. `main()` is not exported. The file guards direct invocation with `invokedDirectly` check so it can be both imported (for tests) and run directly.

**Barrel Files:** Not applicable — single-file module.

## Agent Prompt Conventions (SKILL.md)

The `skills/web-scrape-agent/SKILL.md` prompt follows Cinatra's structured system-prompt format:
- YAML frontmatter with `name` and `description` fields
- Markdown sections with bold-label discipline rules (`**Use the web_search tool ONLY.**`)
- Explicit numbered extraction rules
- A concrete JSON output envelope schema with field-by-field documentation
- A worked example with abbreviated JSON output
- Statelessness constraint stated explicitly at the end

---

*Convention analysis: 2026-06-09*
