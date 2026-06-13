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

### 別名（aliases）の手動管理（重要）

- `Move.aliases` は **数に上限なく手動で追加・編集できる**こと（人手キュレーション前提）。
- スクレイパが自動生成する別名と、人が手で足した別名を **別レイヤーで管理**し、
  ビルド時にマージする。**再スクレイプしても手動の別名が消えない**ことを保証する。
  - 例: `packages/data/alias-overrides.json`（`moveId -> string[]` の追記専用レイヤー）
  - 最終的な `Move.aliases` = 自動生成 ∪ 手動 override（重複排除）

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
| `perfParryAdv` | （拡張） | パーフェクトパリィ時有利。必要なら追加 |
| `guard` | `properties` | `LH`→low/high 等のコードを属性に展開 |
| `cancel` | `cancel` | `Chn Sp SA TC`→`[chain, special, super, target_combo]` |
| `DRcancelHit` / `DRcancelBlock` | `driveRush.onHit/onBlock` | 数値化 |

> マークアップ除去・コード解析は `packages/scraper` の正規化ステップで行い、
> `packages/core` の型に詰める。取得元に無い値は `null`/省略。

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
