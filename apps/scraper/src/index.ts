// SuperCombo (CC-BY-SA) からフレームデータを取得する正攻法クライアント。
// アクセス方針は docs/spec.md「取得の許諾とアクセス方針」を厳守する:
//   - エンドポイントは srk.shib.live/api.php のみ（robots 遵守）
//   - 正直な識別 User-Agent（偽装しない）
//   - 低頻度の手動バッチ + キャッシュ、出典明記 + CC-BY-SA 継承

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Character, characterSchema, type Move, normalizeInput } from '@repo/core'

const API = 'https://srk.shib.live/api.php'
const USER_AGENT =
  'sf6-sensei/0.1 (+https://github.com/RyoSogawa/sf6-sensei) personal-noncommercial'

export interface CargoQueryParams {
  tables: string
  fields: string
  where?: string
  limit?: number
  offset?: number
}

export function buildCargoQueryUrl(params: CargoQueryParams): string {
  const url = new URL(API)
  url.searchParams.set('action', 'cargoquery')
  url.searchParams.set('format', 'json')
  url.searchParams.set('tables', params.tables)
  url.searchParams.set('fields', params.fields)
  if (params.where) {
    url.searchParams.set('where', params.where)
  }
  url.searchParams.set('limit', String(params.limit ?? 500))
  url.searchParams.set('offset', String(params.offset ?? 0))
  return url.toString()
}

export async function cargoQuery(params: CargoQueryParams): Promise<unknown[]> {
  const res = await fetch(buildCargoQueryUrl(params), {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) {
    throw new Error(`cargoquery failed: HTTP ${res.status}`)
  }
  const json = (await res.json()) as { cargoquery?: { title: unknown }[] }
  return (json.cargoquery ?? []).map((row) => row.title)
}

// 取得元の HTML / wiki マークアップ除去（probe で全 2306 行クリーンを確認済み）
export function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/'''?/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

// Normalization functions (pure, testable)

export interface ParsedAdvantage {
  value: number | null
  knockdown: boolean
  text: string
}

/**
 * Parse advantage strings (hitAdv, blockAdv, punishAdv, etc.)
 * Examples:
 *   "+4" → { value: 4, knockdown: false, text: "+4" }
 *   "-7" → { value: -7, knockdown: false, text: "-7" }
 *   "KD +23" → { value: 23, knockdown: true, text: "KD +23" }
 *   "HKD +18" → { value: 18, knockdown: true, text: "HKD +18" }
 *   "-" → { value: null, knockdown: false, text: "-" }
 *   "{{{fieldName}}}" → { value: null, knockdown: false, text: "{{{fieldName}}}" }
 *   "Crumple (...)" → { value: null, knockdown: false, text: "Crumple (...)" }
 */
export function parseAdvantage(raw: string): ParsedAdvantage {
  const text = stripMarkup(raw)

  if (!text || text === '-' || text.includes('{{{')) {
    return { knockdown: false, text, value: null }
  }

  const knockdownMatch = text.match(/^(KD|HKD)\s*\+(\d+)/i)
  if (knockdownMatch) {
    return {
      knockdown: true,
      text,
      value: Number(knockdownMatch[2]),
    }
  }

  // 先頭が符号付き数値のときだけ採用する。"Crumple (Standing +21, ...)" のような
  // 複合状況文字列は先頭が数値でないため null になり、text に原文を残す。
  const numberMatch = text.match(/^([+-]?\d+)/)
  if (numberMatch) {
    return {
      knockdown: false,
      text,
      value: Number(numberMatch[1]),
    }
  }

  return { knockdown: false, text, value: null }
}

export interface ParsedFrameValue {
  value: number | null
  text: string
}

/**
 * Parse frame values (startup, active, recovery, etc.)
 * Examples:
 *   "7" → { value: 7, text: "7" }
 *   "3" → { value: 3, text: "3" }
 *   "3 land" → { value: 3, text: "3 land" }
 *   "11(13)" → { value: 11, text: "11(13)" }
 *   "18~" → { value: 18, text: "18~" }
 *   "12 or until released" → { value: 12, text: "12 or until released" }
 *   "-" → { value: null, text: "-" }
 *   "{{{fieldName}}}" → { value: null, text: "{{{fieldName}}}" }
 */
export function parseFrameValue(raw: string): ParsedFrameValue {
  const text = stripMarkup(raw)

  if (!text || text === '-' || text.includes('{{{')) {
    return { text, value: null }
  }

  const numberMatch = text.match(/^(\d+)/)
  if (numberMatch) {
    return {
      text,
      value: Number(numberMatch[1]),
    }
  }

  return { text, value: null }
}

/**
 * Parse cancel codes
 * Examples:
 *   "Chn Sp SA TC" → ["chain", "special", "super", "target_combo"]
 *   "Sp, SA1" → ["special", "super"]
 *   "SA2(2nd)" → ["super"]
 *   "-" or "" → []
 */
export function parseCancel(raw: string): string[] {
  if (!raw || raw === '-') return []

  const text = stripMarkup(raw)
    .replace(/\([^)]*\)/g, '') // remove parenthetical notes
    .replace(/\*/g, '') // remove asterisks
    .trim()

  if (!text) return []

  const codes = text.split(/[\s,]+/).filter((c) => c.length > 0)
  const result: string[] = []

  for (const code of codes) {
    const lower = code.toLowerCase()
    switch (lower) {
      case 'chn':
      case 'chain':
        result.push('chain')
        break
      case 'sp':
      case 'special':
        result.push('special')
        break
      case 'sa':
      case 'sa1':
      case 'sa2':
      case 'sa3':
      case 'super':
        result.push('super')
        break
      case 'ca':
      case 'critical':
        result.push('critical_art')
        break
      case 'tc':
      case 'target_combo':
        result.push('target_combo')
        break
      case 'dr':
      case 'drive_rush':
        result.push('drive_rush')
        break
      case 'di':
      case 'drive_impact':
        result.push('drive_impact')
        break
      default:
        if (lower && !result.includes(lower)) {
          result.push(lower.toLowerCase())
        }
    }
  }

  return Array.from(new Set(result)) // deduplicate
}

function addGuardIfMissing(result: string[], guard: string): void {
  if (!result.includes(guard)) {
    result.push(guard)
  }
}

function mapGuardCode(part: string, result: string[]): void {
  const upper = part.toUpperCase()
  const codeLookup: Record<string, string> = {
    H: 'high',
    HIGH: 'high',
    L: 'low',
    LOW: 'low',
    T: 'throw',
    THROW: 'throw',
  }

  if (codeLookup[upper]) {
    addGuardIfMissing(result, codeLookup[upper])
  } else if (upper === 'LH' || (upper.includes('L') && upper.includes('H'))) {
    addGuardIfMissing(result, 'low')
    addGuardIfMissing(result, 'high')
  } else {
    for (const char of upper) {
      const mapped = codeLookup[char]
      if (mapped) {
        addGuardIfMissing(result, mapped)
      }
    }
  }
}

/**
 * Parse guard codes
 * Examples:
 *   "L" → ["low"]
 *   "H" → ["high"]
 *   "LH" → ["low", "high"]
 *   "L,H" → ["low", "high"]
 *   "Throw" → ["throw"]
 */
export function parseGuard(raw: string): string[] {
  if (!raw) return []

  const text = stripMarkup(raw).replace(/\*/g, '').trim()
  if (!text) return []

  const result: string[] = []
  const parts = text.split(',').map((p) => p.trim())

  for (const part of parts) {
    mapGuardCode(part, result)
  }

  return Array.from(new Set(result))
}

/**
 * Map moveType values to MoveCategory
 * Case-insensitive. Normalizes variations like Special/special, Super/super.
 */
export function mapMoveType(
  raw: string,
):
  | 'normal'
  | 'command_normal'
  | 'special'
  | 'super_art'
  | 'critical_art'
  | 'throw'
  | 'drive'
  | 'taunt' {
  const lower = raw.toLowerCase().trim()

  if (lower.includes('ground_normal') || lower.includes('air_normal') || lower === 'normal') {
    return 'normal'
  }
  if (lower.includes('special') || lower.includes('serenity_stream')) {
    return 'special'
  }
  if (lower.includes('super')) {
    return 'super_art'
  }
  if (lower.includes('critical') || lower.includes('ca')) {
    return 'critical_art'
  }
  if (lower.includes('throw')) {
    return 'throw'
  }
  if (lower.includes('drive')) {
    return 'drive'
  }
  if (lower.includes('taunt')) {
    return 'taunt'
  }

  console.warn(`Unknown moveType: "${raw}", defaulting to "normal"`)
  return 'normal'
}

/**
 * Character ID slug mapping (case-insensitive, punctuation normalization)
 */
export function getCharacterSlug(charaName: string): string {
  const lower = charaName.toLowerCase().trim()

  const slugMap: Record<string, string> = {
    'a.k.i': 'aki',
    'a.k.i.': 'aki',
    aki: 'aki',
    blanka: 'blanka',
    cammy: 'cammy',
    chun: 'chunli',
    'chun-li': 'chunli',
    'dee jay': 'dee_jay',
    dee_jay: 'dee_jay',
    deejay: 'dee_jay',
    dhalsim: 'dhalsim',
    'e honda': 'e_honda',
    'e.honda': 'e_honda',
    ed: 'ed',
    ehonda: 'e_honda',
    guile: 'guile',
    jp: 'jp',
    juri: 'juri',
    'juri han': 'juri',
    ken: 'ken',
    kimberly: 'kimberly',
    laura: 'laura',
    lily: 'lily',
    luke: 'luke',
    'm bison': 'm_bison',
    'm.bison': 'm_bison',
    manon: 'manon',
    marisa: 'marisa',
    mbison: 'm_bison',
    ryu: 'ryu',
    't hawk': 't_hawk',
    't. hawk': 't_hawk',
    thawk: 't_hawk',
    zangief: 'zangief',
  }

  if (lower in slugMap) {
    return slugMap[lower] ?? lower
  }

  // Default: lowercase, remove dots, replace spaces/hyphens with underscore
  return lower.replace(/\./g, '').replace(/[\s-]/g, '_')
}

/**
 * Parse a leading numeric value, tolerating wiki markup, brackets and parenthetical
 * secondary values. Examples:
 *   "2000" → 2000, "[8000]" → 8000, "1000 (700)" → 1000, "1.545" → 1.545,
 *   "500x2" → 500, "{{{field}}}" / "-" / "" → null
 */
export function parseNumber(raw: string): number | null {
  const text = stripMarkup(raw)
  if (!text || text === '-' || text.includes('{{{')) return null
  const match = text.replace(/[[\]]/g, '').match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

export interface ParsedDamage {
  value: number | null
  text: string | null
}

/**
 * Parse a damage value, keeping the raw text only when it is a compound expression.
 *   "800" → { value: 800, text: null }
 *   "500x2" → { value: 500, text: "500x2" }
 *   "1400(800)" → { value: 1400, text: "1400(800)" }
 *   "{{{damage}}}" / "-" → { value: null, text: null }
 */
export function parseDamage(raw: string): ParsedDamage {
  const text = stripMarkup(raw)
  if (!text || text === '-' || text.includes('{{{')) return { text: null, value: null }
  const match = text.match(/^(\d+)/)
  const value = match ? Number(match[1]) : null
  return { text: value !== null && text === String(value) ? null : text, value }
}

// 任意テキスト列をクリーンな文字列 or null に正規化する（未入力テンプレ/ハイフンは null）。
function textOrNull(raw: unknown): string | null {
  const text = stripMarkup(String(raw ?? ''))
  if (!text || text === '-' || text.includes('{{{')) return null
  return text
}

// オブジェクトの全フィールドが null なら null を返す（疎なグループ列をまとめる）。
function nullIfAllEmpty<T extends Record<string, unknown>>(obj: T): T | null {
  return Object.values(obj).some((value) => value !== null) ? obj : null
}

export interface SF6FrameDataRow {
  moveId?: string
  moveType?: string
  chara?: string
  input?: string
  name?: string
  damage?: string
  chip?: string
  dmgScaling?: string
  startup?: string
  active?: string
  recovery?: string
  total?: string
  hitAdv?: string
  blockAdv?: string
  punishAdv?: string
  perfParryAdv?: string
  DRcancelHit?: string
  DRcancelBlk?: string
  afterDRHit?: string
  afterDRBlk?: string
  hitstun?: string
  blockstun?: string
  hitstop?: string
  driveDmgHit?: string
  driveDmgBlk?: string
  driveGain?: string
  superGainHit?: string
  superGainBlk?: string
  invuln?: string
  armor?: string
  airborne?: string
  jugStart?: string
  jugIncrease?: string
  jugLimit?: string
  projSpeed?: string
  atkRange?: string
  pushbackHit?: string
  pushbackBlk?: string
  guard?: string
  cancel?: string
  notes?: string
  [key: string]: unknown
}

export interface SF6CharacterDataRow {
  chara?: string
  name?: string
  hp?: string
  [key: string]: unknown
}

// 行から指定列を文字列で取り出す（未定義は空文字）。?? をここに閉じ込め toMove の複雑度を下げる。
function col(row: SF6FrameDataRow, key: string): string {
  return String(row[key] ?? '')
}

/**
 * Convert a SF6_FrameData row to a Move object
 */
export function toMove(row: SF6FrameDataRow, characterId: string, fetchedAt: string): Move {
  const input = col(row, 'input').trim()
  const inputNorm = normalizeInput(input) || input.toLowerCase()
  const damageParsed = parseDamage(col(row, 'damage'))
  const invuln = textOrNull(row.invuln)
  const armor = textOrNull(row.armor)
  const airborne = textOrNull(row.airborne)

  // properties = ガード方向タグ + 無敵/アーマー/空中の有無タグ（search_moves の属性検索用）。
  const properties: string[] = [...parseGuard(col(row, 'guard'))]
  if (invuln) properties.push('invincible')
  if (armor) properties.push('armor')
  if (airborne) properties.push('airborne')

  // 出典は正典の SuperCombo ページを指す（取得は mirror API 経由だが attribution は本家を示す）
  const pageName = col(row, 'chara').trim().replace(/ /g, '_')
  const sourceUrl = `https://wiki.supercombo.gg/w/Street_Fighter_6/${pageName}/Frame_data`

  return {
    active: parseFrameValue(col(row, 'active')).text,
    afterDriveRush: nullIfAllEmpty({
      onBlock: parseAdvantage(col(row, 'afterDRBlk')).value,
      onHit: parseAdvantage(col(row, 'afterDRHit')).value,
    }),
    airborne,
    aliases: [],
    armor,
    attackRange: parseNumber(col(row, 'atkRange')),
    blockstun: parseFrameValue(col(row, 'blockstun')).value,
    cancel: parseCancel(col(row, 'cancel')),
    category: mapMoveType(col(row, 'moveType') || 'normal'),
    characterId,
    chipDamage: parseNumber(col(row, 'chip')),
    damage: damageParsed.value,
    damageText: damageParsed.text,
    dmgScaling: textOrNull(row.dmgScaling),
    driveGauge: nullIfAllEmpty({
      dealtOnBlock: parseNumber(col(row, 'driveDmgBlk')),
      dealtOnHit: parseNumber(col(row, 'driveDmgHit')),
      gain: parseNumber(col(row, 'driveGain')),
    }),
    driveRushCancel: nullIfAllEmpty({
      onBlock: parseAdvantage(col(row, 'DRcancelBlk')).value,
      onHit: parseAdvantage(col(row, 'DRcancelHit')).value,
    }),
    hitstop: parseFrameValue(col(row, 'hitstop')).value,
    hitstun: parseFrameValue(col(row, 'hitstun')).value,
    id: `${characterId}__${inputNorm}`,
    input: { numpad: input, official: null },
    invuln,
    juggle: nullIfAllEmpty({
      increase: textOrNull(row.jugIncrease),
      limit: textOrNull(row.jugLimit),
      start: textOrNull(row.jugStart),
    }),
    name: { en: col(row, 'name').trim(), ja: null },
    notes: nullIfAllEmpty({ en: textOrNull(row.notes), ja: null }),
    onBlock: parseAdvantage(col(row, 'blockAdv')).value,
    onHit: parseAdvantage(col(row, 'hitAdv')).value,
    onPerfectParry: parseAdvantage(col(row, 'perfParryAdv')).value,
    onPunishCounter: parseAdvantage(col(row, 'punishAdv')).value,
    projectileSpeed: parseNumber(col(row, 'projSpeed')),
    properties,
    pushback: nullIfAllEmpty({
      onBlock: textOrNull(row.pushbackBlk),
      onHit: textOrNull(row.pushbackHit),
    }),
    recovery: parseFrameValue(col(row, 'recovery')).value,
    source: { fetchedAt, license: 'CC-BY-SA', url: sourceUrl },
    startup: parseFrameValue(col(row, 'startup')).value,
    superGauge: nullIfAllEmpty({
      onBlock: parseNumber(col(row, 'superGainBlk')),
      onHit: parseNumber(col(row, 'superGainHit')),
    }),
    totalFrames: parseFrameValue(col(row, 'total')).value,
  }
}

async function fetchCharacterData(
  limit: number,
): Promise<[Map<string, Character>, SF6CharacterDataRow[]]> {
  console.log('Fetching character data...')

  const characters = new Map<string, Character>()
  const characterDataRows: SF6CharacterDataRow[] = []
  let offset = 0

  while (true) {
    const data = await cargoQuery({
      fields: 'chara,name,hp',
      limit,
      offset,
      tables: 'SF6_CharacterData',
    })

    if (data.length === 0) break

    for (const row of data) {
      characterDataRows.push(row as SF6CharacterDataRow)
    }

    if (data.length < limit) break
    offset += limit
  }

  console.log(`Fetched ${characterDataRows.length} character entries`)

  // Build character stub map
  for (const charRow of characterDataRows) {
    const charaName = String(charRow.chara ?? '').trim()
    if (!charaName) continue

    const slug = getCharacterSlug(charaName)
    if (!characters.has(slug)) {
      characters.set(slug, {
        aliases: [],
        id: slug,
        moves: [],
        name: { en: charaName, ja: null },
        source: {
          fetchedAt: new Date().toISOString(),
          license: 'CC-BY-SA',
          url: 'https://wiki.supercombo.gg/w/Street_Fighter_6',
        },
      })
    }
  }

  return [characters, characterDataRows]
}

function addOrGetCharacter(
  characters: Map<string, Character>,
  characterId: string,
  charaName: string,
  fetchedAt: string,
): Character {
  let character = characters.get(characterId)

  if (!character) {
    character = {
      aliases: [],
      id: characterId,
      moves: [],
      name: { en: charaName, ja: null },
      source: {
        fetchedAt,
        license: 'CC-BY-SA',
        url: 'https://wiki.supercombo.gg/w/Street_Fighter_6',
      },
    }
    characters.set(characterId, character)
  }

  return character
}

async function fetchFrameDataPage(
  characters: Map<string, Character>,
  frameDataUrl: string,
  offset: number,
): Promise<number> {
  const url = `${frameDataUrl}&offset=${offset}`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })

  if (!res.ok) {
    throw new Error(`cargoquery failed: HTTP ${res.status}`)
  }

  const json = (await res.json()) as { cargoquery?: { title: unknown }[] }
  const data = (json.cargoquery ?? []).map((row) => row.title)

  if (data.length === 0) return 0

  const fetchedAt = new Date().toISOString()

  for (const row of data) {
    const frameRow = row as SF6FrameDataRow
    const charaName = String(frameRow.chara ?? '').trim()

    if (!charaName) continue

    const characterId = getCharacterSlug(charaName)
    const character = addOrGetCharacter(characters, characterId, charaName, fetchedAt)
    const move = toMove(frameRow, characterId, fetchedAt)
    character.moves.push(move)
  }

  console.log(`Processed offset ${offset}, data rows: ${data.length}`)
  return data.length
}

async function fetchFrameData(characters: Map<string, Character>, limit: number): Promise<void> {
  console.log('Fetching frame data...')

  const frameDataUrl = buildCargoQueryUrl({
    fields: [
      'moveId,moveType,chara,input,name',
      'damage,chip,dmgScaling',
      'startup,active,recovery,total',
      'hitAdv,blockAdv,punishAdv,perfParryAdv',
      'DRcancelHit,DRcancelBlk,afterDRHit,afterDRBlk',
      'hitstun,blockstun,hitstop',
      'driveDmgHit,driveDmgBlk,driveGain,superGainHit,superGainBlk',
      'invuln,armor,airborne',
      'jugStart,jugIncrease,jugLimit,projSpeed,atkRange,pushbackHit,pushbackBlk',
      'guard,cancel,notes',
    ].join(','),
    tables: 'SF6_FrameData',
  })

  let offset = 0

  while (true) {
    const rowCount = await fetchFrameDataPage(characters, frameDataUrl, offset)

    if (rowCount === 0) break

    if (rowCount < limit) break

    offset += limit

    // Small delay between pages (polite crawling)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

/**
 * Fetch all SF6 frame data and build Character array
 */
export async function fetchAllFrameData(): Promise<Character[]> {
  const limit = 500
  const [characters] = await fetchCharacterData(limit)
  await fetchFrameData(characters, limit)

  const result = Array.from(characters.values())
  const totalMoves = result.reduce((sum, c) => sum + c.moves.length, 0)
  console.log(`Built ${result.length} characters with ${totalMoves} total moves`)

  return result
}

// キャラ id を JS の識別子に変換（import 名用。snake_case のみだが念のため正規化）。
function importName(id: string): string {
  return `c_${id.replace(/[^a-zA-Z0-9_]/g, '_')}`
}

/**
 * Write characters as per-character JSON files + an auto-generated index.ts barrel.
 * 1ファイルだと巨大になり再スクレイプ差分が見づらいので、キャラ単位に分割する。
 * index.ts が各 JSON を静的 import して結合配列を default export する（実行時に1配列へ）。
 */
export function writeCharactersData(characters: Character[], outDir: string): void {
  for (const character of characters) {
    characterSchema.parse(character)
  }

  mkdirSync(outDir, { recursive: true })

  const sorted = [...characters].sort((a, b) => a.id.localeCompare(b.id))
  for (const character of sorted) {
    writeFileSync(join(outDir, `${character.id}.json`), `${JSON.stringify(character, null, 2)}\n`)
  }

  const imports = sorted.map((c) => `import ${importName(c.id)} from './${c.id}.json'`).join('\n')
  const entries = sorted.map((c) => `  ${importName(c.id)},`).join('\n')
  const indexTs = `// AUTO-GENERATED by apps/scraper (pnpm --filter @repo/scraper fetch). Do not edit by hand.
${imports}

export default [
${entries}
]
`
  writeFileSync(join(outDir, 'index.ts'), indexTs)
  console.log(`Wrote ${sorted.length} character files + index.ts to ${outDir}`)
}

// Main CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = new URL('../../../packages/data/src/generated/', import.meta.url).pathname

  fetchAllFrameData()
    .then((characters) => writeCharactersData(characters, outDir))
    .then(() => {
      console.log('Done!')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Fatal error:', err)
      process.exit(1)
    })
}
