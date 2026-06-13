import { describe, expect, it } from 'vitest'
import { getMoveInput } from './index'

describe('getMoveInput', () => {
  it('defaults language to ja', () => {
    const parsed = getMoveInput.parse({ character: 'Juri', move: '2HP' })
    expect(parsed.language).toBe('ja')
  })

  it('rejects empty character', () => {
    expect(() => getMoveInput.parse({ character: '', move: '2HP' })).toThrow()
  })
})
