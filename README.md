# Web Scrape Agent

Point this agent at a handful of web pages and a description of the shape of data you want — company directories, event speaker lists, batch pages, board rosters — and get back clean structured rows ready to feed into a list, a CRM, or a downstream agent. You stay in control of the shape; the agent does the visiting and extracting.

## Works with

- The open web (via web search)

## Capabilities

- Extract structured rows from a list of seed URLs
- Conform every row to a JSON Schema you supply
- Follow same-origin links to a bounded depth when you ask it to
- Deduplicate the same entity across multiple pages
- Attach a source URL to every extracted row
- Record per-URL failures so nothing is silently dropped
