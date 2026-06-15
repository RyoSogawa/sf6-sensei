import { type Character, type Move, resolveMoveBest } from '@repo/core'

export interface ToolResult {
  success: boolean
  data: unknown
  error?: string
}

/**
 * Resolve a character query to a Character from the dataset, with suggestions
 */
export function resolveCharacter(
  query: string,
  characters: readonly Character[],
): Character | null {
  if (!(query && characters.length)) return null

  const queryLower = query.toLowerCase()

  for (const char of characters) {
    if (char.id.toLowerCase() === queryLower) return char
    if (char.name.en.toLowerCase().includes(queryLower)) return char
    if (char.name.ja?.toLowerCase().includes(queryLower)) return char
    if (char.aliases.some((alias) => alias.toLowerCase().includes(queryLower))) return char
  }

  return null
}

/**
 * Get suggestions for a character that couldn't be resolved
 */
export function getCharacterSuggestions(query: string, characters: readonly Character[]): string[] {
  const queryLower = query.toLowerCase()
  const suggestions: Array<{ char: Character; score: number }> = []

  for (const char of characters) {
    let score = 0
    if (char.id.toLowerCase().includes(queryLower)) score += 3
    if (char.name.en.toLowerCase().includes(queryLower)) score += 2
    if (char.name.ja?.toLowerCase().includes(queryLower)) score += 2
    if (char.aliases.some((alias) => alias.toLowerCase().includes(queryLower))) score += 2

    // Levenshtein-like: if short query is similar to ID
    if (queryLower.length <= 3 && char.id.startsWith(queryLower)) score += 1

    if (score > 0) {
      suggestions.push({ char, score })
    }
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.char.id)
}

export interface GetMoveResult {
  resolvedCharacter: { id: string; name: string } | null
  query: string
  ambiguous: boolean
  matches: Move[]
  candidates: Array<{ name: string; aliases: string[] }> | null
  error?: string
  suggestions?: string[]
  attribution: Attribution
}

interface Attribution {
  source: string
  license: string
  url: string
  fetchedAt: string
}

const DEFAULT_ATTRIBUTION: Attribution = {
  fetchedAt: '2026-06-13',
  license: 'CC-BY-SA',
  source: 'SuperCombo Wiki',
  url: 'https://wiki.supercombo.gg',
}

/**
 * Tool: get_move
 * Resolve a character and move, returning matches
 */
export function getMoveImpl(
  character: string,
  move: string,
  characters: readonly Character[],
  language?: string,
): GetMoveResult {
  const resolvedChar = resolveCharacter(character, characters)

  if (!resolvedChar) {
    return {
      ambiguous: false,
      attribution: DEFAULT_ATTRIBUTION,
      candidates: null,
      error: `Character not found: ${character}`,
      matches: [],
      query: move,
      resolvedCharacter: null,
      suggestions: getCharacterSuggestions(character, characters),
    }
  }

  // core の解決層に委譲: numpad 正規化（"屈強P"→"2hp"）と入力 > 別名/技名 > 部分一致の
  // ティア順マッチ。最強ティアのみ返すので "DI" が "Standing/Medium" に誤爆しない。
  const matches = resolveMoveBest(move, resolvedChar.moves)

  return {
    ambiguous: matches.length > 1,
    attribution: DEFAULT_ATTRIBUTION,
    candidates:
      matches.length > 1
        ? matches.map((m) => ({
            aliases: m.aliases,
            name: language === 'en' ? m.name.en : m.name.ja || m.name.en,
          }))
        : null,
    matches: matches,
    query: move,
    resolvedCharacter: {
      id: resolvedChar.id,
      name: language === 'en' ? resolvedChar.name.en : resolvedChar.name.ja || resolvedChar.name.en,
    },
  }
}

export interface GetCharacterFrameDataResult {
  character: { id: string; name: string }
  moveCount: number
  moves: Move[]
  attribution: Attribution
}

/**
 * Tool: get_character_frame_data
 */
export function getCharacterFrameDataImpl(
  character: string,
  category: string | null | undefined,
  characters: readonly Character[],
  language?: string,
):
  | GetCharacterFrameDataResult
  | { error: string; suggestions?: string[]; attribution: Attribution } {
  const resolvedChar = resolveCharacter(character, characters)

  if (!resolvedChar) {
    return {
      attribution: DEFAULT_ATTRIBUTION,
      error: `Character not found: ${character}`,
      suggestions: getCharacterSuggestions(character, characters),
    }
  }

  let moves = resolvedChar.moves
  if (category) {
    moves = moves.filter((m) => m.category === category)
  }

  return {
    attribution: DEFAULT_ATTRIBUTION,
    character: {
      id: resolvedChar.id,
      name: language === 'en' ? resolvedChar.name.en : resolvedChar.name.ja || resolvedChar.name.en,
    },
    moveCount: moves.length,
    moves: moves,
  }
}

export interface SearchMovesResult {
  criteria: {
    character?: string | null
    category?: string | null
    startupMax?: number | null
    startupMin?: number | null
    onBlockMin?: number | null
    onBlockMax?: number | null
    onHitMin?: number | null
    onHitMax?: number | null
    properties?: string[] | null
    limit: number
  }
  count: number
  truncated: boolean
  results: Array<Move & { characterId: string; characterName: string }>
  attribution: Attribution
}

// 数値フィールドが [min, max] に収まるか判定（min/max 未指定なら無制約。値が null で制約ありなら不一致）
function inNumericRange(
  value: number | null,
  min: number | null | undefined,
  max: number | null | undefined,
): boolean {
  if (min !== null && min !== undefined && (value === null || value < min)) {
    return false
  }
  if (max !== null && max !== undefined && (value === null || value > max)) {
    return false
  }
  return true
}

/**
 * Tool: search_moves
 */
export function searchMovesImpl(
  characterId: string | null | undefined,
  category: string | null | undefined,
  startupMax: number | null | undefined,
  startupMin: number | null | undefined,
  onBlockMin: number | null | undefined,
  onBlockMax: number | null | undefined,
  onHitMin: number | null | undefined,
  onHitMax: number | null | undefined,
  properties: string[] | null | undefined,
  limit: number | null | undefined,
  characters: readonly Character[],
  language?: string,
): SearchMovesResult | { error: string; attribution: Attribution } {
  const effectiveLimit = limit ?? 20

  let candidates: Array<Move & { characterId: string; characterName: string }> = []

  if (characterId) {
    const char = resolveCharacter(characterId, characters)
    if (!char) {
      return {
        attribution: DEFAULT_ATTRIBUTION,
        error: `Character not found: ${characterId}`,
      }
    }
    candidates = char.moves.map((m) => ({
      ...m,
      characterId: char.id,
      characterName: language === 'en' ? char.name.en : char.name.ja || char.name.en,
    }))
  } else {
    for (const char of characters) {
      candidates.push(
        ...char.moves.map((m) => ({
          ...m,
          characterId: char.id,
          characterName: language === 'en' ? char.name.en : char.name.ja || char.name.en,
        })),
      )
    }
  }

  // Filter by criteria
  let results = candidates.filter((m) => {
    if (category && m.category !== category) return false
    if (!inNumericRange(m.startup, startupMin, startupMax)) return false
    if (!inNumericRange(m.onBlock, onBlockMin, onBlockMax)) return false
    if (!inNumericRange(m.onHit, onHitMin, onHitMax)) return false
    if (properties && properties.length > 0) {
      return properties.every((prop) => m.properties.includes(prop))
    }
    return true
  })

  const truncated = results.length > effectiveLimit
  if (truncated) {
    results = results.slice(0, effectiveLimit)
  }

  return {
    attribution: DEFAULT_ATTRIBUTION,
    count: results.length,
    criteria: {
      category,
      character: characterId,
      limit: effectiveLimit,
      onBlockMax,
      onBlockMin,
      onHitMax,
      onHitMin,
      properties,
      startupMax,
      startupMin,
    },
    results,
    truncated,
  }
}

export interface FindPunishResult {
  situation: {
    opponentMove: { name: string; onBlock: number } | null
    myFrameAdvantage: number
  }
  punishable: boolean
  candidates: Move[]
  caveats: string[]
  attribution: Attribution
}

// 相手の技 or onBlock 値から、自分の有利フレームと相手技データを求める（分岐を切り出して複雑度を下げる）。
function resolveOpponentAdvantage(
  opponentCharacter: string | null | undefined,
  opponentMove: string | null | undefined,
  onBlock: number | null | undefined,
  characters: readonly Character[],
):
  | { frameAdvantage: number; opponentMoveData: Move | undefined }
  | { error: string; suggestions?: string[] } {
  if (opponentMove === null || opponentMove === undefined) {
    const adv = onBlock !== null && onBlock !== undefined && onBlock < 0 ? Math.abs(onBlock) : 0
    return { frameAdvantage: adv, opponentMoveData: undefined }
  }
  if (!opponentCharacter) {
    return { error: 'opponentCharacter required when opponentMove is specified' }
  }
  const oppChar = resolveCharacter(opponentCharacter, characters)
  if (!oppChar) {
    return {
      error: `Opponent character not found: ${opponentCharacter}`,
      suggestions: getCharacterSuggestions(opponentCharacter, characters),
    }
  }
  const match = resolveMoveBest(opponentMove, oppChar.moves)[0]
  if (!match) {
    return { error: `Opponent move not found: ${opponentMove}` }
  }
  const adv = match.onBlock !== null && match.onBlock < 0 ? Math.abs(match.onBlock) : 0
  return { frameAdvantage: adv, opponentMoveData: match }
}

/**
 * Tool: find_punish
 */
export function findPunishImpl(
  myCharacter: string,
  opponentCharacter: string | null | undefined,
  opponentMove: string | null | undefined,
  onBlock: number | null | undefined,
  maxStartup: number | null | undefined,
  characters: readonly Character[],
  language?: string,
): FindPunishResult | { error: string; suggestions?: string[]; attribution: Attribution } {
  const myChar = resolveCharacter(myCharacter, characters)
  if (!myChar) {
    return {
      attribution: DEFAULT_ATTRIBUTION,
      error: `My character not found: ${myCharacter}`,
      suggestions: getCharacterSuggestions(myCharacter, characters),
    }
  }

  const adv = resolveOpponentAdvantage(opponentCharacter, opponentMove, onBlock, characters)
  if ('error' in adv) {
    return { ...adv, attribution: DEFAULT_ATTRIBUTION }
  }
  const { frameAdvantage, opponentMoveData } = adv

  const effectiveMaxStartup = maxStartup ?? frameAdvantage

  const candidates = myChar.moves
    .filter((m) => m.startup !== null && m.startup <= effectiveMaxStartup)
    .sort((a, b) => {
      if (a.startup === null) return 1
      if (b.startup === null) return -1
      return a.startup - b.startup
    })

  return {
    attribution: DEFAULT_ATTRIBUTION,
    candidates,
    caveats: [
      'リーチ・距離・キャラ位置は考慮していません。実際に届くかは要確認です。',
      'ドライブラッシュやキャンセルでの確反は含みません。',
    ],
    punishable: candidates.length > 0,
    situation: {
      myFrameAdvantage: frameAdvantage,
      opponentMove:
        opponentMoveData &&
        opponentMoveData.onBlock !== null &&
        opponentMoveData.onBlock !== undefined
          ? {
              name:
                language === 'en'
                  ? opponentMoveData.name.en
                  : opponentMoveData.name.ja || opponentMoveData.name.en,
              onBlock: opponentMoveData.onBlock,
            }
          : null,
    },
  }
}

export interface ListCharactersResult {
  characters: Array<{ id: string; name: string; aliases: string[] }>
  attribution: Attribution
}

/**
 * Tool: list_characters
 */
export function listCharactersImpl(
  characters: readonly Character[],
  language?: string,
): ListCharactersResult {
  return {
    attribution: DEFAULT_ATTRIBUTION,
    characters: characters.map((c) => ({
      aliases: c.aliases,
      id: c.id,
      name: language === 'en' ? c.name.en : c.name.ja || c.name.en,
    })),
  }
}
