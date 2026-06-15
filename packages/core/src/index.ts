import { z } from 'zod'

export type Language = 'ja' | 'en'

export type MoveCategory =
  | 'normal'
  | 'command_normal'
  | 'special'
  | 'super_art'
  | 'critical_art'
  | 'throw'
  | 'drive'
  | 'taunt'

// Zod schemas (source of truth)

export const localizedNameSchema = z.object({
  en: z.string(),
  ja: z.string().nullable(),
})

export type LocalizedName = z.infer<typeof localizedNameSchema>

export const moveSourceSchema = z.object({
  fetchedAt: z.string().datetime(),
  license: z.literal('CC-BY-SA'),
  url: z.string().url(),
})

export type MoveSource = z.infer<typeof moveSourceSchema>

export const moveCategorySchema = z.enum([
  'normal',
  'command_normal',
  'special',
  'super_art',
  'critical_art',
  'throw',
  'drive',
  'taunt',
])

export const moveSchema = z.object({
  active: z.string().nullable(),
  aliases: z.array(z.string()),
  cancel: z.array(z.string()),
  category: moveCategorySchema,
  characterId: z.string(),
  damage: z.number().nullable().optional(),
  driveGauge: z
    .object({ onBlock: z.number(), onHit: z.number(), onPunishCounter: z.number() })
    .nullable()
    .optional(),
  driveRush: z.object({ onBlock: z.number(), onHit: z.number() }).nullable().optional(),
  id: z.string(),
  input: z.object({
    numpad: z.string(),
    official: z.string().nullable(),
  }),
  name: localizedNameSchema,
  notes: z.object({ en: z.string().nullable(), ja: z.string().nullable() }).nullable().optional(),
  onBlock: z.number().nullable(),
  onHit: z.number().nullable(),
  onPunishCounter: z.number().nullable().optional(),
  properties: z.array(z.string()),
  recovery: z.number().nullable(),
  source: moveSourceSchema,
  startup: z.number().nullable(),
  superGauge: z.number().nullable().optional(),
  totalFrames: z.number().nullable().optional(),
})

export type Move = z.infer<typeof moveSchema>

export const characterSchema = z.object({
  aliases: z.array(z.string()),
  gameVersion: z.string().nullable().optional(),
  id: z.string(),
  moves: z.array(moveSchema),
  name: localizedNameSchema,
  source: moveSourceSchema,
})

export type Character = z.infer<typeof characterSchema>

// MCP ツール get_move の入力スキーマ（詳細は docs/mcp-tools.md）
export const getMoveInput = z.object({
  character: z.string().min(1),
  language: z.enum(['ja', 'en']).default('ja'),
  move: z.string().min(1),
})

export type GetMoveInput = z.infer<typeof getMoveInput>

// Phase 1: Query resolution layer

/**
 * Normalize a move input (numpad or JP notation) to a lowercase canonical key.
 * Examples:
 *   "屈強P" → "2hp"
 *   "下大P" → "2hp"
 *   "236P" → "236p"
 *   "立中K" → "5mk"
 *   "cr.HP" → "2hp"
 *   "2HP" → "2hp"
 * Note: P/K を省いた俗称（例 "2強" → "2h"）は技を一意化できないため、
 * そうしたクエリは alias-overrides 層で補い、resolveMove の alias マッチで解決する。
 * Returns null if the input cannot be interpreted as a move command.
 */
export function normalizeInput(raw: string): string | null {
  if (!raw) return null

  let normalized = raw.toLowerCase().trim()

  // Strip unwanted characters first
  normalized = normalized.replace(/[\s.~]/g, '')

  // Handle JP direction patterns (longer patterns first to avoid partial matches)
  normalized = normalized
    .replace(/後ろ/g, '4') // backward (must come before 後 alone)
    .replace(/しゃがみ/g, '2') // crouch
    .replace(/立ち/g, '5') // stand
    .replace(/前ジャンプ/g, 'j6') // forward jump
    .replace(/ジャンプ中?/g, 'j') // jump (with optional 中)
    .replace(/後/g, '4') // back
    .replace(/前/g, '6') // forward
    .replace(/下/g, '2') // down
    .replace(/屈/g, '2') // crouch (alternate)
    .replace(/立/g, '5') // stand (alternate)
    .replace(/右/g, '6') // right (forward)
    .replace(/左/g, '4') // left (backward)

  // Handle JP button strength (these map to lmh)
  normalized = normalized
    .replace(/弱|小/g, 'l') // weak / small
    .replace(/中/g, 'm') // medium
    .replace(/強|大/g, 'h') // strong / big
    .replace(/パンチ/g, 'p') // punch
    .replace(/キック/g, 'k') // kick

  // Handle prefix notation (cr., st., j.)
  normalized = normalized
    .replace(/^cr(?!itical)/i, '2') // cr prefix (not critical art)
    .replace(/^crouching/i, '2')
    .replace(/^st(?!reet)?/i, '5') // st prefix
    .replace(/^standing/i, '5')
    .replace(/^j(?![a-z])/i, 'j') // j prefix (not 'jump' after replacement)

  // Normalize strength codes (P/K with strength to [lmh][pk])
  // e.g., LP/MP/HP → lp/mp/hp, LK/MK/HK → lk/mk/hk
  normalized = normalized
    .replace(/lp/gi, 'lp')
    .replace(/mp/gi, 'mp')
    .replace(/hp/gi, 'hp')
    .replace(/lk/gi, 'lk')
    .replace(/mk/gi, 'mk')
    .replace(/hk/gi, 'hk')

  // Validate that it's a reasonable input (contains digits, motion codes, or buttons)
  if (!normalized.match(/[0-9jlmhpk]/)) {
    return null
  }

  return normalized
}

// numpad 入力のマッチ。強度(l/m/h)を省いたクエリ "236P" を、強度付きで格納された技
// 236LP/236MP/236HP に当てる（SF6 のフレームデータは強度ごとに別レコード）。
// "236LP" のように強度まで指定したクエリは厳密一致のみ。
function inputMatches(moveNorm: string, queryNorm: string): boolean {
  if (moveNorm === queryNorm) return true
  const parsed = queryNorm.match(/^([0-9j]*)([pk])$/)
  if (!parsed) return false
  const motion = parsed[1] ?? ''
  const button = parsed[2]
  if (!button) return false
  return new RegExp(`^${motion}[lmh]?${button}$`).test(moveNorm)
}

function matchesByNumpadInput(move: Move, queryNorm: string | null): boolean {
  if (!queryNorm) return false
  const moveNorm = normalizeInput(move.input.numpad)
  if (!moveNorm) return false
  return inputMatches(moveNorm, queryNorm)
}

function matchesByAlias(move: Move, queryLower: string): boolean {
  return move.aliases.some(
    (alias) => alias.toLowerCase().includes(queryLower) || queryLower.includes(alias.toLowerCase()),
  )
}

function matchesByName(move: Move, queryLower: string): boolean {
  const jaMatch = move.name.ja?.toLowerCase().includes(queryLower)
  const enMatch = move.name.en.toLowerCase().includes(queryLower)
  return !!(jaMatch || enMatch)
}

/**
 * Resolve a query string to matching Move(s), ranked by match quality.
 * Tiers (lower = stronger): 0 = exact numpad input, 1 = alias, 2 = name.
 * Within a tier the original move order is preserved (stable sort). De-duplicated by id.
 */
export function resolveMove(query: string, moves: Move[]): Move[] {
  if (!(query && moves.length)) return []

  const queryNorm = normalizeInput(query)
  const queryLower = query.toLowerCase()

  const ranked: { move: Move; tier: number }[] = []
  for (const move of moves) {
    let tier: number | null = null
    if (matchesByNumpadInput(move, queryNorm)) {
      tier = 0
    } else if (matchesByAlias(move, queryLower)) {
      tier = 1
    } else if (matchesByName(move, queryLower)) {
      tier = 2
    }
    if (tier !== null) {
      ranked.push({ move, tier })
    }
  }

  ranked.sort((a, b) => a.tier - b.tier)

  const results: Move[] = []
  const seen = new Set<string>()
  for (const { move } of ranked) {
    if (!seen.has(move.id)) {
      seen.add(move.id)
      results.push(move)
    }
  }
  return results
}

function matchesExactNameOrAlias(move: Move, queryLower: string): boolean {
  if (move.name.en.toLowerCase() === queryLower) return true
  if (move.name.ja !== null && move.name.ja.toLowerCase() === queryLower) return true
  return move.aliases.some((alias) => alias.toLowerCase() === queryLower)
}

function matchesSubstring(move: Move, queryLower: string): boolean {
  if (queryLower.length < 2) return false
  if (move.name.en.toLowerCase().includes(queryLower)) return true
  if (move.name.ja?.toLowerCase().includes(queryLower)) return true
  if (move.aliases.some((alias) => alias.toLowerCase().includes(queryLower))) return true
  // 自然文クエリ（例「リュウのインパクト」）が alias を内包するケース。
  // 2 文字以下の alias（"DI" 等）は誤爆するので除外し、それらは exact tier(1) に任せる。
  return move.aliases.some((alias) => alias.length >= 3 && queryLower.includes(alias.toLowerCase()))
}

export interface RankedMove {
  move: Move
  tier: number
}

/**
 * Rank moves against a query by match strength (lower tier = stronger):
 *   0 = exact numpad input, 1 = exact alias/name, 2 = substring of alias/name.
 * Unlike resolveMove this does NOT de-duplicate by id (moves sharing an input,
 * e.g. LP/MP/HP variants, are all kept). Stable within a tier.
 */
export function resolveMoveRanked(query: string, moves: Move[]): RankedMove[] {
  if (!(query && moves.length)) return []

  const queryNorm = normalizeInput(query)
  const queryLower = query.toLowerCase().trim()

  const ranked: RankedMove[] = []
  for (const move of moves) {
    let tier: number | null = null
    if (matchesByNumpadInput(move, queryNorm)) {
      tier = 0
    } else if (matchesExactNameOrAlias(move, queryLower)) {
      tier = 1
    } else if (matchesSubstring(move, queryLower)) {
      tier = 2
    }
    if (tier !== null) {
      ranked.push({ move, tier })
    }
  }

  ranked.sort((a, b) => a.tier - b.tier)
  return ranked
}

/**
 * Resolve a query to the strongest-tier matches only.
 * If an exact input or exact alias/name matches, weaker substring matches are
 * dropped — so e.g. "DI" returns the Drive Impact move, not every normal whose
 * English name happens to contain "di" ("Standing", "Medium", ...).
 */
export function resolveMoveBest(query: string, moves: Move[]): Move[] {
  const ranked = resolveMoveRanked(query, moves)
  const first = ranked[0]
  if (!first) return []
  const bestTier = first.tier
  return ranked.filter((r) => r.tier === bestTier).map((r) => r.move)
}
