import { type Character, deriveNormalJaName, type Move } from '@repo/core'
import overrides from './alias-overrides.json'
import generated from './generated/sf6.json'
import saLevels from './sa-levels.json'

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

// SA レベル判定用。SA1/SA2/SA3 は取得元データに無いため packages/data/src/sa-levels.json
// に手動キュレーション（base モーション → レベル）。SA3 は (CA) マーカーと一致するが、
// SA1/SA2 はキャラ知識依存。詳細は docs/data-model.md を参照。
interface SaLevel {
  sa1?: string
  sa2?: string
  sa3?: string
}
type SaLevelMap = Record<string, SaLevel>

// 入力を SA の「素のモーション」へ正規化（j./タメ[]/(CA)(hold)/+/~派生/強度を除去）。
//   236236LP → 236236P, [4]646HP → 4646P, j.214214P → 214214P, 720+P → 720P
function superBaseMotion(numpad: string): string {
  return numpad
    .replace(/^j\./, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/[[\]{}]/g, '')
    .replace(/\+/g, '')
    .replace(/~.*$/, '')
    .replace(/([LMH])([PK])/g, '$2')
    .trim()
}

// 空中 SA の判定は入力の j. プレフィックスのみで行う。
// 名前に "Aerial" を含むが地上技のもの（例: Zangief "Aerial Russian Slam" は 236236K の地上技）を
// 誤って空中扱いしないため。
function isAerialSuper(move: Move): boolean {
  return move.input.numpad.startsWith('j.')
}

function saLevelOf(base: string, sa: SaLevel): 1 | 2 | 3 | null {
  if (sa.sa1 && base === sa.sa1) return 1
  if (sa.sa2 && base === sa.sa2) return 2
  if (sa.sa3 && base === sa.sa3) return 3
  return null
}

// super_art の SA エイリアスを生成（SA1〜3 / 空中SA / CA・総称SA）。
// sa-levels.json で確定した SA1/2/3 のモーションに一致する技だけにエイリアスを付ける。
// 一致しない super（ボス版や派生。例: M.Bison "Final Psycho Crusher" / Ingrid "Sun Octopus"）は
// SA 系クエリでヒットさせない（技名・入力では引けるまま。誤ヒットによる混乱を防ぐ）。
// CA（クリティカルアーツ）= 低体力時の レベル3 SA 強化版。SA3 と入力は同じでもダメージ/フレームが
// 異なる別レコード（"X" / "X (CA)"）なので別エイリアスに分ける: SA3 → 通常版、CA → "(CA)" 版。
function superArtAliases(move: Move, sa: SaLevel): string[] {
  const isCa = move.name.en.includes('(CA)')
  const level = saLevelOf(superBaseMotion(move.input.numpad), sa)
  // curated SA に一致せず CA でもない super（ボス版/派生。例: M.Bison "Final Psycho Crusher"）は除外。
  // ただし (CA) 表記の技は SA1/2/3 に紐づかなくても必ず CA として登録する
  // （例: Akuma の瞬獄殺 Shun Goku Satsu は独立した CA。入力が SA モーションと一致しない）。
  if (level === null && !isCa) {
    return []
  }
  const aerial = isAerialSuper(move)
  const out = aerial ? ['空中SA', '空中スーパーアーツ'] : ['SA', 'スーパーアーツ', 'super']
  if (isCa) {
    out.push('CA', 'クリティカルアーツ', 'critical art')
  } else {
    const prefix = aerial ? '空中' : ''
    out.push(`${prefix}SA${level}`, `${prefix}スーパーアーツ${level}`)
  }
  return out
}

function enrichMove(
  move: Move,
  universal: Record<string, AliasOverride>,
  perCharacter: Record<string, AliasOverride>,
  sa: SaLevel | undefined,
): Move {
  let result = move
  // 1. 体系的な通常技は入力から日本語名を自動導出（ja 未設定のときだけ）。
  if (result.name.ja === null) {
    const ja = deriveNormalJaName(result.input.numpad)
    if (ja) {
      result = { ...result, name: { ...result.name, ja } }
    }
  }
  // 2. super_art に SA エイリアス（SA1〜3 / 空中SA / CA / 総称）を付与。
  if (result.category === 'super_art' && sa) {
    const saAliases = superArtAliases(result, sa)
    result = { ...result, aliases: Array.from(new Set([...result.aliases, ...saAliases])) }
  }
  // 3. 手動 override（ja/aliases）。固有名や共通技は手動レイヤーで補う（手動が優先）。
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

function enrich(
  source: readonly Character[],
  overrideMap: OverrideMap,
  saMap: SaLevelMap,
): readonly Character[] {
  const universal = overrideMap.all ?? {}
  return source.map((character) => {
    const perCharacter = overrideMap[character.id] ?? {}
    const sa = saMap[character.id]
    return {
      ...character,
      moves: character.moves.map((move) => enrichMove(move, universal, perCharacter, sa)),
    }
  })
}

export const characters: readonly Character[] = enrich(
  generatedCharacters,
  overrides as OverrideMap,
  saLevels as SaLevelMap,
)

export function getCharacters(): readonly Character[] {
  return characters
}

// 生成スナップショットの識別子（取得日）
export const dataVersion = '2026-06-13'
