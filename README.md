# sf6-sensei

Street Fighter 6 のキャラクター/フレームデータを ChatGPT から参照できるようにする MCP サーバー。

全体仕様は [`docs/spec.md`](./docs/spec.md) を参照。

## 構成 (pnpm monorepo)

- `apps/mcp-server` — Hono on Cloudflare Workers の MCP エンドポイント
- `apps/scraper` — フレームデータの取得・正規化バッチ (Node CLI)
- `packages/core` — 型定義・データモデル・alias 解決・MCP ツールスキーマ
- `packages/data` — 生成データ

## 開発

```sh
pnpm install
pnpm -r build
pnpm -r test
pnpm check
```

## データソースとライセンス

フレームデータは [SuperCombo Wiki](https://wiki.supercombo.gg/) (CC-BY-SA) を出典とする。
取得・利用方針は `docs/spec.md` の「取得の許諾とアクセス方針」を参照。
本リポジトリのデータ派生物は CC-BY-SA を継承する。
