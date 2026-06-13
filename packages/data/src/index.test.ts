import { describe, expect, it } from 'vitest'
import { characters, dataVersion } from './index'

describe('data', () => {
  it('exposes a characters array', () => {
    expect(Array.isArray(characters)).toBe(true)
  })

  it('exposes a data version', () => {
    expect(typeof dataVersion).toBe('string')
  })
})
