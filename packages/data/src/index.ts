import { type Character, deriveNormalJaName, type Move } from '@repo/core'
import overrides from './alias-overrides.json'
import generated from './generated/sf6.json'

// 生成データ。apps/scraper が SuperCombo Wiki (CC-BY-SA) から cargoquery で取得・正規化し、
// core の zod スキーマで検証済みの JSON を出力したもの。各 Move の source に出典を明記している。
const generatedCharacters = generated as unknown as readonly Character[]

// 手動 alias レイヤー。形は { [characterId | "all"]: { [input.numpad]: { aliases?, ja? } } }。
// 自動生成 JSON とは別管理で、再スクレイプしても消えない。共通システム技（DI/リバーサル/
// パリィ/ラッシュ）は固有名で入っているため、入力(numpad)をキーに "all" で全キャラ一括付与する。
// 詳細は docs/data-model.md を参照。
interface AliasOverride {
  aliases?: string[]
  ja?: string
}
type OverrideMap = Record<string, Record<string, AliasOverride>>

function applyOverride(move: Move, override: AliasOverride): Move {
  const aliases = override.aliases
    ? Array.from(new Set([...move.aliases, ...override.aliases]))
    : move.aliases
  // ja は既存値を尊重し、未設定(null)のときだけ補完する。
  const name = override.ja && move.name.ja === null ? { ...move.name, ja: override.ja } : move.name
  return { ...move, aliases, name }
}

function enrichMove(
  move: Move,
  universal: Record<string, AliasOverride>,
  perCharacter: Record<string, AliasOverride>,
): Move {
  let result = move
  // 1. 体系的な通常技は入力から日本語名を自動導出（ja 未設定のときだけ）。
  if (result.name.ja === null) {
    const ja = deriveNormalJaName(result.input.numpad)
    if (ja) {
      result = { ...result, name: { ...result.name, ja } }
    }
  }
  // 2. 手動 override（ja/aliases）。固有名や共通技は手動レイヤーで補う（手動が優先）。
  const universalOverride = universal[move.input.numpad]
  if (universalOverride) {
    result = applyOverride(result, universalOverride)
  }
  const characterOverride = perCharacter[move.input.numpad]
  if (characterOverride) {
    result = applyOverride(result, characterOverride)
  }
  return result
}

function enrich(source: readonly Character[], overrideMap: OverrideMap): readonly Character[] {
  const universal = overrideMap.all ?? {}
  return source.map((character) => {
    const perCharacter = overrideMap[character.id] ?? {}
    return {
      ...character,
      moves: character.moves.map((move) => enrichMove(move, universal, perCharacter)),
    }
  })
}

export const characters: readonly Character[] = enrich(
  generatedCharacters,
  overrides as OverrideMap,
)

export function getCharacters(): readonly Character[] {
  return characters
}

// 生成スナップショットの識別子（取得日）
export const dataVersion = '2026-06-13'
