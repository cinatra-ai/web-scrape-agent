# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**Cinatra LLM Bridge:**
- Service: Cinatra platform internal API — `/api/llm-bridge`
- What it does: Accepts `agent_id`, a Jinja2-rendered `user` prompt, LLM preferences, and `toolbox_ids`; discovers the agent's `SKILL.md` by `agent_id`; runs the LLM with the specified tools; returns structured output
- SDK/Client: Direct HTTP POST via Cinatra ApiNode (defined in `cinatra/oas.json` under `$referenced_components.extract`)
- Auth: Platform-managed; `CINATRA_BASE_URL` env var provides the base endpoint
- Spec reference: `cinatra/oas.json` — `extract` ApiNode, `url: "{{CINATRA_BASE_URL}}/api/llm-bridge"`

**OpenAI:**
- Service: OpenAI LLM API
- What it does: Provides the language model used by the LLM Bridge to perform web scraping and data extraction
- Preferred model: `gpt-5.5` (declared in `cinatra/oas.json` under `metadata.cinatra.llm.preferredModel`)
- Preferred provider: `openai` (declared in `cinatra/oas.json` under `metadata.cinatra.llm.preferredProvider`)
- Auth: Managed by the Cinatra platform LLM Bridge — not configured directly in this repo

**Web Search (Cinatra Toolbox):**
- Service: `web_search` toolbox — Cinatra-managed tool that fetches and parses web page content
- What it does: The primary data-fetching mechanism; the LLM calls `web_search` for each seed URL and any followed links to retrieve HTML/JSON/CSV content
- Config: Declared in `cinatra/oas.json` under `metadata.cinatra.toolboxes: ["web_search"]` and `data.toolbox_ids: ["web_search"]`
- Auth: Platform-managed toolbox; no credentials in this repo
- Constraint (from `skills/web-scrape-agent/SKILL.md`): Agent is explicitly forbidden from calling MCP primitives (`contacts_*`, `accounts_*`, `objects_*`, `lists_*`, `scrape_*`); ONLY `web_search` is permitted

## Data Storage

**Databases:**
- Not applicable — this agent is explicitly stateless. `SKILL.md` prohibits any `objects_save` calls or MCP write primitives.

**File Storage:**
- Not applicable

**Caching:**
- Not applicable

## Authentication & Identity

**Auth Provider:**
- Cinatra platform — all authentication is handled by the LLM Bridge and platform runtime. No auth configuration exists in this repo.

## Monitoring & Observability

**Error Tracking:**
- Not detected — errors are surfaced via the agent's `failures` output field (per-URL failure records returned in the JSON envelope), not an external monitoring service

**Logs:**
- Not applicable at the repo level — logging is handled by the Cinatra platform runtime

## CI/CD & Deployment

**Hosting:**
- Cinatra Marketplace (`registry.cinatra.ai`) — the published package is submitted via the marketplace MCP proxy (extension-submit-for-review → approve → promotion saga)

**CI Pipeline:**
- GitHub Actions — `.github/workflows/ci.yml` (push/PR gate) and `.github/workflows/release.yml` (release trigger)
- Release workflow delegates to `cinatra-ai/.github/.github/workflows/reusable-extension-release.yml@main` via `uses:` — the org-level reusable workflow handles build provenance attestation and submission
- CI gate for agent kind: `extension-kind-gate.mjs` validates `cinatra/oas.json` for retired CRM primitives in LLM-visible prompt strings

## Environment Configuration

**Required env vars:**
- `CINATRA_BASE_URL` — base URL for the Cinatra platform API; injected by the platform at runtime; referenced in `cinatra/oas.json`

**Secrets location:**
- `CINATRA_MARKETPLACE_VENDOR_TOKEN` — org-level GitHub Actions secret; used by the release workflow via `secrets: inherit`; never present in this repo's files
- `.env` file: Not detected

## Webhooks & Callbacks

**Incoming:**
- Not applicable — this is a flow-type agent invoked by the Cinatra runtime, not an HTTP server

**Outgoing:**
- Not applicable — all outbound HTTP is performed by the Cinatra LLM Bridge on behalf of the agent via the `web_search` toolbox

---

*Integration audit: 2026-06-09*
