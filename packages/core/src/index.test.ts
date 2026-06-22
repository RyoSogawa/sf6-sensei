import { describe, expect, it } from 'vitest'
import {
  characterMovementSchema,
  characterSchema,
  deriveNormalJaName,
  deriveTauntJaName,
  type Move,
  moveSchema,
  normalizeInput,
  parseJumpSpd,
  resolveMove,
  resolveMoveBest,
} from './index'

describe('normalizeInput', () => {
  it('handles numpad inputs', () => {
    expect(normalizeInput('236P')).toBe('236p')
    expect(normalizeInput('623K')).toBe('623k')
    expect(normalizeInput('2HP')).toBe('2hp')
    expect(normalizeInput('5LP')).toBe('5lp')
  })

  it('handles JP crouch notation with explicit buttons', () => {
    expect(normalizeInput('屈強P')).toBe('2hp')
    expect(normalizeInput('下大P')).toBe('2hp')
    expect(normalizeInput('cr.HP')).toBe('2hp')
  })

  it('handles JP stand notation', () => {
    expect(normalizeInput('5中K')).toBe('5mk')
    expect(normalizeInput('立中K')).toBe('5mk')
    expect(normalizeInput('st.LP')).toBe('5lp')
  })

  it('handles strength abbreviations with buttons', () => {
    expect(normalizeInput('2P')).toBe('2p')
    expect(normalizeInput('HP')).toBe('hp')
    expect(normalizeInput('MP')).toBe('mp')
    expect(normalizeInput('LP')).toBe('lp')
  })

  it('handles JP direction notation', () => {
    expect(normalizeInput('前K')).toBe('6k')
    expect(normalizeInput('後P')).toBe('4p')
    expect(normalizeInput('後ろ強K')).toBe('4hk')
  })

  it('returns null for empty or invalid inputs', () => {
    expect(normalizeInput('')).toBeNull()
    expect(normalizeInput('   ')).toBeNull()
  })

  it('handles mixed case', () => {
    expect(normalizeInput('2HP')).toBe('2hp')
    expect(normalizeInput('236P')).toBe('236p')
  })
})

describe('resolveMove', () => {
  const testMoves = [
    {
      active: '3',
      aliases: ['2強', '屈強P'],
      cancel: ['special', 'super'],
      category: 'normal' as const,
      characterId: 'ryu',
      id: 'ryu__2hp',
      input: { numpad: '2HP', official: 'しゃがみ大P' },
      name: { en: 'Crouching Heavy Punch', ja: 'しゃがみ大パンチ' },
      onBlock: -2,
      onHit: 4,
      properties: ['low'],
      recovery: 18,
      source: {
        fetchedAt: '2026-06-13T00:00:00Z',
        license: 'CC-BY-SA' as const,
        url: 'https://example.com',
      },
      startup: 7,
    },
    {
      active: null,
      aliases: ['波動'],
      cancel: [],
      category: 'special' as const,
      characterId: 'ryu',
      id: 'ryu__236p',
      input: { numpad: '236P', official: null },
      name: { en: 'Hadoken', ja: '波動拳' },
      onBlock: null,
      onHit: null,
      properties: ['projectile'],
      recovery: null,
      source: {
        fetchedAt: '2026-06-13T00:00:00Z',
        license: 'CC-BY-SA' as const,
        url: 'https://example.com',
      },
      startup: 6,
    },
    {
      active: '4',
      aliases: ['立中K'],
      cancel: ['special'],
      category: 'normal' as const,
      characterId: 'ryu',
      id: 'ryu__5mk',
      input: { numpad: '5MK', official: '立ち中K' },
      name: { en: 'Standing Medium Kick', ja: '立ち中キック' },
      onBlock: 0,
      onHit: 3,
      properties: [],
      recovery: 11,
      source: {
        fetchedAt: '2026-06-13T00:00:00Z',
        license: 'CC-BY-SA' as const,
        url: 'https://example.com',
      },
      startup: 5,
    },
  ]

  it('resolves by numpad input', () => {
    const result = resolveMove('2HP', testMoves)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ryu__2hp')
  })

  it('resolves by JP crouch notation via alias', () => {
    const result = resolveMove('2強', testMoves)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ryu__2hp')
  })

  it('resolves by JP crouch + strength via alias', () => {
    const result = resolveMove('屈強P', testMoves)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ryu__2hp')
  })

  it('resolves by motion input', () => {
    const result = resolveMove('236P', testMoves)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ryu__236p')
  })

  it('resolves by alias substring', () => {
    const result = resolveMove('波動', testMoves)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ryu__236p')
  })

  it('resolves by English name', () => {
    const result = resolveMove('Hadoken', testMoves)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ryu__236p')
  })

  it('resolves by JP name', () => {
    const result = resolveMove('波動拳', testMoves)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ryu__236p')
  })

  it('returns empty for no matches', () => {
    const result = resolveMove('999Z', testMoves)
    expect(result).toHaveLength(0)
  })

  it('returns empty for empty moves list', () => {
    const result = resolveMove('2HP', [])
    expect(result).toHaveLength(0)
  })

  it('ranks an exact input match above a name-substring match earlier in the list', () => {
    const src = {
      fetchedAt: '2026-06-13T00:00:00Z',
      license: 'CC-BY-SA' as const,
      url: 'https://example.com',
    }
    const rankMoves = [
      {
        active: null,
        aliases: [],
        cancel: [],
        category: 'normal' as const,
        characterId: 'ryu',
        id: 'name_match',
        input: { numpad: '5MP', official: null },
        name: { en: 'contains 2HP text', ja: null },
        onBlock: null,
        onHit: null,
        properties: [],
        recovery: null,
        source: src,
        startup: null,
      },
      {
        active: null,
        aliases: [],
        cancel: [],
        category: 'normal' as const,
        characterId: 'ryu',
        id: 'input_match',
        input: { numpad: '2HP', official: null },
        name: { en: 'Crouching Heavy Punch', ja: null },
        onBlock: null,
        onHit: null,
        properties: [],
        recovery: null,
        source: src,
        startup: null,
      },
    ]
    const result = resolveMove('2HP', rankMoves)
    expect(result[0].id).toBe('input_match')
  })
})

describe('resolveMoveBest', () => {
  const src = {
    fetchedAt: '2026-06-13T00:00:00Z',
    license: 'CC-BY-SA' as const,
    url: 'https://example.com',
  }
  function mk(overrides: Partial<Move> & Pick<Move, 'id' | 'input' | 'name'>): Move {
    return {
      active: null,
      aliases: [],
      cancel: [],
      category: 'normal',
      characterId: 'ryu',
      onBlock: null,
      onHit: null,
      properties: [],
      recovery: null,
      source: src,
      startup: null,
      ...overrides,
    }
  }

  const di = mk({
    aliases: ['ドライブインパクト', 'インパクト', 'DI', 'drive impact'],
    category: 'drive',
    id: 'ryu__hphk',
    input: { numpad: 'HPHK', official: null },
    name: { en: 'Shingeki', ja: 'ドライブインパクト' },
  })
  // Normals whose English name contains "di" ("Stan-di-ng" / "Me-di-um"). Prone to false matches on a short "DI" query.
  const standing = mk({
    id: 'ryu__5hp',
    input: { numpad: '5HP', official: null },
    name: { en: 'Standing Heavy Punch', ja: null },
  })
  const hadoLP = mk({
    id: 'ryu__236p',
    input: { numpad: '236P', official: null },
    name: { en: 'Hadoken (LP)', ja: '波動拳' },
  })
  const hadoHP = mk({
    id: 'ryu__236p',
    input: { numpad: '236P', official: null },
    name: { en: 'Hadoken (HP)', ja: '波動拳' },
  })
  const moves = [standing, di, hadoLP, hadoHP]

  it('returns only the exact-alias match for short query "DI", not name-substring junk', () => {
    const result = resolveMoveBest('DI', moves)
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('ryu__hphk')
  })

  it('finds Drive Impact by Japanese alias インパクト', () => {
    const result = resolveMoveBest('インパクト', moves)
    expect(result.map((m) => m.id)).toContain('ryu__hphk')
  })

  it('keeps all moves sharing an input (no id collapse)', () => {
    const result = resolveMoveBest('236P', moves)
    expect(result).toHaveLength(2)
    expect(result.map((m) => m.name.en).sort()).toEqual(['Hadoken (HP)', 'Hadoken (LP)'])
  })

  it('falls back to substring matches when nothing matches exactly', () => {
    const result = resolveMoveBest('standing', moves)
    expect(result.map((m) => m.id)).toEqual(['ryu__5hp'])
  })

  it('returns empty for no matches', () => {
    expect(resolveMoveBest('999Z', moves)).toHaveLength(0)
  })
})

describe('deriveNormalJaName', () => {
  it('derives systematic normals from numpad input', () => {
    expect(deriveNormalJaName('5LP')).toBe('立ち弱パンチ')
    expect(deriveNormalJaName('2HP')).toBe('しゃがみ強パンチ')
    expect(deriveNormalJaName('5MK')).toBe('立ち中キック')
    expect(deriveNormalJaName('j.HK')).toBe('ジャンプ強キック')
    expect(deriveNormalJaName('2lk')).toBe('しゃがみ弱キック')
  })

  it('returns null for command normals, target combos and proper-noun moves', () => {
    expect(deriveNormalJaName('236P')).toBeNull() // special
    expect(deriveNormalJaName('6HP')).toBeNull() // command normal
    expect(deriveNormalJaName('5HP~HK')).toBeNull() // target combo
    expect(deriveNormalJaName('HPHK')).toBeNull() // drive impact
    expect(deriveNormalJaName('4HK')).toBeNull() // directional command normal
  })
})

describe('deriveTauntJaName', () => {
  it('derives directional taunts, ignoring suffixes', () => {
    expect(deriveTauntJaName('Back Taunt')).toBe('後ろ挑発')
    expect(deriveTauntJaName('Neutral Taunt')).toBe('ニュートラル挑発')
    expect(deriveTauntJaName('Forward Taunt')).toBe('前挑発')
    expect(deriveTauntJaName('Down Taunt')).toBe('下挑発')
    expect(deriveTauntJaName('Forward Taunt (DL2)')).toBe('前挑発')
    expect(deriveTauntJaName('Back~Down Taunt')).toBe('後ろ下挑発')
  })

  it('returns null for non-taunts', () => {
    expect(deriveTauntJaName('Hadoken')).toBeNull()
    expect(deriveTauntJaName('Standing Heavy Punch')).toBeNull()
  })
})

describe('parseJumpSpd', () => {
  it('parses standard "4+38+3" format', () => {
    expect(parseJumpSpd('4+38+3')).toEqual({
      airborne: 38,
      landing: 3,
      startup: 4,
      text: '4+38+3',
      total: 45,
    })
  })

  it('parses longer airborne like Dhalsim "4+68+3"', () => {
    const result = parseJumpSpd('4+68+3')
    expect(result?.airborne).toBe(68)
    expect(result?.total).toBe(75)
  })

  it('handles <br>(...) alternate values by using primary only', () => {
    const result = parseJumpSpd('4+38+3<br>(6+40+3)')
    expect(result).toEqual({
      airborne: 38,
      landing: 3,
      startup: 4,
      text: '4+38+3',
      total: 45,
    })
  })

  it('returns null for empty or invalid input', () => {
    expect(parseJumpSpd('')).toBeNull()
    expect(parseJumpSpd('-')).toBeNull()
    expect(parseJumpSpd('abc')).toBeNull()
    expect(parseJumpSpd('4+38')).toBeNull()
  })
})

describe('characterMovementSchema', () => {
  it('validates a complete movement object', () => {
    const movement = {
      backwardDashDistance: '0.923',
      backwardDashFrames: 23,
      backwardJumpDistance: '1.52',
      backwardWalkSpeed: '0.032',
      driveRush: { block: '1.878', max: '3.628', min: '0.525' },
      forwardDashDistance: '1.252',
      forwardDashFrames: 19,
      forwardJumpDistance: '1.90',
      forwardWalkSpeed: '0.047',
      jump: { airborne: 38, landing: 3, startup: 4, text: '4+38+3', total: 45 },
      jumpApex: '2.115',
      throwHurtbox: null,
      throwRange: '0.8',
    }
    expect(() => characterMovementSchema.parse(movement)).not.toThrow()
  })
})

describe('zod schemas', () => {
  it('validates a valid Move', () => {
    const move = {
      active: null,
      aliases: [],
      cancel: [],
      category: 'normal' as const,
      characterId: 'test',
      id: 'test__2hp',
      input: { numpad: '2HP', official: null },
      name: { en: 'Test', ja: 'テスト' },
      onBlock: -2,
      onHit: 4,
      properties: [],
      recovery: 18,
      source: {
        fetchedAt: '2026-06-13T00:00:00Z',
        license: 'CC-BY-SA' as const,
        url: 'https://example.com',
      },
      startup: 7,
    }
    expect(() => moveSchema.parse(move)).not.toThrow()
  })

  it('validates a valid Character', () => {
    const character = {
      aliases: [],
      id: 'test',
      moves: [],
      name: { en: 'Test', ja: 'テスト' },
      source: {
        fetchedAt: '2026-06-13T00:00:00Z',
        license: 'CC-BY-SA' as const,
        url: 'https://example.com',
      },
    }
    expect(() => characterSchema.parse(character)).not.toThrow()
  })

  it('rejects invalid Move (missing required field)', () => {
    const invalid = {
      characterId: 'test',
      id: 'test__2hp',
      name: { en: 'Test', ja: 'テスト' },
    }
    expect(() => moveSchema.parse(invalid)).toThrow()
  })
})
