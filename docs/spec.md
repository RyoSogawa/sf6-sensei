# SF6 Frame Data MCP — 仕様書

ストリートファイター6（SF6）のキャラクター/フレームデータと攻略情報を
ChatGPT から参照できるようにする MCP サーバー。

最終ゴールは「マッチング後の短い時間に、音声入力でキャラの知識をサッと思い出す」体験。

---

## 1. ゴール

- SF6 の全キャラのフレームデータを構造化データ（JSON）として保持する
- それを ChatGPT から MCP サーバー経由で参照できるようにする
- （将来）プレイヤーごとの対策メモを認証付きで管理し、最終的にプレイヤー間で共有する

## 2. 主要ユースケース

- 「ジュリの 2 強の発生は？」 → 特定技のフレームを返す
- 「この技ガードした、確反ある？」 → 自キャラの確定反撃候補を返す
- 「発生 4F 以下の無敵技は？」 → 条件検索（キャラ横断）
- 「キャミィの全技のフレーム教えて」 → キャラの全技一覧

### 利用方法の前提（重要な技術的制約）

- ChatGPT の **Voice Mode（リアルタイム会話）では MCP ツール / Custom GPT Actions が発火しない**
  （2026-06 時点。コミュニティ報告ベース、OpenAI から対応時期の公式アナウンスなし）。
- そのため当面は **テキストチャットの音声入力（ディクテーション）** で運用する。
  喋る → 文字起こし → 送信 → ツール発火 → 回答、という流れ。
- 真のハンズフリーが必要になった場合は、バックエンド（本 API/MCP）はそのまま再利用し、
  自作アプリ / iOS Shortcut / OpenAI Realtime API などの独自クライアントを別途用意する。

## 3. アーキテクチャ

```
SuperCombo wiki (CC-BY-SA)
        │  手動バッチ scrape
        ▼
   正規化 / JSON 化  ──►  データストア (Cloudflare KV / D1 / R2)
                                   │
                                   ▼
                       MCP サーバー (Hono on Cloudflare Workers, リモート HTTPS)
                                   │  Developer mode で接続
                                   ▼
                           ChatGPT（テキスト + 音声入力）
```

- **連携方式**: MCP サーバー（リモート HTTPS）。ChatGPT の Developer mode で接続する。
  - 利用側は Pro/Plus/Business/Enterprise/Edu かつ developer mode の ON が必要。
  - 将来プレイヤーに広く配る場合は Custom GPT Actions（OpenAPI）併設も検討余地あり。

## 4. データソースとライセンス

- **採用**: SuperCombo wiki（`wiki.supercombo.gg`）。コンテンツは **CC-BY-SA**。
  - 義務: **出典明記** ＋ 派生物（本データ）も **同一ライセンス（CC-BY-SA）で公開**。
  - 取得元 URL / 取得日時 / ライセンス表記を各レコードに保持する。
- **不採用**: CAPCOM 公式（`streetfighter.com`）。
  - 公式「サイトのご利用について」がコンテンツ（テキスト・データ含む）の複製・転載・翻訳・
    公衆送信・販売を許可なく禁止。EULA も通信プロトコル/データの解析・転用を禁止。
  - robots.txt は WAF により機械取得不可（403）＝ bot の自動アクセスを歓迎していないサイン。
  - 将来の「共有（＝公衆送信・再配布）」と正面衝突するため不採用。
  - ※公式の正確な規約文 / robots.txt は最終的にブラウザで裏取りすること。

> 免責: ライセンス判断は法的助言ではない。公開前に最終確認すること。

### 取得方式（検証済み 2026-06-13）

- `wiki.supercombo.gg` 本体は Cloudflare チャレンジ、`index.php`（ページ HTML）は Anubis PoW でブロック。
- 本番エンドポイントは **`srk.shib.live/api.php`**（同一運営が CF 上で意図的に challenge を外した
  API フレンドリーな別フロント。生オリジン直叩きではない）の MediaWiki API（**Cargo 拡張**）。
  許諾・アクセス方針は後述「取得の許諾とアクセス方針」を厳守。
- **HTML スクレイプ不要。`action=cargoquery` で構造化 JSON を直接取得**:
  - `SF6_FrameData`（技ごと: input, name, moveType, damage, startup, active, recovery, total,
    hitAdv, blockAdv, guard, cancel, punishAdv, perfParryAdv, DRcancelHit/Blk ...）。約 2306 行 / 30 キャラ。
  - `SF6_CharacterData`（hp, throwRange, 歩き/ダッシュ/ジャンプ速度など）。
- **要正規化**: advantage 系フィールドに色付け HTML/wiki マークアップが混入する
  （例 `hitAdv = <span ...>'''+4'''</span>`）。タグと `'''` を除去して数値化する。
  `11(13)` のような条件付き値、`Chn Sp SA TC` などの cancel/guard コードもパースする。
- **言語**: 出典は英語のみ。日本語の技名・通称は **手動 alias レイヤー**で補う
  （numpad 入力 `5LP` は言語非依存なので日本語クエリでも入力/通称で引ける）。

### 取得の許諾とアクセス方針（決定 2026-06-13）

コンテンツの **CC-BY-SA は再配布・改変を許可**（copyright 上の許諾。取得方法とは別レイヤー）。
一方 robots.txt は AI クローラを抑制しているため、**正攻法でのみアクセスする**。

- `wiki.supercombo.gg/robots.txt`: `Content-Signal: search=yes, ai-train=no`、
  GPTBot/ClaudeBot/Google-Extended/CCBot 等の **AI クローラを名指しで Disallow**、`User-agent: *` は `Allow: /`。
  `ai-input`(RAG/グラウンディング = 本用途) は **未指定＝グレー**（許可も禁止も明記なし）。
- 本体 `wiki.supercombo.gg` は honest UA でも Cloudflare challenge でブロック。
  `srk.shib.live` は **同一運営が CF 上で意図的に challenge を外した別フロント**（生オリジン直叩きではない）で、
  独自 robots は `/api.php` 許可・`/index.php?title=` と `/w/Special:` は Disallow。
- **アクセス方針（厳守）**:
  1. エンドポイントは `srk.shib.live/api.php` のみ（`/index.php?title=`・`/w/Special:` は使わない＝robots 遵守）
  2. **正直な識別 UA**（`sf6-frame-data-api/x.y (+repo URL)`）。偽装ブラウザ UA は使わない
  3. **低頻度の手動バッチ + 強キャッシュ**。並列連打しない
  4. `ai-train=no` 遵守（学習しない）。`ai-input` はグレーと理解の上で個人・非営利に留める
  5. **出典明記 + CC-BY-SA 継承（share-alike）**
  6. honest UA でブロックされたら「No」として尊重し、運営確認 or 別ソースへ
- 完全クリーンにしたい場合は SuperCombo 運営に個人・非営利利用の一報を入れる（任意）。

## 5. データモデル

詳細な JSON スキーマは [`data-model.md`](./data-model.md) を参照。要点のみ:

- `Character`: id（公式 URL 準拠の slug）/ name(ja, en) / aliases / moves[]
- `Move`: name(ja, en) / input(numpad + official) / aliases / category /
  startup / active / recovery / onBlock / onHit / onPunishCounter /
  cancel / damage / driveRush 補正 / properties[] / notes / source(url, license, fetchedAt)
- **言語**: 日英両方を保持（`name.ja` / `name.en`、notes も可能な範囲で両方）
- **技の網羅範囲**: 全部入り（通常技・必殺技・SA1/2/3・CA・投げ・Drive 系 DI/DR/パリィ）
- **キャラ範囲**: 全キャラ（DLC 含む。SuperCombo にあるものは全部）

## 6. MCP ツール

詳細な入出力スキーマは [`mcp-tools.md`](./mcp-tools.md) を参照。公開する 4 ツール + 補助:

| ツール | 用途 |
|---|---|
| `get_move` | 特定技のフレームを調べる（最頻出のコア） |
| `get_character_frame_data` | 指定キャラの全技一覧 |
| `search_moves` | 条件検索（キャラ横断） |
| `find_punish` | 確反診断 |
| `list_characters`（補助） | キャラ一覧 / ID 解決 |

## 7. 技の指定・名寄せ（alias 解決）

音声クエリのヒット率を上げるため、技は以下のどれでも引けるようにする:

- **公式技名**: 「需鬼脚」「波動拳」/ "Hadoken"
- **コマンド入力**: 「236P」「623K」
- **通称・俗称**: 「2 強（屈強 P）」「昇竜」「真空」など

実装方針:
- 正規化レイヤー（alias 辞書 + numpad パーサ）でクエリ → 技 ID に解決
- numpad 表記（1-9 のテンキー方向 + P/K 強度）をパースして技候補に当てる
- 曖昧な場合は候補を複数返し、ChatGPT 側で確認させる
- **別名は数に上限なく手動で追加・編集でき、再スクレイプで消えない**
  （自動生成とは別レイヤーで管理しビルド時マージ。詳細は data-model.md）

## 8. データ更新運用

- **手動バッチ実行**: パッチ / 新キャラ時に自分でスクレイプスクリプトを回す
- 取得 → 正規化 → 差分チェック → データストア反映
- 各データに取得日時とゲームバージョン（判明すれば）を付与
- 将来的に GitHub Actions cron で定期自動化も可能（今はやらない）

## 9. ホスティング / デプロイ

- **Cloudflare Workers**（Hono）。リモート HTTPS エンドポイントを提供
- データストア候補: KV（読み取り高速）/ D1（SQL 検索向き）/ R2（生 JSON 配布）
  - `search_moves` / `find_punish` の条件検索が要るので **D1（SQLite）を主軸**に検討
- スクレイパは Node（ローカル / CI 実行）。Workers とは別パッケージ

## 10. モノレポ構成（`project-scaffold` 準拠）

pnpm workspace モノレポ。想定パッケージ:

```
sf6-frame-data-api/
├── apps/
│   └── mcp-server/      # Hono on Cloudflare Workers（MCP エンドポイント）
├── packages/
│   ├── scraper/         # SuperCombo スクレイプ + 正規化バッチ
│   ├── core/            # 型定義・データモデル・alias 解決ロジック
│   └── data/            # 生成された JSON / マイグレーション
├── docs/
└── (Biome / Vitest / lefthook / GitHub Actions CI)
```

## 11. スコープ

### MVP（今回）
- [ ] SuperCombo からのスクレイプ + 正規化 → JSON
- [ ] データストア（D1）への投入
- [ ] MCP サーバー（4 ツール）を Cloudflare Workers にデプロイ
- [ ] ChatGPT Developer mode で接続して動作確認

### 将来
- プレイヤー認証（OAuth）
- キャラ別の対策メモ CRUD（自分用）
- プレイヤー間での攻略情報共有

## 12. 非機能・制約・リスク

- **確反診断の限界**: リーチ / 距離 / 状況は完全には考慮できない。候補提示 + 注意書きに留める
- **データ鮮度**: 手動更新のため、パッチ直後は古い可能性。回答にバージョン/取得日を添える
- **ライセンス遵守**: CC-BY-SA の出典明記・継承を MCP の応答 or メタに含める
- **音声制約**: 前述の通り Voice Mode 非対応。音声入力での運用を明記
