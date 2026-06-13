import type { Character } from '@repo/core'
import generated from './generated/sf6.json'

// 生成データ。apps/scraper が SuperCombo Wiki (CC-BY-SA) から cargoquery で取得・正規化し、
// core の zod スキーマで検証済みの JSON を出力したもの。各 Move の source に出典を明記している。
export const characters = generated as unknown as readonly Character[]

export function getCharacters(): readonly Character[] {
  return characters
}

// 生成スナップショットの識別子（取得日）
export const dataVersion = '2026-06-13'
