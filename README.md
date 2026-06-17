# sf6-sensei

Street Fighter 6 のキャラクター/フレームデータを ChatGPT から参照できるようにする MCP サーバー。

全体仕様は [`docs/spec.md`](./docs/spec.md) を参照。

## 構成 (pnpm monorepo)

- `apps/mcp-server` — Hono on Cloudflare Workers の MCP エンドポイント
- `apps/scraper` — フレームデータの取得・正規化バッチ (Node CLI)
- `packages/core` — 型定義・データモデル・alias 解決・MCP ツールスキーマ
- `packages/data` — 生成データ
- `apps/mcp-docs` — 接続方法を案内するサイト (Astro / Cloudflare Pages)

## 開発

```sh
pnpm install
pnpm -r build
pnpm -r test
pnpm check
```

## ライセンス

- **コード**: MIT（[`LICENSE`](./LICENSE)）
- **フレームデータ**: [SuperCombo Wiki](https://wiki.supercombo.gg/) を出典とする CC-BY-SA-4.0。
  出典・改変・継承 (ShareAlike) の詳細は [`NOTICE`](./NOTICE) を参照。取得・利用方針は
  `docs/spec.md` の「取得の許諾とアクセス方針」を参照。
- 「Street Fighter」等は株式会社カプコンの商標・著作物。本プロジェクトは非公式・非営利であり、
  カプコンとは提携・関係していない。
