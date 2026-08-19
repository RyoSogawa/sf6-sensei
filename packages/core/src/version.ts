/**
 * Release version of the project. The version the MCP server advertises, the scraper's
 * User-Agent and the docs site all read this, so a release only needs to change it here.
 * Keep it in sync with the git tag `v<APP_VERSION>`.
 */
export const APP_VERSION = '0.2.0'

/**
 * The SF6 balance patch (release date) the bundled data reflects. Update it when a
 * re-scrape pulls in a new patch. The scrape date itself is not kept here: the scraper
 * writes it out as `dataVersion` in `@repo/data`.
 */
export const GAME_PATCH = '2026-08-03'
