import alpinejs from '@astrojs/alpinejs'
import { defineConfig } from 'astro/config'

// Cloudflare Pages: served from the domain root, so no `base` is set.
// https://docs.astro.build/en/guides/deploy/cloudflare/
// i18n: Japanese is the default locale and stays at the root (`/`, `/terms`, ...),
// while English lives under `/en/` (prefixDefaultLocale: false).
export default defineConfig({
  i18n: {
    defaultLocale: 'ja',
    locales: ['ja', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [alpinejs()],
  site: 'https://sf6-sensei-mcp.pages.dev',
})
