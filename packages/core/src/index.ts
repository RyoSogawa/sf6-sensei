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
  | 'movement'

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
  'movement',
])

// Advantage on hit / on block (shared by Drive Rush variants)
const dualAdvantageSchema = z
  .object({ onBlock: z.number().nullable(), onHit: z.number().nullable() })
  .nullable()
  .optional()

export const moveSchema = z.object({
  active: z.string().nullable(),
  // Advantage when this move is performed after a Drive Rush (afterDRHit/Blk)
  afterDriveRush: dualAdvantageSchema,
  airborne: z.string().nullable().optional(), // airborne frames (e.g. "9-50 (FKD)")
  aliases: z.array(z.string()),
  armor: z.string().nullable().optional(), // armor frames (e.g. "5-12 (1 hit)")
  attackRange: z.number().nullable().optional(), // reach of the attack
  blockstun: z.number().nullable().optional(),
  cancel: z.array(z.string()),
  category: moveCategorySchema,
  characterId: z.string(),
  chipDamage: z.number().nullable().optional(),
  damage: z.number().nullable().optional(),
  damageText: z.string().nullable().optional(), // raw compound notation (e.g. "500x2", "1400(800)")
  dmgScaling: z.string().nullable().optional(), // damage scaling (e.g. "20% Starter")
  // Drive gauge: gain=self gain, dealtOnHit/Blk=Drive damage dealt to opponent
  driveGauge: z
    .object({
      dealtOnBlock: z.number().nullable(),
      dealtOnHit: z.number().nullable(),
      gain: z.number().nullable(),
    })
    .nullable()
    .optional(),
  // Advantage when this move is Drive Rush cancelled (DRcancelHit/Blk)
  driveRushCancel: dualAdvantageSchema,
  hitstop: z.number().nullable().optional(),
  hitstun: z.number().nullable().optional(),
  id: z.string(),
  input: z.object({
    numpad: z.string(),
    official: z.string().nullable(),
  }),
  invuln: z.string().nullable().optional(), // invulnerability frames (e.g. "1-8 Air", "1-3 Full")
  juggle: z
    .object({
      increase: z.string().nullable(),
      limit: z.string().nullable(),
      start: z.string().nullable(),
    })
    .nullable()
    .optional(),
  name: localizedNameSchema,
  notes: z.object({ en: z.string().nullable(), ja: z.string().nullable() }).nullable().optional(),
  onBlock: z.number().nullable(),
  onHit: z.number().nullable(),
  onPerfectParry: z.number().nullable().optional(), // advantage on perfect parry
  onPunishCounter: z.number().nullable().optional(), // advantage on punish counter
  projectileSpeed: z.number().nullable().optional(),
  properties: z.array(z.string()),
  pushback: z
    .object({ onBlock: z.string().nullable(), onHit: z.string().nullable() })
    .nullable()
    .optional(),
  recovery: z.number().nullable(),
  source: moveSourceSchema,
  startup: z.number().nullable(),
  // SA gauge gain: onHit/onBlock (secondary values in parens — see raw notes)
  superGauge: z
    .object({ onBlock: z.number().nullable(), onHit: z.number().nullable() })
    .nullable()
    .optional(),
  totalFrames: z.number().nullable().optional(),
})

export type Move = z.infer<typeof moveSchema>

export const jumpFramesSchema = z.object({
  airborne: z.number().nullable(),
  landing: z.number().nullable(),
  startup: z.number().nullable(),
  text: z.string(),
  total: z.number().nullable(),
})

export type JumpFrames = z.infer<typeof jumpFramesSchema>

export const characterMovementSchema = z.object({
  backwardDashDistance: z.string().nullable(),
  backwardDashFrames: z.number().nullable(),
  backwardJumpDistance: z.string().nullable(),
  backwardWalkSpeed: z.string().nullable(),
  driveRush: z
    .object({
      block: z.string().nullable(),
      max: z.string().nullable(),
      min: z.string().nullable(),
    })
    .nullable(),
  forwardDashDistance: z.string().nullable(),
  forwardDashFrames: z.number().nullable(),
  forwardJumpDistance: z.string().nullable(),
  forwardWalkSpeed: z.string().nullable(),
  jump: jumpFramesSchema.nullable(),
  jumpApex: z.string().nullable(),
  throwHurtbox: z.string().nullable(),
  throwRange: z.string().nullable(),
})

export type CharacterMovement = z.infer<typeof characterMovementSchema>

/**
 * Parse a jumpSpd string like "4+38+3" into structured frames.
 * Handles <br>(...) alternate values by using the primary value only.
 * Returns null for empty or unparseable input.
 */
export function parseJumpSpd(raw: string): JumpFrames | null {
  if (!raw || raw === '-') return null

  const primary = raw.split(/<br\s*\/?>/i)[0]?.trim()
  if (!primary) return null

  const parts = primary.split('+')
  if (parts.length !== 3) return null

  const startup = Number(parts[0])
  const airborne = Number(parts[1])
  const landing = Number(parts[2])

  if (Number.isNaN(startup) || Number.isNaN(airborne) || Number.isNaN(landing)) return null

  return {
    airborne,
    landing,
    startup,
    text: primary,
    total: startup + airborne + landing,
  }
}

export const characterSchema = z.object({
  aliases: z.array(z.string()),
  gameVersion: z.string().nullable().optional(),
  id: z.string(),
  movement: characterMovementSchema.nullable().optional(),
  moves: z.array(moveSchema),
  name: localizedNameSchema,
  source: moveSourceSchema,
})

export type Character = z.infer<typeof characterSchema>

// Input schema for the get_move MCP tool (see docs/mcp-tools.md)
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
 * Note: colloquial forms that omit P/K (e.g. "2強" → "2h") cannot uniquely
 * identify a move, so such queries are filled in by the alias-overrides layer
 * and resolved via resolveMove's alias match.
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

// numpad input matching. A query that omits strength (l/m/h) like "236P" matches
// the strength-tagged moves 236LP/236MP/236HP (SF6 frame data is a separate record
// per strength). A query that specifies strength like "236LP" matches exactly only.
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
  // Case where a natural-language query (e.g. "リュウのインパクト") contains an alias.
  // Aliases of 2 chars or fewer ("DI" etc.) cause false matches, so exclude them
  // and leave those to the exact tier(1).
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

const JA_STANCE: Record<string, string> = { '2': 'しゃがみ', '5': '立ち', j: 'ジャンプ' }
const JA_STRENGTH: Record<string, string> = { h: '強', l: '弱', m: '中' }
const JA_BUTTON: Record<string, string> = { k: 'キック', p: 'パンチ' }

/**
 * Derive the Japanese name of a systematic normal from its numpad input.
 * Only plain normals — stance(5/2/j.) + strength(L/M/H) + button(P/K) — are
 * covered (e.g. "5LP" → "立ち弱パンチ", "j.MK" → "ジャンプ中キック").
 * Command normals, target combos and proper-noun moves (波動拳 etc.) return null.
 */
export function deriveNormalJaName(numpad: string): string | null {
  const matched = numpad.match(/^(5|2|j\.)([lmh])([pk])$/i)
  if (!matched) return null
  const stanceRaw = matched[1]
  const strengthRaw = matched[2]
  const buttonRaw = matched[3]
  if (!(stanceRaw && strengthRaw && buttonRaw)) return null
  const stance = JA_STANCE[stanceRaw.toLowerCase().replace('.', '')]
  const strength = JA_STRENGTH[strengthRaw.toLowerCase()]
  const button = JA_BUTTON[buttonRaw.toLowerCase()]
  if (!(stance && strength && button)) return null
  return `${stance}${strength}${button}`
}

const JA_TAUNT_DIR: Record<string, string> = {
  back: '後ろ',
  down: '下',
  forward: '前',
  neutral: 'ニュートラル',
}

/**
 * Derive the Japanese name of a taunt from its English name.
 * Taunts are systematically named "(Back|Neutral|Forward|Down) Taunt" (with an
 * optional "~Dir" or "(...)" suffix), e.g. "Forward Taunt (DL2)" → "前挑発".
 * Returns null for anything that isn't a directional taunt.
 */
export function deriveTauntJaName(nameEn: string): string | null {
  const matched = nameEn.match(
    /^(Back|Neutral|Forward|Down)(?:~(Back|Neutral|Forward|Down))?\s+Taunt/,
  )
  if (!matched) return null
  const first = matched[1]
  if (!first) return null
  const dir1 = JA_TAUNT_DIR[first.toLowerCase()]
  if (!dir1) return null
  const second = matched[2]
  const dir2 = second ? (JA_TAUNT_DIR[second.toLowerCase()] ?? '') : ''
  return `${dir1}${dir2}挑発`
}
