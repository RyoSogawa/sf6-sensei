# SF6 Frame Data MCP — 実装 TODO

仕様: [`docs/spec.md`](../docs/spec.md) / [`docs/data-model.md`](../docs/data-model.md) / [`docs/mcp-tools.md`](../docs/mcp-tools.md)

## Phase 0: プロジェクト基盤（scaffold）— 完了 2026-06-13
- [x] `project-scaffold` スキルで pnpm monorepo を構築
- [x] Biome / Vitest / lefthook / GitHub Actions CI（action は SHA ピン留め）
- [x] `apps/mcp-server` `apps/scraper` `packages/core` `packages/data` `packages/tsconfig` `packages/biome-config`

## Phase 1: データモデル / core — 完了 2026-06-13
- [x] `packages/core` に zod スキーマ（moveSchema/characterSchema 等）+ 推論型（Move/Character）
- [x] `normalizeInput`（numpad / JP 表記 → 正規化 numpad キー）+ ユニットテスト
- [x] `resolveMove`（クエリ → 候補 Move[]: input 一致 / alias / name）+ ユニットテスト
- guard `LH`→properties `[low, high]` は意図的表現。`low`/`high` は「ガード可能方向」で、両方＝上段（立ち/しゃがみ両対応）。要再整理ではない（2026-06-13 確認）。将来 `上段/中段/下段` ラベルを導出して持たせるのは任意

## Phase 2: データ取得（手動バッチ）— 完了 2026-06-13
- [x] SuperCombo のデータ構造を調査・検証（`srk.shib.live` `api.php` + `cargoquery`）
- [x] 正規化の難所を probe で洗い出し（`scripts/normalize-probe.mjs`）
- [x] cargoquery クライアント（honest UA・低頻度・ページング）。アクセス方針は spec.md 厳守
- [x] 正規化を本実装（advantage/frames/cancel/guard/moveType、`apps/scraper`）+ ユニットテスト（39件）
- [x] Move / Character へマッピング → `packages/data/src/generated/sf6.json`（30 キャラ / 2306 技、出典付き）
- [x] core の zod スキーマで書き込み時バリデーション
- [x] `packages/data` を生成 JSON に結線（`characters` / `resolveMove` smoke test）
- [x] alias 手動レイヤーの仕組み（`packages/data/src/alias-overrides.json`、再スクレイプで消えない）
  - [x] 結線を実装（`packages/data/src/index.ts` が読み込み時にマージ。`input.numpad` キー + `"all"` 一括付与）
  - [x] core に `resolveMoveBest`（入力 > 完全一致 > 部分一致のティア順、最強ティアのみ。"DI" 誤爆を解消）
  - [x] `getMoveImpl`/`find_punish` を `resolveMoveBest` に置換（旧: 素の部分一致）
  - [x] 入力マッチを強度非依存に（"236P" → 236LP/MP/HP に展開。SF6 は強度ごと別レコード）
- [ ] alias-overrides の中身を充実 ← 継続作業
  - [x] 共通システム技: DI / ドライブリバーサル / ドライブパリィ / ドライブラッシュ（全キャラ `all`）
  - [x] 投げ系: 前投げ・裏投げ/後ろ投げ・空投げ・空中裏投げ（全キャラ `all`、Zangief 5LPLK も対応）
  - [x] 方向コマ投げ: `N投げ`(1〜6投げ) + 下投げ/2投げ（`2LPLK`= alex/dhalsim/zangief、`1/3/6`= zangief）
  - [ ] キャラ固有の俗称（`2強`/`昇竜`/`真空` 等 P/K 省略・JP 技名）
- [x] 技名の日本語化（`name.ja`）
  - [x] 体系的な通常技を入力から自動導出（`deriveNormalJaName`: 5/2/j.+強度+P/K → 立ち弱パンチ等、538件）
  - [ ] 必殺技/SA/CA の固有名（波動拳・昇竜拳…）。英語のみのソースのため手動キュレーション要（保留）
  - [ ] 挑発の体系的命名（Back/Neutral/Forward/Down Taunt → 後ろ/N/前/下挑発）。任意
- [ ] 差分チェック（既存 JSON との比較）
- [x] CC-BY-SA の出典表記をデータ（各 Move.source）/ README / spec に明記

## Phase 3: データストア
- [ ] D1（SQLite）スキーマ設計（検索インデックス含む）
- [ ] JSON → D1 投入スクリプト（マイグレーション）

## Phase 4: MCP サーバー — 完了 2026-06-13
- [x] Hono + `@hono/mcp`(StreamableHTTPTransport) + `@modelcontextprotocol/sdk` の MCP エンドポイント(`/mcp`)
  - ステートレス: リクエストごとに McpServer を生成（共有インスタンスは「Already connected」で落ちる）
- [x] `get_move` / `get_character_frame_data` / `search_moves` / `find_punish` / `list_characters`
- [x] 全レスポンスに attribution(CC-BY-SA) 付与、曖昧性/未解決時は候補(suggestions/candidates)返却
- [x] tool ロジックのユニットテスト + `/mcp` ライブ handshake 検証（initialize→tools/list→tools/call、計 31 件）
- [x] 依存解決: trustPolicy=no-downgrade、若い dev/型は成熟版へダウングレード、esbuild/@types/node は overrides 固定
- 注: `wrangler` は Phase 5(デプロイ)まで保留中（mcp-server devDeps から一時除外）。再追加が必要

## Phase 5: デプロイ / 接続確認
- [x] バンドル可否・サイズを検証（2026-06-14, esbuild）: 2.7MB raw / **288KB gzip**＝Workers 無料枠(1MB)内、
  `node:` 依存ゼロで `nodejs_compat` 不要、データ(2MB JSON)も inline 済み
- [x] デプロイ手順書を作成（[`docs/deploy.md`](../docs/deploy.md)）
- [ ] （要・ユーザー操作）wrangler 再追加 → workerd build script 承認 → `wrangler login` → `wrangler deploy`
- [ ] （要・ユーザー操作）ChatGPT Developer mode で MCP コネクタ登録（`/mcp` URL）
- [ ] （要・ユーザー操作）主要ユースケースを音声入力で動作確認

## 将来（別フェーズ）
- [ ] プレイヤー認証（OAuth）
- [ ] キャラ別 対策メモ CRUD
- [ ] プレイヤー間の攻略情報共有

---

## Review
（実装完了後に結果サマリをここに追記）
