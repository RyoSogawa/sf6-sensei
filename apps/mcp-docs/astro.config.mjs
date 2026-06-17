import { defineConfig } from 'astro/config'

// Cloudflare Pages: ドメイン直下（ルート）配信のため base は付けない。
// https://docs.astro.build/en/guides/deploy/cloudflare/
export default defineConfig({
  site: 'https://sf6-sensei-mcp.pages.dev',
})
