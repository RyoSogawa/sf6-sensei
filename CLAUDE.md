# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Street Fighter 6 のフレームデータを ChatGPT から参照できる MCP サーバー。詳細仕様は
[`docs/spec.md`](./docs/spec.md)、進行状況は [`tasks/todo.md`](./tasks/todo.md) を参照。
ドキュメントは日本語。技術用語・コードは原語のまま。

## コマンド

pnpm workspace モノレポ（Node >= 22, pnpm 10）。ルートから:

```sh
pnpm install
pnpm -r build          # 全パッケージ tsc ビルド（project references 順）
pnpm -r test           # 全パッケージの vitest run
pnpm check             # Biome lint + format チェック（CI と同じ）
pnpm format            # Biome 自動修正（check --write）
```

- 単一パッケージ: `pnpm --filter @repo/core test` / `pnpm --filter @repo/mcp-server build`
- 単一テストファイル: `pnpm --filter @repo/core exec vitest run src/index.test.ts`
- テスト名で絞る: `... exec vitest run -t "normalizeInput"`
- スクレイパ実行（手動バッチ）: `pnpm --filter @repo/scraper fetch` → `packages/data/src/generated/sf6.json` を再生成
- デプロイ手順は [`docs/deploy.md`](./docs/deploy.md)（`wrangler` は install 容易化のため一時的に外してあり、デプロイ前に再追加が必要）

## アーキテクチャ（データの流れ）

ビルド時に確定するデータパイプライン。実行時の外部 I/O は無い（生成済み JSON を Worker に inline）。

```
SuperCombo Wiki (CC-BY-SA, srk.shib.live API)
  └─ apps/scraper ── cargoquery 取得 + 正規化 ──► packages/data/src/generated/sf6.json
                                                      │（書き込み時に core の zod で検証）
  packages/core（zod スキーマ = 単一の真実）◄────────┘
       └─ packages/data が JSON を読み込み characters[] として公開
            └─ apps/mcp-server が 5 ツールを Hono on Cloudflare Workers で配信
```

- **`packages/core`** — 型と検証の単一ソース。`moveSchema`/`characterSchema`（zod）と推論型、
  さらにクエリ解決層 `normalizeInput`（numpad / 日本語表記 → 正規化 numpad キー）と `resolveMove`
  （input 一致 > alias > name のティア順で候補を返す）。スキーマ変更はここが起点で全体に波及する。
- **`apps/scraper`** — `srk.shib.live/api.php` の MediaWiki Cargo から取得し、HTML/wiki マークアップを
  剥がして数値化する純粋関数群（`parseAdvantage`/`parseFrameValue`/`parseCancel`/`parseGuard`/`mapMoveType`/
  `getCharacterSlug`）。Move ID は `${characterId}__${normalizeInput(input)}`。
- **`apps/mcp-server`** — `/mcp`（Streamable HTTP）と `/health`。ツール本体は `src/tools.ts`
  （`get_move`/`get_character_frame_data`/`search_moves`/`find_punish`/`list_characters`）。

### 知っておくべき設計上の判断

- **MCP サーバーはステートレス**: リクエストごとに `createMcpServer()` で新しい `McpServer` + transport を
  生成する。SDK の Server は単一 transport にしか connect できず、共有インスタンスは「Already connected」で
  落ちるため。`apps/mcp-server/src/index.ts` のこのパターンを崩さない。
- **全レスポンスに attribution（CC-BY-SA 出典）を必ず含める**: ライセンス義務。各 `Move.source` にも出典 URL・
  取得日時を保持する。出典表記を落とさないこと。
- **alias は再スクレイプで消えない別レイヤー**: `packages/data/src/alias-overrides.json`（通称・JP 技名・
  共通システム技・P/K 省略の俗称）。`packages/data/src/index.ts` が読み込み時に `getCharacters()` の
  結果へマージする（生成 JSON は書き換えない）。`Move.input.numpad` をキーにし、`"all"` で全キャラ一括付与。
  共通技（DI/リバーサル/パリィ/ラッシュ/投げ）はキャラ固有名で格納されるため入力キーで横断する。形式は
  `docs/data-model.md`。技の解決は core の `resolveMoveBest`（入力 > 完全一致 > 部分一致のティア順）。
- **`find_punish` は候補提示のみ**: リーチ・距離・状況は考慮しない（caveats に明記）。完全な確反判定はしない。
- **スクレイパのアクセス方針は厳守事項**: `srk.shib.live/api.php` のみ・正直な識別 UA・低頻度バッチ。
  `apps/scraper` を触る前に必ず `docs/spec.md`「取得の許諾とアクセス方針」を読む。
- **音声制約**: ChatGPT の Voice Mode では MCP ツールが発火しない。テキストチャットの音声入力で運用する前提。

## 規約

- **Biome（`@repo/biome-config`）が厳格**: single quote / セミコロンなし / trailing comma all / 行幅 100、
  オブジェクトキーはアルファベット順（`useSortedKeys`、package.json は除外）、認知的複雑度 15 まで、
  `console` は warn/error のみ許可（`apps/scraper` は console 全許可）。`pnpm check` を緑にしてからコミット。
- **TypeScript は composite project references**: 各パッケージ `tsc -p tsconfig.json`。`@repo/tsconfig` の
  base / node / workers を継承（strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`）。
- **依存のサプライチェーン保護（`pnpm-workspace.yaml`）**: `minimumReleaseAge`（公開後 7日のクールダウン）+
  `trustPolicy: no-downgrade`。若くてブロックされる依存は **exclude せず成熟版へダウングレード**（`overrides` で固定）。
  これらはセキュリティ設定で、変更は承認プロンプト必須。安易に exclude しない。
- pre-commit（lefthook）でステージ済みファイルに Biome がかかる。
- コミットメッセージは日本語・Conventional Commits（private repo）。
