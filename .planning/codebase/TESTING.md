# Testing Patterns

**Analysis Date:** 2026-06-09

## Overview

This repo has no standalone test suite. It is a content-only Cinatra agent extension extracted from the cinatra monorepo. The monorepo owns all unit and integration tests for the gate logic and the agent OAS. The CI workflow (`extension-kind-gate.mjs`) itself serves as the functional gate during CI runs.

## Test Framework

**Runner:** Not applicable — no test files or test runner configuration detected.

**Assertion Library:** Not applicable.

**Run Commands:**
```bash
# CI runs this (no test script in package.json):
corepack pnpm test --if-present   # no-ops; no test script present

# The effective "test" for this repo is the kind gate:
node extension-kind-gate.mjs --package-root .
```

## Test File Organization

**Location:** No test files exist in this repo (`*.test.*`, `*.spec.*` — none found).

**Naming:** Not applicable.

## Test Structure

**What CI validates instead of unit tests:**

1. **Dependency-shape gate** (`.github/workflows/ci.yml` `build` job, "Classify repo" step): Asserts no `@cinatra-ai/*` packages leaked into `dependencies`/`devDependencies`/`optionalDependencies`. First-party packages must be optional `peerDependencies` only.

2. **Agent OAS validation gate** (`.github/workflows/ci.yml` `kind-gates` job, "Agent OAS validation gate" step): Runs `node extension-kind-gate.mjs --package-root .`, which:
   - Parses `cinatra/oas.json`
   - Walks all LLM-visible OAS fields (`system`, `user`, `description`)
   - Fails if any retired CRM primitive (`lists_*`, `accounts_*`, `contacts_*`) appears
   - Fails if deprecated entity typeHints (`@cinatra-ai/entity-accounts:account`, `@cinatra-ai/entity-contacts:contact`) appear
   - Fails if `objects_list` is used over a CRM entity type

3. **Pack dry-run** (`npm pack --dry-run`): Validates package shape and publish payload without resolving peers.

## Mocking

**Framework:** Not applicable — no test suite.

**Patterns:** The gate functions in `extension-kind-gate.mjs` are designed to be pure (string in → string[] out) specifically to enable testing without mocking I/O. The `invokedDirectly` guard allows importing the module in a test environment without triggering `main()`:

```javascript
// Importable without side effects:
import { validateAgent, validateBpmnSanity, validateWorkflow } from "./extension-kind-gate.mjs";

// Pure functions — no filesystem mocks needed if XML/JSON passed as strings:
validateBpmnSanity("<bpmn:definitions ...>...</bpmn:definitions>");
validateAgent("/path/to/package-root");  // reads filesystem; would need fs mock
```

## Fixtures and Factories

**Test Data:** Not applicable — no test suite.

**Location:** `cinatra/oas.json` is the live fixture used by the CI gate. Its contents are validated on every push/PR.

## Coverage

**Requirements:** Not enforced — no coverage tooling configured.

**View Coverage:** Not applicable.

## Test Types

**Unit Tests:** Not present in this repo. The monorepo (upstream) contains unit tests for `extension-kind-gate.mjs` exports since those functions are pure and straightforwardly testable.

**Integration Tests:** Not applicable.

**E2E Tests:** Not applicable.

## CI as Quality Gate

The CI pipeline (`.github/workflows/ci.yml`) acts as the sole automated quality gate:

| Check | Tool | Trigger |
|-------|------|---------|
| First-party dep shape | inline `node -e` script | push/PR to `main` |
| TypeScript typecheck | `tsc --noEmit` via `npx` | push/PR (skipped — no `src/`) |
| Test suite | `pnpm test --if-present` | push/PR (no-op — no test script) |
| Pack dry-run | `npm pack --dry-run` | push/PR to `main` |
| Agent OAS gate | `node extension-kind-gate.mjs` | push/PR to `main` (kind-gates job) |
| Release publish | reusable workflow | GitHub Release event |

## Common Patterns

**Async Testing:** Not applicable.

**Error Testing:** Not applicable.

## Adding Tests

If tests are added to this repo in the future:
- Place test files alongside the file under test: `extension-kind-gate.test.mjs`
- Use Node's built-in `node:test` runner (zero dependencies, consistent with the "self-contained, zero-dependency" constraint stated in `extension-kind-gate.mjs`)
- Add a `"test": "node --test"` script to `package.json`
- Pure functions (`validateBpmnSanity`, `validateWorkflowPackageShape`) need no mocking — pass strings/objects directly
- Filesystem-reading functions (`validateAgent`, `validateWorkflow`, `findWorkflowSidecars`) require either a temp-dir fixture or `node:test` mock.module for `node:fs`

---

*Testing analysis: 2026-06-09*
