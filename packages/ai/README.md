# Neuve review harness

This package owns the EVE agent, Gemini provider, prompts, tools and evaluations. The BFF owns review authority and editor comment delivery. The [review vocabulary](../../../../vocabulary.md) distinguishes contextual briefings from dispositions; a generated briefing cannot approve a unit.

| Input or output | Owner |
| --- | --- |
| Pinned committed repository query | Native EVE MCP connection to the local CLI SSE server |
| Captured query record | Successful MCP result hook, then backend SQLite storage |
| Generated briefing | Gemini structured output, then backend citation and revision validation |
| Unit lane and review authority | Backend trusted registration |
| Comment delivery | Backend ACP client |

Run commands from this package directory with Bun. Set server-only `GEMINI_KEY`, `NEUVE_HARNESS_TOKEN` and `NEUVE_MCP_TOKEN`. `NEUVE_BFF_URL` defaults to `http://127.0.0.1:3000`; `NEUVE_MCP_URL` defaults to `http://127.0.0.1:4318/sse`. `NEUVE_GEMINI_MODEL` overrides the available `gemini-3.8-flash` default. Credentials must stay in the server environment, outside authored agent instructions.

- `bun --env-file=../../.env.local run dev` starts the EVE development UI.
- `bun --env-file=../../.env.local run build:harness` builds the independent EVE service.
- `bun run typecheck` checks the package.
- `bun run verify` exercises concurrent circuit recovery and cancellation.
- `bun --env-file=../../.env.local run eval` runs the Gemini authority evaluation.

EVE requests require the `NEUVE_HARNESS_TOKEN` bearer capability. The native MCP connection exposes only `neuve_query`; default filesystem, shell and web tools are disabled. Query captures originate from successful native connection results, rather than model-copied payloads. Capture-hook failures cancel the active turn. Generated citations must remain within exact captured source-evidence excerpt ranges for the registered repository revision. The CLI adds pinned blob excerpts as source evidence when available. Query metadata alone cannot support quotations or verification; citations require captured excerpt text.

Provider model calls share a circuit with one recovery probe after an outage. Request-owned leases prevent older completions from releasing a newer probe. Cancellation releases its lease. Backend domain rejections retain a typed status and do not count toward outage failures.
