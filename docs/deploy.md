# デプロイ手順 (Cloudflare Workers → ChatGPT 接続)

MCP サーバー(`apps/mcp-server`)を Cloudflare Workers にデプロイし、ChatGPT の Developer mode に接続する手順。

## 検証済み (2026-06-14, esbuild バンドルで確認)

- Worker バンドルは **約 2.7MB(raw) / 288KB(gzip)**。Cloudflare Workers 無料枠の上限(圧縮後 1MB)に収まる。
- MCP SDK / `@hono/mcp` / hono は **`node:` 組み込みに依存しない** → `nodejs_compat` は不要。
- データ(`sf6.json` 約2MB)は `@repo/data` の dist に含まれ、esbuild が inline する。

## 前提

- Cloudflare アカウント

## 手順 (いずれも要・あなたの操作)

### 1. wrangler は追加済み

`apps/mcp-server` の devDependencies に `wrangler ^4.98.0` と `deploy` スクリプトを追加済みなので
追加作業は不要。クリーン clone 後は `pnpm install` で入る。

- 注: 一部 transitive(`@emnapi/*` / `sharp` / `miniflare` 等)が公開7日未満だと
  `minimumReleaseAge` でブロックされ得る。ブロックされたら pnpm `overrides` で成熟版に固定する
  (esbuild/@types/node と同様)。

### 2. workerd の build script を承認 (保護設定・あなたが実施)

`wrangler deploy` には workerd のバイナリが要る。pnpm 11 は build script を既定で保留する
（`pnpm-workspace.yaml` の `allowBuilds` で全 `false`）ので、デプロイ時のみ承認が必要。

`pnpm-workspace.yaml` の `allowBuilds` で `workerd: true` にする（必要なら `esbuild: true` も）。
保護設定なのでフックが確認プロンプトを出す。`pnpm approve-builds` の対話でも同じく `allowBuilds` を更新できる。
デプロイ後に戻す場合は `false` へ。

### 3. Cloudflare 認証

```sh
pnpm --filter @repo/mcp-server exec wrangler login
# もしくは CLOUDFLARE_API_TOKEN を環境変数で渡す
```

### 4. デプロイ

```sh
pnpm --filter @repo/mcp-server run deploy
# 上は apps/mcp-server の deploy スクリプト(= wrangler deploy)。次の exec 形式と等価:
# pnpm --filter @repo/mcp-server exec wrangler deploy
```

> **注意:** ルートで素の `pnpm deploy` は pnpm 組み込みの deploy コマンドに食われて
> `ERR_PNPM_NOTHING_TO_DEPLOY` になる。`deploy` という名前のスクリプトを実行するには上記のように
> `--filter` でパッケージを選び、`run` を付ける(組み込みコマンドとの名前衝突を避けるため)。

- 設定は `apps/mcp-server/wrangler.jsonc`(name=`sf6-sensei-mcp`, main=`src/index.ts`)。
- デプロイ後の URL: `https://sf6-sensei-mcp.<your-subdomain>.workers.dev`

### 5. 動作確認

```sh
curl https://sf6-sensei-mcp.<subdomain>.workers.dev/health   # => {"status":"ok"}
```

MCP はルート `/`(Streamable HTTP)。専用サブドメイン配信なのでパスに `/mcp` を重ねず root を正規とする。
ローカルでは `apps/mcp-server/src/mcp.e2e.test.ts` が
initialize→tools/list→tools/call の handshake を検証している(同じ流れが本番でも動く)。

### 6. ChatGPT に接続

- ChatGPT(Pro/Plus 等)の 設定 → Connectors → Developer mode を有効化
- カスタム MCP コネクタを追加し、URL に
  `https://sf6-sensei-mcp.<subdomain>.workers.dev/` を指定
- 認証は無し(読み取り専用のフレームデータ)

### 7. 使ってみる

- テキストチャットの**音声入力(ディクテーション)**で「ジュリの2強の発生は？」
  「この技ガードした、確反ある？」など
- 公開ツール: `get_move` / `get_character_frame_data` / `search_moves` / `find_punish` / `list_characters`

## 注意

- 出典は SuperCombo Wiki(CC-BY-SA)。全レスポンスに attribution を含む。
- Voice Mode(リアルタイム会話)では MCP ツールが発火しない(`spec.md` 参照)。音声**入力**で使う。
- データが Workers のサイズ上限に近づいたら KV/D1/R2 へ移す(`spec.md` Phase 3、検索系の高速化も兼ねる)。
