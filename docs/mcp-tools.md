# MCP ツール定義

ChatGPT から呼べる MCP ツールの入出力スキーマ。公開ツールは 4 つ + 補助 1 つ。

共通方針:
- 入力の `character` / `move` は **名前・入力・通称のどれでも受け付け**、正規化レイヤーで解決する
- 解決が曖昧なときは候補を複数返し、ChatGPT に確認させる（勝手に 1 つに決めない）
- 全レスポンスに `attribution`（出典 URL / ライセンス / 取得日）を含める（CC-BY-SA 遵守）
- `language` は `"ja" | "en"`（既定 `"ja"`）。応答内の name/notes の言語を切り替える

---

## 1. `get_move` — 特定技を調べる（コア）

「ジュリの 2 強の発生は？」

### Input
```jsonc
{
  "character": "ジュリ",        // 必須: 名前 / slug / 別名
  "move": "2強",                // 必須: 技名 / 入力(236P) / 通称
  "language": "ja"              // 任意, 既定 "ja"
}
```

### Output
```jsonc
{
  "resolvedCharacter": { "id": "juri", "name": "ジュリ" },
  "query": "2強",
  "ambiguous": false,
  "matches": [ /* Move（data-model.md 参照） */ ],
  "candidates": [],             // ambiguous=true のとき技名候補のみを返す
  "attribution": { "source": "SuperCombo wiki", "license": "CC-BY-SA", "url": "...", "fetchedAt": "..." }
}
```
- キャラ未解決時: `matches: []` + 近いキャラ名候補を `error.suggestions` で返す

---

## 2. `get_character_frame_data` — キャラの全技一覧

「キャミィの全技のフレーム教えて」

### Input
```jsonc
{
  "character": "cammy",         // 必須
  "category": "special",        // 任意: normal | command_normal | special | super_art | critical_art | throw | drive | taunt | movement
  "language": "ja"
}
```

### Output
```jsonc
{
  "character": { "id": "cammy", "name": "キャミィ" },
  "hp": 10000,
  "moveCount": 42,
  "movement": {
    "forwardWalkSpeed": "0.047",
    "backwardWalkSpeed": "0.035",
    "forwardDashFrames": 19,
    "backwardDashFrames": 23,
    "forwardDashDistance": "1.252",
    "backwardDashDistance": "1.02",
    "jump": { "startup": 4, "airborne": 38, "landing": 3, "total": 45, "text": "4+38+3" },
    "forwardJumpDistance": "1.90",
    "backwardJumpDistance": "1.52",
    "jumpApex": "2.115",
    "throwRange": "0.8",
    "throwHurtbox": "0.74",
    "driveRush": { "min": "0.525", "block": "1.878", "max": "3.628" }
  },
  "moves": [ /* Move[] */ ],
  "attribution": { ... }
}
```
- データ量が多いので、`category` 未指定でも要点フィールド（name/input/startup/onBlock/onHit）に
  絞った要約モードを返すか検討（full 取得は category 指定推奨）

---

## 3. `search_moves` — 条件検索（キャラ横断）

「発生 4F 以下の無敵技は？」「ガード後有利な技は？」

### Input
```jsonc
{
  "character": null,            // 任意: 指定でそのキャラに限定。null で全キャラ横断
  "category": null,             // 任意
  "startupMax": 4,              // 任意: 発生 <= 4
  "startupMin": null,
  "onBlockMin": 0,              // 任意: ガード時硬直差 >= 0（有利）
  "onBlockMax": null,
  "onHitMin": null,
  "invincible": true,           // 任意: properties に invincible を含む
  "properties": [],             // 任意: 含めたい属性の AND 条件
  "limit": 20,                  // 任意, 既定 20
  "language": "ja"
}
```

### Output
```jsonc
{
  "criteria": { /* echo した検索条件 */ },
  "count": 12,
  "truncated": false,           // limit で打ち切ったか
  "results": [
    { "character": { "id": "ken", "name": "ケン" }, /* ...Move フィールド */ }
  ],
  "attribution": { ... }
}
```
- `truncated=true` のときは「絞り込み条件の追加」を促す文言を添える（無音の打ち切り禁止）

---

## 4. `find_punish` — 確反診断

「（相手の技）をガードした、確反ある？」

### Input
```jsonc
{
  "myCharacter": "luke",        // 必須: 確反を出す自キャラ
  "opponentCharacter": "juri",  // 任意: 相手キャラ（opponentMove 解決に使う）
  "opponentMove": "236K",       // 任意: ガードした相手の技（onBlock を引く）
  "onBlock": null,              // 任意: 技が不明でも硬直差を直接指定可（例: -7）
  "maxStartup": null,           // 任意: 候補に含める発生上限（既定: 算出した有利F）
  "language": "ja"
}
```

### Behavior
1. `opponentMove`（or `onBlock` 直接指定）から自分の有利フレーム = `abs(onBlock)`（負のときのみ確反対象）を算出
2. `myCharacter` の技から `startup <= 有利F` を満たすものを抽出し、`damage` 降順で返す
3. リーチ・距離・状況依存は判定しきれないため候補提示に留める

### Output
```jsonc
{
  "situation": {
    "opponentMove": { "name": "...", "onBlock": -7 },
    "myFrameAdvantage": 7
  },
  "punishable": true,
  "candidates": [ /* Move[]（startup<=7, damage 降順） */ ],
  "caveats": [
    "リーチ・距離・キャラ位置は考慮していません。実際に届くかは要確認です。",
    "ドライブラッシュやキャンセルでの確反は含みません。"
  ],
  "attribution": { ... }
}
```

---

## 5. `list_characters` — キャラ一覧（補助）

ID 解決やキャラ名の確認に使う。

### Input
```jsonc
{ "language": "ja" }
```

### Output
```jsonc
{
  "characters": [
    { "id": "juri", "name": "ジュリ", "aliases": ["juri han"] }
  ],
  "attribution": { ... }
}
```

---

## エラー / 曖昧性のハンドリング

- キャラ/技が解決できない → 候補（`suggestions`）を返し、ChatGPT に再確認させる
- 複数ヒット → `ambiguous: true` + `candidates` を返す
- データ未取得のキャラ → 「未対応」である旨を明示（空配列で誤魔化さない）
