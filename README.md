# SF6 Sensei

An unofficial MCP server that lets ChatGPT and Claude answer **Street Fighter 6 frame data** questions in natural language.

- **MCP endpoint:** `https://sf6-sensei-mcp.msnsgw.workers.dev/`
- **Setup guide & docs:** **https://sf6-sensei.pages.dev/**

> Unofficial, non-commercial fan project. Not affiliated with Capcom.

## What it is

SF6 Sensei serves Street Fighter 6 frame data over the [Model Context Protocol](https://modelcontextprotocol.io/). Register it as a connector in ChatGPT or Claude and ask things like *"What's the startup of Juri's crouching HP?"* or *"I blocked this move — is it punishable?"* in plain language (English or Japanese).

The endpoint is read-only and needs no authentication.

> [!NOTE]
> MCP tools do **not** fire in ChatGPT / Claude realtime Voice Mode. Use voice dictation in the **text chat** instead. See the setup guide for details.

## Connect

Paste the MCP URL into your client's custom connector (auth: none):

```
https://sf6-sensei-mcp.msnsgw.workers.dev/
```

- **ChatGPT** — Settings → Connectors → Create → paste the URL → Authless.
- **Claude** — Connectors → Add custom connector → paste the URL.

Full step-by-step instructions (with screenshots): **https://sf6-sensei.pages.dev/**

Health check: `GET https://sf6-sensei-mcp.msnsgw.workers.dev/health`

## Tools

| Tool | Description |
| --- | --- |
| `get_move` | Look up a move's frame data by character + name / input / alias. |
| `get_character_frame_data` | Return all moves for a character. |
| `search_moves` | Search moves across the roster by startup, category, properties, etc. |
| `find_punish` | Suggest punish candidates from a move's on-block advantage (candidates only). |
| `list_characters` | List the available characters. |

> `find_punish` only **suggests** candidates — it does not account for range, distance, or situation, so it is not a complete punish check.

## Architecture (pnpm monorepo)

A build-time data pipeline; there is no external I/O at runtime (the generated JSON is inlined into the Worker).

```
SuperCombo Wiki (CC-BY-SA)
  └─ apps/scraper ── fetch + normalize ──► packages/data (generated per-character JSON)
       packages/core (zod schemas = single source of truth) ──┘
            └─ apps/mcp-server serves 5 tools (Hono on Cloudflare Workers)
```

- `apps/mcp-server` — MCP endpoint (Hono on Cloudflare Workers): root `/` (Streamable HTTP) + `/health`.
- `apps/scraper` — frame data fetch / normalize batch (Node CLI).
- `apps/mcp-docs` — the setup / landing site (Astro), published at <https://sf6-sensei.pages.dev/>.
- `packages/core` — zod schemas, types, input normalization, and move resolution.
- `packages/data` — generated per-character JSON plus manual enrichment layers (Japanese names, aliases, SA levels).
- `packages/biome-config`, `packages/tsconfig` — shared config.

See [`docs/spec.md`](./docs/spec.md) and [`docs/data-model.md`](./docs/data-model.md) for the full design.

## Development

Requires **Node 24** and **pnpm 11** (pinned via `mise.toml`).

```sh
pnpm install
pnpm -r build     # tsc build across packages
pnpm -r test      # vitest
pnpm check        # Biome lint + format check
```

- Regenerate frame data (manual batch): `pnpm --filter @repo/scraper fetch`
- Deploy: see [`docs/deploy.md`](./docs/deploy.md)

## License & attribution

This repository contains two kinds of materials under different licenses (see [`NOTICE`](./NOTICE)):

- **Source code** — [MIT License](./LICENSE).
- **Frame data** (`packages/data`, the generated JSON, and the data returned in MCP responses) — derived from the [SuperCombo Wiki](https://wiki.supercombo.gg/w/Street_Fighter_6) and licensed under [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/). Attribution (source URL + fetch date) is preserved in every response. Japanese move names are curated from official-compliant references.

The data access policy is documented in [`docs/spec.md`](./docs/spec.md).

## Disclaimer

This is an unofficial, non-commercial, fan-made project and is not affiliated with or endorsed by Capcom. *Street Fighter* and all character / move names are trademarks and copyrighted works of [Capcom Co., Ltd.](https://www.capcom.com/)
