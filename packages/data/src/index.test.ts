import { resolveMove, resolveMoveBest } from '@repo/core'
import { describe, expect, it } from 'vitest'
import { characters, dataVersion } from './index'

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
    // 屈強P は P/K が明示されるので normalizeInput だけで 2HP に一意化できる。
    // 「2強」のような P/K 省略形は alias-overrides 層で補う想定。
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
    // 2LPLK を持つのは alex / dhalsim / zangief の 3 体（コマ投げ系）。
    for (const id of ['alex', 'dhalsim', 'zangief']) {
      const char = characters.find((c) => c.id === id)
      for (const query of ['下投げ', '2投げ']) {
        const hits = resolveMoveBest(query, char?.moves ?? [])
        expect(hits.some((m) => m.input.numpad === '2LPLK')).toBe(true)
      }
    }
    // 2LPLK を持たないキャラ（ryu）は 0 件（誤って何かを返さない）。
    expect(resolveMoveBest('下投げ', ryu?.moves ?? [])).toHaveLength(0)
  })

  it('auto-derives Japanese names for systematic normals, leaving proper nouns null', () => {
    const find = (numpad: string) => ryu?.moves.find((m) => m.input.numpad === numpad)
    expect(find('5LP')?.name.ja).toBe('立ち弱パンチ')
    expect(find('2HP')?.name.ja).toBe('しゃがみ強パンチ')
    expect(find('j.MK')?.name.ja).toBe('ジャンプ中キック')
    // 固有名（特殊技・必殺技）は導出対象外なので ja は null のまま。
    expect(find('6MP')?.name.ja).toBeNull() // Collarbone Breaker
    expect(find('236LP')?.name.ja).toBeNull() // Hadoken
  })

  it('does not enrich moves outside the override input map', () => {
    // 屈強P (2HP) は override 対象外なので通常技のまま（resolveMove は従来どおり動く）。
    const hits = resolveMove('屈強P', ryu?.moves ?? [])
    expect(hits.some((m) => m.input.numpad === '2HP')).toBe(true)
  })
})
