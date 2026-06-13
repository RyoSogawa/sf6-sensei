import { describe, expect, it } from 'vitest'
import { characterSchema, moveSchema, normalizeInput, resolveMove } from './index'

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
