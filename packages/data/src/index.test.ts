import { type CharacterMovement, resolveMove, resolveMoveBest } from '@repo/core'
import { describe, expect, it } from 'vitest'
import { characters, dataVersion, generateMovementMoves } from './index'

const SRC = {
  fetchedAt: '2026-06-13T00:00:00Z',
  license: 'CC-BY-SA' as const,
  url: 'https://example.com',
}

const RYU_MOVEMENT: CharacterMovement = {
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

describe('generateMovementMoves', () => {
  const moves = generateMovementMoves(RYU_MOVEMENT, 'ryu', SRC)

  it('generates forward dash / back dash / jump pseudo-moves', () => {
    expect(moves.map((m) => m.id)).toEqual(['ryu__66', 'ryu__44', 'ryu__j'])
    expect(moves.every((m) => m.category === 'movement')).toBe(true)
  })

  it('maps dash totals to totalFrames', () => {
    const fdash = moves.find((m) => m.id === 'ryu__66')
    expect(fdash?.totalFrames).toBe(19)
    expect(fdash?.name.ja).toBe('前ダッシュ')
    expect(moves.find((m) => m.id === 'ryu__44')?.totalFrames).toBe(23)
  })

  it('maps the jump breakdown to startup / active / recovery / total', () => {
    const jump = moves.find((m) => m.id === 'ryu__j')
    expect(jump?.startup).toBe(4) // jump transition (移行)
    expect(jump?.active).toBe('38') // airborne (滞空)
    expect(jump?.recovery).toBe(3) // landing (着地)
    expect(jump?.totalFrames).toBe(45)
  })

  it('is resolvable by alias via core resolveMoveBest', () => {
    expect(resolveMoveBest('前ダッシュ', moves).map((m) => m.id)).toEqual(['ryu__66'])
    expect(resolveMoveBest('バクステ', moves).map((m) => m.id)).toEqual(['ryu__44'])
    expect(resolveMoveBest('ジャンプ移行', moves).map((m) => m.id)).toEqual(['ryu__j'])
  })

  it('skips a pseudo-move when its frame data is absent', () => {
    const partial = generateMovementMoves(
      { ...RYU_MOVEMENT, forwardDashFrames: null, jump: null },
      'ryu',
      SRC,
    )
    expect(partial.map((m) => m.id)).toEqual(['ryu__44'])
  })
})

describe('generated data', () => {
  it('contains the full roster', () => {
    expect(characters.length).toBeGreaterThan(20)
  })

  it('includes ryu with moves', () => {
    const ryu = characters.find((c) => c.id === 'ryu')
    expect(ryu).toBeDefined()
    expect(ryu?.moves.length ?? 0).toBeGreaterThan(0)
  })

  it('resolves a JP notation query against real ryu data', () => {
    const ryu = characters.find((c) => c.id === 'ryu')
    // "屈強P" specifies P/K explicitly, so normalizeInput alone uniquely resolves it to 2HP.
    // P/K-omitting forms like "2強" are expected to be filled in by the alias-overrides layer.
    const hits = resolveMove('屈強P', ryu?.moves ?? [])
    expect(hits.some((m) => m.input.numpad === '2HP')).toBe(true)
  })

  it('exposes a data version', () => {
    expect(typeof dataVersion).toBe('string')
  })
})

describe('alias-overrides enrichment (common system moves)', () => {
  const ryu = characters.find((c) => c.id === 'ryu')

  it('adds Japanese name + aliases to Drive Impact (HPHK)', () => {
    const di = ryu?.moves.find((m) => m.input.numpad === 'HPHK')
    expect(di?.name.ja).toBe('ドライブインパクト')
    expect(di?.aliases).toEqual(expect.arrayContaining(['インパクト', 'DI']))
  })

  it('resolves common system moves by Japanese name across the roster', () => {
    const cases: Array<[string, string]> = [
      ['インパクト', 'HPHK'],
      ['ドライブパリィ', 'MPMK'],
      ['投げ', 'LPLK'],
      ['裏投げ', '4LPLK'],
    ]
    for (const [query, expectedInput] of cases) {
      const hits = resolveMoveBest(query, ryu?.moves ?? [])
      expect(hits.some((m) => m.input.numpad === expectedInput)).toBe(true)
    }
  })

  it('resolves the down throw (下投げ / 2投げ) for characters that have a 2LPLK command throw', () => {
    // Only alex / dhalsim / zangief have 2LPLK (command-throw types).
    for (const id of ['alex', 'dhalsim', 'zangief']) {
      const char = characters.find((c) => c.id === id)
      for (const query of ['下投げ', '2投げ']) {
        const hits = resolveMoveBest(query, char?.moves ?? [])
        expect(hits.some((m) => m.input.numpad === '2LPLK')).toBe(true)
      }
    }
    // A character without 2LPLK (ryu) returns 0 (does not erroneously return anything).
    expect(resolveMoveBest('下投げ', ryu?.moves ?? [])).toHaveLength(0)
  })

  it('auto-derives Japanese names for systematic normals', () => {
    const find = (numpad: string) => ryu?.moves.find((m) => m.input.numpad === numpad)
    expect(find('5LP')?.name.ja).toBe('立ち弱パンチ')
    expect(find('2HP')?.name.ja).toBe('しゃがみ強パンチ')
    expect(find('j.MK')?.name.ja).toBe('ジャンプ中キック')
  })

  it('fills proper-noun and taunt Japanese names (translations + taunt derivation)', () => {
    const byName = (en: string) => ryu?.moves.find((m) => m.name.en === en)
    // Manual translation layer (matched by base name even with a suffix)
    expect(
      ryu?.moves.find((m) => m.input.numpad === '236HP' && m.name.en === 'Hadoken')?.name.ja,
    ).toBe('波動拳')
    expect(byName('Shin Shoryuken (CA)')?.name.ja).toBe('真・昇龍拳') // matched after stripping Lv/(CA) suffix
    expect(byName('Collarbone Breaker')?.name.ja).toBe('鎖骨割り')
    // Taunts are auto-derived
    expect(byName('Down Taunt')?.name.ja).toBe('下挑発')
  })

  it('fills Japanese names for target combos and chained derivatives (frame-search)', () => {
    // Target combos (normals chained with ~). Matched by base name.
    const byInput = (id: string, np: string) =>
      characters.find((c) => c.id === id)?.moves.find((m) => m.input.numpad === np)
    expect(byInput('ryu', '5HP~HK')?.name.ja).toBe('上段二連撃') // High Double Strike
    expect(byInput('ryu', '5MP~LK')?.name.ja).toBe('不破三連撃（2段目）') // Fuwa Triple Strike 1
    expect(byInput('ken', '5MK~MK')?.name.ja).toBe('閃光連脚（2段目）') // Triple Flash Kicks 1
    expect(byInput('luke', '5LP~MP')?.name.ja).toBe('トリプルインパクト（2段目）') // Triple Impact
    // Cases disambiguated by input/name among multiple candidates
    expect(byInput('zangief', '1LPLK')?.name.ja).toBe('ロシアンドロップ') // Russian Drop
    expect(byInput('jp', '5HK~HP~HK')?.name.ja).toBe('ジラントナガー') // Zilant Low (distinguished by final button)
    // Frame-offset cases recovered via the button sequence (continuation numbering of sibling moves)
    expect(byInput('dee_jay', '5LP~MK~MK')?.name.ja).toBe('3ビートコンボ（3段目）') // Threebeat Combo 2
    expect(byInput('elena', '6HP~HP~HP')?.name.ja).toBe('トランクスラップ（3段目）') // Trunk Slap 3
  })

  it('keys variant-specific names by full name (Marisa Style HK/HP/j.HP differ)', () => {
    const marisa = characters.find((c) => c.id === 'marisa')
    const byName = (en: string) => marisa?.moves.find((m) => m.name.en === en)
    // The same "Marisa Style" has different names for (HK)/(HP)/(j.HP) → resolved by full-name key
    expect(byName('Marisa Style (HK)')?.name.ja).toBe('立ち強K（リブブレイク）（ホールド）')
    expect(byName('Marisa Style (j.HP)')?.name.ja).toBe('カエルムアーク（ホールド）')
  })

  it('adds SA1/SA2/aerial aliases to super arts', () => {
    const cammy = characters.find((c) => c.id === 'cammy')
    // SA1 = Spin Drive Smasher (236236K), SA2 = Killer Bee Spin (214214P) (per official frame-search)
    expect(
      resolveMoveBest('SA1', cammy?.moves ?? []).some((m) => m.input.numpad === '236236K'),
    ).toBe(true)
    expect(
      resolveMoveBest('SA2', cammy?.moves ?? []).some((m) => m.input.numpad === '214214P'),
    ).toBe(true)
    // Aerial SA2 = Aerial Killer Bee Spin (j.214214P)
    expect(
      resolveMoveBest('空中SA2', cammy?.moves ?? []).some((m) => m.input.numpad.startsWith('j.')),
    ).toBe(true)
  })

  it('registers both of Akuma’s Critical Arts (incl. Shun Goku Satsu, which has no SA-level input)', () => {
    const akuma = characters.find((c) => c.id === 'akuma')
    const ca = resolveMoveBest('CA', akuma?.moves ?? [])
    const names = ca.map((m) => m.name.en)
    expect(names.some((n) => n.includes('Sip of Calamity'))).toBe(true)
    expect(names.some((n) => n.includes('Shun Goku Satsu'))).toBe(true)
    // Also queryable by 瞬獄殺 (kanji)
    expect(
      resolveMoveBest('瞬獄殺', akuma?.moves ?? []).some((m) =>
        m.name.en.includes('Shun Goku Satsu'),
      ),
    ).toBe(true)
  })

  it('excludes non-curated (boss/extra) super arts from SA queries', () => {
    const bison = characters.find((c) => c.id === 'm_bison')
    // Final Psycho Crusher (214214P) is none of SA1/2/3 → not hit by SA-style queries.
    const hits = ['SA', 'SA1', 'SA2', 'SA3', 'CA'].flatMap((q) =>
      resolveMoveBest(q, bison?.moves ?? []),
    )
    expect(hits.some((m) => m.name.en === 'Final Psycho Crusher')).toBe(false)
  })

  it('distinguishes SA3 (normal) from CA (low-health enhanced) as separate entries', () => {
    // SA3 → normal version (does not include (CA)). CA → "(CA)" version. Separate records.
    const sa3 = resolveMoveBest('SA3', ryu?.moves ?? [])
    expect(sa3.length).toBeGreaterThan(0)
    expect(sa3.every((m) => !m.name.en.includes('(CA)'))).toBe(true)
    expect(sa3.some((m) => m.name.en === 'Shin Shoryuken')).toBe(true)

    const ca = resolveMoveBest('CA', ryu?.moves ?? [])
    expect(ca.length).toBeGreaterThan(0)
    expect(ca.every((m) => m.name.en.includes('(CA)'))).toBe(true)
  })

  it('does not enrich moves outside the override input map', () => {
    // "屈強P" (2HP) is not in the override map, so it stays a plain normal (resolveMove works as before).
    const hits = resolveMove('屈強P', ryu?.moves ?? [])
    expect(hits.some((m) => m.input.numpad === '2HP')).toBe(true)
  })
})
