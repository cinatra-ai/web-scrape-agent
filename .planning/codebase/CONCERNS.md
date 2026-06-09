# Codebase Concerns

**Analysis Date:** 2026-06-09

## Tech Debt

**Agent kind field mismatch in package.json:**
- Issue: `package.json` declares `cinatra.packageType: "agent"` but no `cinatra.kind` field at all. The CI gate in `extension-kind-gate.mjs` reads `pkg?.cinatra?.kind` to dispatch — for this repo it resolves to `undefined`, causing the gate to fall through to the "pass (no kind-specific gate)" branch for unknown kinds. The `cinatra-agent` OAS validation path (`validateAgent`) is therefore never formally triggered via `runGate`, even though the agent OAS gate step in `.github/workflows/ci.yml` invokes `extension-kind-gate.mjs --package-root .` directly.
- Files: `package.json`, `.github/workflows/ci.yml`, `extension-kind-gate.mjs`
- Impact: If the CI `kind-gates` job ever relies on `runGate` dispatch (e.g., if the step is refactored to not call the gate directly), the agent OAS validation silently passes rather than running. Also misleads any tooling that reads `cinatra.kind` to classify the package.
- Fix approach: Add `"kind": "agent"` to the `cinatra` block in `package.json` alongside `packageType`.

**`tsconfig.json` targets a non-existent `src/` directory:**
- Issue: `tsconfig.json` sets `"rootDir": "src"` and `"include": ["src/**/*.ts", "src/**/*.tsx"]` but the repo has no `src/` directory — this is a pure content-only extension (SKILL.md + `cinatra/oas.json`). The CI workflow already detects this condition and skips typecheck with "No TypeScript sources tracked", but the leftover tsconfig is misleading and would produce `TS18003 No inputs were found` if someone ran `tsc` locally.
- Files: `tsconfig.json`
- Impact: Developer confusion; local `tsc` invocations error. The `"noEmit": false` + `"declaration": true` settings are also nonsensical for a content-only package.
- Fix approach: Either remove `tsconfig.json` entirely (content-only extension) or replace it with a minimal no-src config that only validates the gate script (`extension-kind-gate.mjs`).

**`extension-kind-gate.mjs` is a duplicated vendored file:**
- Issue: The gate script is described in its own header as being "shipped INTO each extracted agent/workflow repo by the extraction script". It lives at `extension-kind-gate.mjs` and is expected to stay in lock-step with `scripts/audit/oas-banned-primitives-gate.mjs` in the upstream monorepo. Any update to the banned-primitive rules in the monorepo requires a re-extraction or a manual file update here; there is no automated mechanism in this repo to detect drift.
- Files: `extension-kind-gate.mjs`
- Impact: The banned-primitive rule set may silently diverge from the monorepo. A new retired CRM primitive added monorepo-side would not be caught by this repo's CI until the file is re-synced.
- Fix approach: Document the sync requirement in README, or automate re-sync via a Dependabot-style scheduled job that copies the canonical gate file.

**`cinatra/oas.json` references a non-public model (`gpt-5.5`):**
- Issue: `cinatra/oas.json` specifies `"preferredModel": "gpt-5.5"` in two places (top-level metadata and the ApiNode data). At analysis time `gpt-5.5` is not a generally available OpenAI model name; this may be an internal alias. If the model alias is ever retired or renamed, the agent will silently fall back to whatever the platform default is, with no error surfaced in the OAS or CI gate.
- Files: `cinatra/oas.json`
- Impact: Silent model substitution at runtime; no validation of model name correctness in the gate.
- Fix approach: Track model alias lifecycle; add a CI lint step that warns when `preferredModel` is not a known-good alias.

## Known Bugs

**No bugs explicitly documented.** The repo contains no test suite, TODO/FIXME markers, or issue references.

## Security Considerations

**Caller-supplied `outputSchema` passed directly to LLM without sanitization:**
- Risk: `outputSchema` is a free-form `object` (no JSON Schema validation of the schema itself) injected verbatim into the LLM prompt via the Jinja2 template in `cinatra/oas.json`. A malicious or malformed schema could contain prompt-injection payloads in property names, descriptions, or enum values.
- Files: `cinatra/oas.json` (ApiNode `data.user` field)
- Current mitigation: The `riskLevel: "low"` and `requiresApproval: false` metadata indicates the platform considers this read-only. The SKILL.md instructs the LLM to treat `outputSchema` as data, not instructions.
- Recommendations: Apply server-side sanitization of `outputSchema` values before they reach the LLM prompt. Treat `outputSchema` as untrusted input. Consider adding `hasApprovalGates: true` or a confirmation step when `followLinks: true` and `maxUrls` is large.

**`followLinks: true` enables same-origin crawling with no blocklist:**
- Risk: When a caller enables `followLinks: true`, the agent follows any `<a>` link on seed pages up to `maxDepth` levels deep (hard ceiling: 3) and up to `maxUrls` URLs (hard ceiling: 200). There is no URL-pattern blocklist or robots.txt compliance requirement in SKILL.md. A seed page with many internal links could cause the agent to visit sensitive internal pages if credentials are passed via the search tool context.
- Files: `skills/web-scrape-agent/SKILL.md`
- Current mitigation: Same-origin enforcement (host equality). `maxUrls` hard ceiling of 200.
- Recommendations: Add a robots.txt compliance note to SKILL.md. Consider adding a URL allowlist/blocklist input parameter.

**`.npmrc` is committed to the repository:**
- Risk: `.npmrc` is committed. Currently only contains `auto-install-peers=false` with no tokens, but any future addition of a registry token or auth token to this file would expose secrets in git history.
- Files: `.npmrc`
- Current mitigation: Current contents are non-sensitive.
- Recommendations: Add `.npmrc` to `.gitignore` for auth-token scenarios, or use GitHub Actions secrets exclusively for registry auth.

## Performance Bottlenecks

**Single-node linear crawl — no parallelism:**
- Problem: The flow is a single `ApiNode` that sends all seed URLs to one LLM call. The LLM fetches URLs sequentially via `web_search`. Large URL lists (up to `maxUrls: 200`) are processed end-to-end in a single synchronous agent turn with no batching or parallel fetch strategy.
- Files: `cinatra/oas.json`, `skills/web-scrape-agent/SKILL.md`
- Cause: Architecture is intentionally stateless and single-step (SKILL.md explicitly says "The caller is responsible for chunking large URL lists").
- Improvement path: Callers should pre-chunk URL lists before invoking the agent. The SKILL.md already documents this expectation but the OAS inputs provide no guidance on recommended chunk sizes.

## Fragile Areas

**LLM output parsing — no structured output enforcement:**
- Files: `cinatra/oas.json`, `skills/web-scrape-agent/SKILL.md`
- Why fragile: The agent returns a free-form JSON envelope by instruction only ("Return EXACTLY this JSON shape"). There is no structured-output / function-calling / response-format enforcement in the OAS or ApiNode configuration. If the LLM includes markdown fences, prose, or a slightly different key spelling, the caller's parser breaks.
- Safe modification: Add `response_format: { type: "json_object" }` or equivalent structured output spec to the ApiNode if the bridge supports it. Add an output validation step.
- Test coverage: No tests exist for output schema conformance.

**`pyagentspec-input-hint` comment dependency in prompt template:**
- Files: `cinatra/oas.json` (ApiNode `data.user`)
- Why fragile: The prompt string contains a special comment `{# pyagentspec-input-hint (do not remove): ... #}` that the platform likely uses to detect which inputs are referenced in the prompt. Editing the prompt template without preserving this comment could silently break input detection in the platform toolchain. There is no documentation in this repo explaining the comment's purpose or consequences of removal.
- Safe modification: Treat the `pyagentspec-input-hint` comment as a required magic token; do not remove or reorder it when editing the prompt.
- Test coverage: No test covers prompt template parsing or hint comment presence.

## Scaling Limits

**`maxUrls` hard ceiling of 200:**
- Current capacity: Up to 200 URLs per invocation, all processed in a single LLM call.
- Limit: Beyond 200 URLs, excess are silently recorded as failures with "URL skipped — maxUrls cap reached". There is no multi-invocation orchestration built into this agent.
- Scaling path: Callers must implement their own batching loop over chunks of seed URLs and merge results.

## Dependencies at Risk

**No npm dependencies — risk: none detected.**
- The package declares no `dependencies`, `devDependencies`, or `optionalDependencies`. The sole runtime dependency is the platform-provided `web_search` tool and the `/api/llm-bridge` endpoint, both external to this repo.

**`gpt-5.5` model pin:**
- Risk: Non-standard model name pinned in `cinatra/oas.json`. If the platform retires or renames this model ID, the agent will silently degrade or fail.
- Impact: All extraction runs use the wrong model with no alerting.
- Migration plan: Update `preferredModel` to the current preferred OpenAI model; add a CI check or changelog entry for model alias changes.

## Missing Critical Features

**No input validation for `maxUrls` and `maxDepth` against hard ceilings:**
- Problem: The OAS `inputs` for `maxUrls` and `maxDepth` are plain integers with only defaults — no `maximum` constraint is declared. A caller can pass `maxUrls: 99999`; the SKILL.md instructs the LLM to honor the 200 hard ceiling, but this is enforced only by LLM instruction, not by the schema or platform.
- Blocks: Guaranteed bounded resource usage.

**No rate-limiting or delay guidance in SKILL.md:**
- Problem: SKILL.md provides no guidance on request pacing, retry logic, or back-off between `web_search` calls. The agent may hit rate limits on the `web_search` tool for large URL lists without any structured retry strategy.
- Blocks: Reliable large-scale crawls.

## Test Coverage Gaps

**No tests exist in this repository:**
- What's not tested: `extension-kind-gate.mjs` exports (`validateAgent`, `validateWorkflow`, `validateBpmnSanity`, `validateWorkflowPackageShape`, `findWorkflowSidecars`, `runGate`, `parseArgs`) are all untested at the repo level. The CI only runs the gate against this repo's own `cinatra/oas.json` — no unit tests for edge cases (malformed OAS, banned primitive variants, BPMN edge cases).
- Files: `extension-kind-gate.mjs`
- Risk: Regressions in gate logic (e.g., false-negative on a newly banned primitive, broken XML parser edge case) go undetected until a downstream repo is incorrectly passed or failed.
- Priority: High — the gate script is the only enforcement mechanism for retired-primitive compliance across all extracted agent repos.

**No integration tests for the scrape agent behavior:**
- What's not tested: The LLM prompt template in `cinatra/oas.json`, the output envelope shape, `sourceUrl` injection, failure recording, deduplication, and `followLinks` behavior are all specified only in SKILL.md prose — no automated tests verify the agent produces correct output for representative inputs.
- Files: `cinatra/oas.json`, `skills/web-scrape-agent/SKILL.md`
- Risk: Prompt edits or SKILL.md revisions can silently break extraction correctness.
- Priority: Medium — LLM behavior tests are difficult to make deterministic, but snapshot/contract tests against the output envelope shape are feasible.

---

*Concerns audit: 2026-06-09*
