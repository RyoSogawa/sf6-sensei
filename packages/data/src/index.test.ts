import { resolveMove } from '@repo/core'
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
