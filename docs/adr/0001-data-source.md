# 1. データソースに SuperCombo Wiki を採用

- ステータス: 採用
- 日付: 2026-06-13

## 背景

SF6 フレームデータの取得元を決める必要があった。候補は CAPCOM 公式、SuperCombo Wiki、
有志の静的データセット、FAT (GPL-3.0) など。

## 決定

SuperCombo Wiki (CC-BY-SA) を採用し、MediaWiki API (`action=cargoquery`) で
構造化データ (`SF6_FrameData` / `SF6_CharacterData`) を取得する。

## 理由

- CAPCOM 公式は ToS/EULA でコンテンツの複製・再配布を禁止。手段を変えても解決しない。
- 有志の静的データセット (4rays/sf6-move-data 等) は軒並みメンテ停止で鮮度がない。
- SuperCombo は現役メンテ、かつ CC-BY-SA で再利用が明示的に許可されている。
- 取得は正攻法のみ: 正直な識別 UA・低頻度の手動バッチ・robots 遵守 (`/api.php` のみ)・
  出典明記 + CC-BY-SA 継承。詳細は `../spec.md`「取得の許諾とアクセス方針」。
