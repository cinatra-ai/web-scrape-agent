# Web Scrape Agent

Point this agent at a handful of web pages and a description of the shape of data you want — company directories, event speaker lists, batch pages, board rosters — and get back clean structured rows ready to feed into a list, a CRM, or a downstream agent. You stay in control of the shape; the agent does the visiting and extracting.

Install via the Cinatra marketplace by adding `@cinatra-ai/web-scrape-agent` as a dependency in your workspace. No credentials or API keys are required beyond your Cinatra workspace access — the agent uses the built-in `web_search` tool to fetch pages.

Call the agent with three required inputs: `seedUrls` (an array of one or more page URLs to start from), `outputSchema` (a JSON Schema object describing the shape of each extracted item), and `instructions` (a short plain-English description of what to pull from each page). Optional inputs let you cap the total URLs visited (`maxUrls`, default 50, hard ceiling 200), enable same-origin link following (`followLinks`, default false), and set the follow depth (`maxDepth`, default 1, hard ceiling 3). The agent returns `items` (extracted rows), `sourceUrls` (every URL actually visited), `extractionNotes` (a short crawl summary), and `failures` (per-URL error records for any page that could not be fetched or yielded no matching items).

If a page is unreachable, JS-rendered without static content, or yields no schema-conforming items, the agent records it in `failures` and continues — it never silently drops a URL. If the response looks empty or incomplete, check the `failures` array first; a non-empty list shows exactly which URLs were skipped and why.

## Works with

- The open web (via web search)

## Capabilities

- Extract structured rows from a list of seed URLs
- Conform every row to a JSON Schema you supply
- Follow same-origin links to a bounded depth when you ask it to
- Deduplicate the same entity across multiple pages
- Attach a source URL to every extracted row
- Record per-URL failures so nothing is silently dropped
