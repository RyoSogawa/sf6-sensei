# データモデル

SF6 フレームデータの正規化 JSON スキーマ。`packages/core` の型定義の元になる。

> フィールドは取得元（SuperCombo wiki）に存在する範囲で埋める。
> 取得できない値は `null`（数値）/ 省略（オプショナル）とし、存在を偽らない。

## Character

```jsonc
{
  "id": "juri",                       // 公式 URL 準拠の slug（一意キー）
  "name": { "ja": "ジュリ", "en": "Juri" },
  "aliases": ["juri han"],            // 名寄せ用の別名
  "gameVersion": "Ver. 2026.xx",      // 判明すれば。フレーム値の前提バージョン
  "source": {
    "url": "https://wiki.supercombo.gg/w/Street_Fighter_6/Juri/Frame_data",
    "license": "CC-BY-SA",
    "fetchedAt": "2026-06-13T05:00:00Z"
  },
  "moves": [ /* Move[] */ ]
}
```

## Move

```jsonc
{
  "id": "juri__2hp",                  // `${characterId}__${正規化input}`（一意キー）
  "name": { "ja": "しゃがみ大パンチ", "en": "Crouching Heavy Punch" },
  "input": {
    "numpad": "2HP",                  // テンキー表記（正規化の基準）
    "official": "しゃがみ大P"          // 公式/原典の表記
  },
  "aliases": ["2強", "屈強P", "下大P", "cr.HP"],   // 通称・俗称（名寄せ用）
  "category": "normal",               // normal | command_normal | special | super_art | critical_art | throw | drive
  "startup": 7,                       // 発生
  "active": "3",                      // 持続（範囲表記がありうるので string 許容）
  "recovery": 18,                     // 硬直
  "totalFrames": 27,                  // 全体フレーム
  "onBlock": -2,                      // ガード時硬直差
  "onHit": 4,                         // ヒット時硬直差
  "onPunishCounter": 6,               // パニッシュカウンター時
  "cancel": ["special", "super"],     // chain | special | super | drive_rush | none
  "damage": 800,
  "driveGauge": { "onHit": 0, "onBlock": 0, "onPunishCounter": 0 },  // Drive ゲージ増減
  "superGauge": 500,                  // SA ゲージ増加
  "driveRush": {                      // ドライブラッシュキャンセル時の補正（SF6 特有・重要）
    "onBlock": 2,
    "onHit": 8
  },
  "properties": ["low"],              // low | high | overhead | throw | projectile | armor | invincible | airborne | knockdown | forced_knockdown | ...
  "notes": { "ja": "...", "en": "..." },  // 補足（取れる範囲で）
  "source": {
    "url": "https://wiki.supercombo.gg/w/Street_Fighter_6/Juri/Frame_data",
    "license": "CC-BY-SA",
    "fetchedAt": "2026-06-13T05:00:00Z"
  }
}
```

## category の定義

| 値 | 意味 |
|---|---|
| `normal` | 通常技（立ち/しゃがみ/ジャンプ） |
| `command_normal` | コマンド通常技（特殊技） |
| `special` | 必殺技 |
| `super_art` | スーパーアーツ SA1/SA2/SA3 |
| `critical_art` | クリティカルアーツ（CA） |
| `throw` | 投げ（通常投げ/コマンド投げ） |
| `drive` | Drive 系（DI / DR / パリィ / DR キャンセル） |

## alias 解決のための補助データ

`packages/core` が持つ正規化辞書:

- **numpad パーサ**: `236P` `623K` `2HP` などをパースして方向 + ボタンに分解
- **強度マップ**: `弱P=LP` `中P=MP` `強P=HP`（K も同様）、`2=しゃがみ` `J=ジャンプ` など
- **通称辞書**: `2強→2HP` `昇竜→各キャラの昇竜系 special` `真空→真空波動拳系` など
  - キャラ非依存（汎用スラング）とキャラ依存（固有技名）の 2 層

### 技名の日本語化（`name.ja`）

取得元（SuperCombo）は英語名のみ。`name.ja` は読み込み時に次の順で補完する（`packages/data/src/index.ts`）:

1. **通常技は入力から自動導出** — `deriveNormalJaName`（core）。`5/2/j.` + 強度 + P/K → 立ち弱パンチ等。
2. **挑発は名前から自動導出** — `deriveTauntJaName`（core）。`(Back|Neutral|Forward|Down) Taunt` → 後ろ/N/前/下挑発。
3. **固有名は手動翻訳レイヤー** — `packages/data/src/translations.json`（`{ characterId: { 基底技名(en): 日本語名 } }`）。
   - 必殺技/SA の公式日本語名を全30体キュレーション。接尾辞（`Lv.N`/`(CA)`/`~派生`/強度接頭辞/`<br>`）は
     `baseMoveName` で除いて照合するので、強度違い・派生は基底名 1 エントリでまとめて当たる。
   - 出典は **frame-search.com**（公式準拠の日本語フレームデータ）。JS-SPA のため WebFetch では取得不可で、
     chrome-devtools 実ブラウザでレンダリング後のデータを取得し、入力モーションで英語名と照合した。
   - 英語名（SuperCombo）と公式日本語名が異なる例も正確化: `The Final Prison → ファイナルキャプチュード`、
     `Goddess of the Hunt → アポロウーサ`、`Interdiction → ザプリェット` 等。

> カバレッジは ja 62%（残りは特殊技/派生/スタンス連携の長い尻尾。`translations.json` に追記すれば伸ばせる）。
> 消費側 LLM が英語名や notes を読んで日本語で答えられるため、未訳でも実用上は致命的でない。

### 別名（aliases）の手動管理（重要）

- `Move.aliases` は **数に上限なく手動で追加・編集できる**こと（人手キュレーション前提）。
- スクレイパが自動生成する別名と、人が手で足した別名を **別レイヤーで管理**し、
  読み込み時にマージする。**再スクレイプしても手動の別名が消えない**ことを保証する。
- 実装: `packages/data/src/alias-overrides.json` を `packages/data/src/index.ts` が読み込み、
  `getCharacters()` が返す Character[] にマージする（生成 JSON 自体は書き換えない）。

#### alias-overrides.json の形式

```jsonc
{
  // "all" = 全キャラ共通。それ以外は characterId をキーにそのキャラだけへ適用。
  // 内側のキーは Move.input.numpad の文字列（厳密一致）。
  "all": {
    "HPHK":   { "aliases": ["ドライブインパクト", "インパクト", "DI"], "ja": "ドライブインパクト" },
    "LPLK":   { "aliases": ["投げ", "前投げ"], "ja": "前投げ" }
  },
  "ryu": {
    "623P": { "aliases": ["昇竜", "ショーリュー"] }
  }
}
```

- **入力(numpad)をキーにする理由**: 共通システム技（DI / リバーサル / パリィ / ラッシュ / 各種投げ）は
  キャラごとに固有の技名（例: リュウの DI = "Shingeki"）で格納されており、技名では横断できない。
  入力は言語非依存かつキャラ横断で安定なので、`all` の 1 エントリで全キャラに一括付与できる。
  P/K 省略の俗称（`2強→2HP`, `昇竜→623P`）も同じ仕組みで足せる。
- 各エントリは `aliases?`（既存と重複排除して結合）と `ja?`（`name.ja` が未設定 null のときだけ補完）。
- 最終的な `Move.aliases` = 自動生成 ∪ 手動 override（重複排除）。
- 解決は `packages/core` の `resolveMoveBest`（入力 > 別名/技名の完全一致 > 部分一致のティア順、
  最強ティアのみ返す）が使う。短いクエリ "DI" が技名の部分一致 "Stan**di**ng" に誤爆しない。

### SA（スーパーアーツ）レベルの手動キュレーション

SA1/SA2/SA3 のレベルは**取得元データに無い**（`moveType` は `super`/`Super` のみ、掲載順も入力の
アルファベット順で SA 順を反映しない）。そのため `packages/data/src/sa-levels.json` に
**base モーション → レベル**を手動キュレーションする（全30体・web で個別検証済み）。

```jsonc
{ "ryu": { "sa1": "236236P", "sa2": "214214P", "sa3": "236236K" }, ... }
```

`packages/data/src/index.ts` が super_art の各技に SA エイリアスを展開する:

- **base モーション正規化**: `j.`/タメ`[]`/`(CA)`/`(hold)`/`+`/`~`派生/強度を除去し
  `236236LP`→`236236P` のように畳む（強度違い・派生を 1 モーションに集約）。
- **`SA1`〜`SA3` + 総称`SA`/`スーパーアーツ`**: `sa-levels.json` に一致する技だけに付与。
- **`CA`（クリティカルアーツ）**: 名前に `(CA)` を含む技。SA3 とは入力が同じでもダメージ/フレームが
  異なる**別レコード**なので `SA3`（通常版）と `CA`（低体力版）を分離する。
  `(CA)` 表記は SA モーションに紐づかなくても CA として登録する（例: Akuma の瞬獄殺）。
- **`空中SA1`/`空中SA2`**: 入力が `j.` で始まる空中版。
- **ボス版/派生の除外**: `sa-levels.json` に無く `(CA)` でもない super（例: M.Bison `Final Psycho Crusher`、
  Ingrid `Sun Octopus`、Akuma の Misogi/Kongou）は SA クエリでヒットさせない（技名・入力では引ける）。

## 取得元フィールドのマッピング（SuperCombo `SF6_FrameData` → Move）

| 取得元フィールド | Move フィールド | 正規化 |
|---|---|---|
| `input` | `input.numpad` | そのまま（`5LP` 等） |
| `name` | `name.en` | そのまま。`name.ja` は手動 alias レイヤーで補完 |
| `moveType` | `category` | `ground_normal/air_normal/normal→normal`, `special`, `super`, `ca` 等にマップ |
| `damage` | `damage` | `300`、複数ヒットは `xN` 表記をパース |
| `startup` | `startup` | 数値化 |
| `active` | `active` | `3` / 範囲表記は string 保持 |
| `recovery` | `recovery` | `11(13)` の条件値を分解 |
| `total` | `totalFrames` | 同上 |
| `hitAdv` | `onHit` | **HTML/`'''` 除去して数値化**（例 `<span>'''+4'''</span>`→`4`） |
| `blockAdv` | `onBlock` | 同上 |
| `punishAdv` | `onPunishCounter` | 同上 |
| `perfParryAdv` | `onPerfectParry` | パーフェクトパリィ時有利 |
| `guard` | `properties` | `LH`→low/high 等のコードを属性に展開 |
| `cancel` | `cancel` | `Chn Sp SA TC`→`[chain, special, super, target_combo]` |
| `chip` / `dmgScaling` | `chipDamage` / `dmgScaling` | チップ数値化 / 補正は string 保持 |
| `DRcancelHit/Blk` | `driveRushCancel{onHit,onBlock}` | この技を DR キャンセルした時の有利 |
| `afterDRHit/Blk` | `afterDriveRush{onHit,onBlock}` | DR 後にこの技を出した時の有利 |
| `driveGain` / `driveDmgHit/Blk` | `driveGauge{gain,dealtOnHit,dealtOnBlock}` | `[8000]` の括弧を除去して数値化 |
| `superGainHit/Blk` | `superGauge{onHit,onBlock}` | `1000 (700)` の先頭値 |
| `hitstun`/`blockstun`/`hitstop` | 同名 | 数値化 |
| `invuln`/`armor`/`airborne` | 同名（string）+ `properties` タグ | 例 `"1-8 Air"`。有無を `invincible`/`armor`/`airborne` タグにも展開 |
| `atkRange` / `projSpeed` | `attackRange` / `projectileSpeed` | 小数数値化 |
| `jugStart/Increase/Limit` | `juggle{start,increase,limit}` | string 保持（`"1,2"` 等のリスト） |
| `pushbackHit/Blk` | `pushback{onHit,onBlock}` | string 保持 |
| `notes` | `notes.en` | マークアップ除去（攻略メモ本文） |

> マークアップ除去・コード解析は `apps/scraper` の正規化ステップで行い、`packages/core` の型に詰める。
> 取得元に無い値（`{{{fieldName}}}` テンプレ）は `null`/省略。複合ダメージ `500x2`/`1400(800)` は
> `damage`(先頭値) + `damageText`(原文) に分けて保持する。

## 生成データのレイアウト（キャラ別分割）

`packages/data/src/generated/` に **キャラ別 JSON**（`<charId>.json`）を出力する。1ファイルだと巨大になり
再スクレイプ差分が見づらいため。`apps/scraper` が同時に **`generated/index.ts`（自動生成）** を書き、各 JSON を
静的 import して結合配列を default export する。`packages/data` はこれを読み込み、実行時に1配列へ結合して
メモリ常駐する（クエリはメモリ上の `filter`/`find`。2306技規模では µs オーダーで SQLite 等より速い）。

- バンドル: esbuild が全 JSON を inline（Worker バンドル gzip 約 580KB / 無料枠上限 1024KB）。
- 速度ではなく**バンドル上限・可変データ（将来のプレイヤー別メモ）・大規模化**が D1(SQLite) 移行のトリガー。

## 正規化の難所（probe 検証済み 2026-06-13 / 全 2306 行）

`scripts/normalize-probe.mjs` で全行を解析して判明したクセ。本実装で対応する。

- **マークアップ除去は全行クリーン**（`<span>` / `'''` の除去で残渣なし）
- **未入力テンプレ `{{{fieldName}}}`** → そのレコードに該当なし。`null` 扱い（例: 大半の技で `DRcancelHit`）
- **advantage 値**:
  - `-` → `null`（該当なし: 空中技・飛び道具など）
  - `KD +23` / `HKD +18` → `{ knockdown: true, value: 23 }` に構造化
  - `-7(-2)` / `+4(+11)` → 主値 + 代替値（タメ / DR キャンセル時など）
  - `Crumple (Standing +21, Juggle +46, HKD +104)` 等の状況依存 → raw 保持 + 抽出可能分のみ数値化
- **`moveType` の大文字小文字ゆれ**: `Special`/`special`, `Super`/`super` → **case-insensitive でマップ**
  - 追加カテゴリ: `taunt`、`serenity_stream`(A.K.I. のスタンス, special 扱い)
  - 異常値: `air_normal8`(1 件) → `air_normal` に寄せる
- **frames 表記**: `3 land`(着地硬直) / `until land` / `12 or until released`(タメ) /
  `3+8`(多段発生) / `2,2`(多段 active = リスト) / `18~`(可変) → 主値抽出 + raw/フラグ保持
- **cancel**: space と comma 混在。`SA1/SA2/SA3`、`*`(条件付き)、`(1st)(2nd)` 等の括弧注記を分離
- **guard**: comma で多段ごとのリスト（`H,H` / `LH,LH`）

> 取得元には `invuln` / `armor` / `airborne` / `driveDmgHit/Blk` / `driveGain` /
> `superGainHit/Blk` / `hitstun` / `atkRange` 等のカラムもある。Move の
> `properties` / `driveGauge` / `superGauge` はこれらから埋められる。
> モデル拡張候補: ノックダウン情報、状況別有利、多段 guard、`taunt` カテゴリ。

## 一意性・参照整合性

- `Character.id` は全体で一意（公式 slug）
- `Move.id` は `${characterId}__${numpad 正規化}` で一意
- `find_punish` などキャラ横断ツールは `Character.id` をキーに引く
