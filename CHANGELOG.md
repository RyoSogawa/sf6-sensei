# Changelog

このプロジェクトの主な変更点を記録する。バージョンは [Semantic Versioning](https://semver.org/lang/ja/) に従う。

収録データの出典は SuperCombo Wiki（CC-BY-SA-4.0）。「対応パッチ」は、そのリリースの
フレームデータが反映している Street Fighter 6 のバランスパッチ（リリース日）を指す。

## [0.2.0] - 2026-08-19

対応パッチ: 2026-08-03 / データ取得日: 2026-08-19

### Added

- Yasmine の SA レベル（SA1/SA2/SA3・CA）を `sa-levels.json` に追加。`SA1`〜`SA3` / `CA` の
  エイリアスで引けるようになった
- ドキュメントサイトにバージョン・データ最終更新日・対応パッチを表示
- `/health` がバージョン・データ取得日・対応パッチを返すようになった（デプロイ内容の確認用）

### Changed

- 2026-08-03 バランスパッチのフレームデータを全キャラ反映（31キャラ・2378技）。
  Jamie のみパッチによるフレーム変更なし
- バージョンの単一の真実を `@repo/core` の `APP_VERSION` / `GAME_PATCH` に集約。
  MCP サーバーが名乗る version とスクレイパーの User-Agent がこれを共有する

### Fixed

- `dataVersion` が手書きで実データとずれていた問題を修正。スクレイパーが取得日を
  `generated/index.ts` に書き出し、そこから導出するようにした
- Sagat のステップキック系の日本語名が引けなくなっていた問題を修正
  （取得元で `Step High Kick` → `High Step Kick` に改称されたため）

## [0.1.0] - 2026-06-22

初期リリース。

- SuperCombo Wiki から全31キャラのフレームデータを取得するスクレイパー
- MCP ツール5種（`get_move` / `get_character_frame_data` / `search_moves` /
  `find_punish` / `list_characters`）を Cloudflare Workers で配信
- 日本語エイリアス・SA レベル・移動データの各レイヤー
- ドキュメントサイト（日英）

[0.2.0]: https://github.com/RyoSogawa/sf6-sensei/releases/tag/v0.2.0
[0.1.0]: https://github.com/RyoSogawa/sf6-sensei/releases/tag/v0.1.0
