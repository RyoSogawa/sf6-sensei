# SF6 Frame Data MCP — 実装 TODO

仕様: [`docs/spec.md`](../docs/spec.md) / [`docs/data-model.md`](../docs/data-model.md) / [`docs/mcp-tools.md`](../docs/mcp-tools.md)

## Phase 0: プロジェクト基盤（scaffold）
- [ ] `project-scaffold` スキルで pnpm monorepo を構築（構成は事前確認）
- [ ] Biome / Vitest / lefthook / GitHub Actions CI をセットアップ
- [ ] `apps/mcp-server` `packages/scraper` `packages/core` `packages/data` の雛形

## Phase 1: データモデル / core
- [ ] `packages/core` に Character / Move 型を定義（data-model.md 準拠）
- [ ] numpad パーサ（236P / 2HP などを方向+ボタンに分解）
- [ ] 強度マップ・通称辞書（汎用スラング + キャラ固有）
- [ ] alias 解決ロジック（クエリ → 技 ID）+ ユニットテスト

## Phase 2: データ取得（手動バッチ）
- [x] SuperCombo のデータ構造を調査・検証（2026-06-13 完了）
  - ミラー `srk.shib.live` の `api.php` + `action=cargoquery` で取得可能と確認
  - テーブル: `SF6_FrameData`（2306 行 / 30 キャラ）, `SF6_CharacterData`
- [ ] cargoquery クライアント（`srk.shib.live/api.php`、honest UA、低頻度、ページング: limit/offset）。
  アクセス方針は spec.md「取得の許諾とアクセス方針」を厳守（偽装 UA 不可・api.php のみ・出典明記+継承）
- [x] 正規化の難所を probe で洗い出し（2026-06-13, `scripts/normalize-probe.mjs`）。マークアップ除去は全 2306 行クリーン
- [ ] 正規化を本実装（詳細は data-model.md「正規化の難所」）:
  - `{{{x}}}`/`-` → null、`KD/HKD +N`、`N(M)` 条件値
  - moveType の大小文字ゆれ + `taunt`/`serenity_stream`/`air_normal8`
  - frames の `N land`/`until`/`3+8`/`2,2`/`18~`
  - cancel(space/comma, SA1-3, `*`, 括弧注記)、guard の多段 comma
- [ ] Move / Character モデルへマッピング → JSON 出力（出典・取得日時・ライセンス付与）
- [ ] 日本語の技名・通称を手動 alias レイヤー（`alias-overrides.json`）で付与
- [ ] 差分チェック（既存 JSON との比較）
- [ ] CC-BY-SA の出典表記をデータ/リポジトリに明記

## Phase 3: データストア
- [ ] D1（SQLite）スキーマ設計（検索インデックス含む）
- [ ] JSON → D1 投入スクリプト（マイグレーション）

## Phase 4: MCP サーバー（4 ツール）
- [ ] Hono on Cloudflare Workers の MCP エンドポイント
- [ ] `get_move`
- [ ] `get_character_frame_data`
- [ ] `search_moves`
- [ ] `find_punish`
- [ ] `list_characters`（補助）
- [ ] 全レスポンスに attribution 付与
- [ ] 曖昧性/エラー時の候補返却
- [ ] 各ツールのユニット/統合テスト（80%+ 目標）

## Phase 5: デプロイ / 接続確認
- [ ] Cloudflare Workers にデプロイ（リモート HTTPS）
- [ ] ChatGPT Developer mode で MCP コネクタ登録
- [ ] 主要ユースケースを音声入力で動作確認

## 将来（別フェーズ）
- [ ] プレイヤー認証（OAuth）
- [ ] キャラ別 対策メモ CRUD
- [ ] プレイヤー間の攻略情報共有

---

## Review
（実装完了後に結果サマリをここに追記）
