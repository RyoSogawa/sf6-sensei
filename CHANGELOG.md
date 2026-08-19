# Changelog

Notable changes to this project. Versions follow [Semantic Versioning](https://semver.org/).

Frame data comes from the SuperCombo Wiki (CC-BY-SA-4.0). "SF6 patch" is the Street Fighter 6
balance patch (by release date) that a release's frame data reflects.

## [0.2.0] - 2026-08-19

SF6 patch: 2026-08-03 / Data fetched: 2026-08-19

### Added

- Yasmine's Super Art levels (SA1/SA2/SA3 and CA) in `sa-levels.json`, so she now resolves
  from `SA1`–`SA3` / `CA` aliases like every other character
- Version, data fetch date and applied SF6 patch shown on the docs site
- `/health` now reports the version, data fetch date and applied SF6 patch, so it is possible
  to tell from outside which build and which data snapshot is deployed

### Changed

- Frame data re-scraped for the 2026-08-03 balance patch across all 31 characters
  (2378 moves). Jamie was the only character the patch left unchanged
- Version now has a single source of truth in `@repo/core/version` (`APP_VERSION` /
  `GAME_PATCH`), shared by the version the MCP server advertises and the scraper's User-Agent

### Fixed

- `dataVersion` was hand-written and had drifted from the actual data. The scraper now writes
  the fetch date into `generated/index.ts` and `dataVersion` is derived from it
- Sagat's step kicks no longer resolve to their Japanese names, because upstream renamed them
  (`Step High Kick` became `High Step Kick`, and likewise for the low and middle versions)

## [0.1.0] - 2026-06-22

Initial release.

- Scraper that fetches frame data for all 31 characters from the SuperCombo Wiki
- Five MCP tools (`get_move`, `get_character_frame_data`, `search_moves`, `find_punish`,
  `list_characters`) served from Cloudflare Workers
- Japanese alias, Super Art level and movement data layers
- Docs site in Japanese and English

[0.2.0]: https://github.com/RyoSogawa/sf6-sensei/releases/tag/v0.2.0
[0.1.0]: https://github.com/RyoSogawa/sf6-sensei/releases/tag/v0.1.0
