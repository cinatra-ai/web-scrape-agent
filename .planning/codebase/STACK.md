# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- TypeScript (ES2023 target) — tsconfig configured but no `src/` TypeScript sources are present; this is a content-only agent extension. All logic is encoded in `cinatra/oas.json` and `skills/web-scrape-agent/SKILL.md`.
- JavaScript (ESM) — `extension-kind-gate.mjs` is a self-contained Node.js CI gate script using only Node built-ins.

**Secondary:**
- JSON — primary artifact format (`cinatra/oas.json` defines the agent flow spec)

## Runtime

**Environment:**
- Node.js 24 (specified in `ci.yml` via `actions/setup-node@v4` with `node-version: "24"`)

**Package Manager:**
- pnpm (via corepack) — `corepack enable` in CI; `.npmrc` sets `auto-install-peers=false`
- Lockfile: Not committed (CI uses `--no-frozen-lockfile`)

## Frameworks

**Core:**
- Cinatra AgentSpec v26.1.0 — the agent flow spec format used in `cinatra/oas.json`; defines Flow, StartNode, ApiNode, EndNode component types
- Cinatra LLM Bridge (`/api/llm-bridge`) — the runtime API that executes this agent

**Testing:**
- Not applicable — no test framework present; this is a content-only extension with no TypeScript sources. CI runs `pnpm test --if-present` which is a no-op.

**Build/Dev:**
- TypeScript compiler (`tsc`) — configured via `tsconfig.json` but skipped in CI because no tracked `.ts` files exist
- `extension-kind-gate.mjs` — self-contained zero-dependency CI gate that validates `cinatra/oas.json` for retired primitive usage

## Key Dependencies

**Critical:**
- None declared in `package.json` — `dependencies`, `devDependencies`, and `peerDependencies` are all absent. This is a pure content/manifest package.

**Infrastructure:**
- `npm pack` (dry run) — used in CI to validate package shape without publishing

## Configuration

**Environment:**
- `CINATRA_BASE_URL` — runtime environment variable injected by the Cinatra platform; referenced in `cinatra/oas.json` as `{{CINATRA_BASE_URL}}/api/llm-bridge`
- `.env` file: Not detected

**Build:**
- `tsconfig.json` — standalone TypeScript config targeting ES2023/ESNext/bundler resolution; outputs to `dist/`, roots at `src/`. Currently unused (no `src/` directory).
- `package.json` — NPM package manifest with Cinatra extension metadata under `cinatra` key

**CI/CD:**
- `.github/workflows/ci.yml` — runs on push/PR to main: dependency shape classification, install, typecheck, test, pack dry-run, then agent OAS gate
- `.github/workflows/release.yml` — triggers on GitHub Release published; delegates to `cinatra-ai/.github` reusable workflow for marketplace submission

## Platform Requirements

**Development:**
- Node.js 24+
- pnpm (via corepack)

**Production:**
- Cinatra platform runtime — agent is executed by the Cinatra LLM Bridge service, not deployed independently. Published to `registry.cinatra.ai` via the Cinatra Marketplace submission pipeline.

---

*Stack analysis: 2026-06-09*
