import { describe, expect, it } from 'vitest'
import { buildCargoQueryUrl, stripMarkup } from './index'

describe('buildCargoQueryUrl', () => {
  it('targets srk.shib.live api.php with cargoquery', () => {
    const url = buildCargoQueryUrl({ fields: 'chara', limit: 10, tables: 'SF6_FrameData' })
    expect(url).toContain('https://srk.shib.live/api.php')
    expect(url).toContain('action=cargoquery')
    expect(url).toContain('limit=10')
  })
})

describe('stripMarkup', () => {
  it('removes html tags and wiki bold markup', () => {
    expect(stripMarkup("<span style=\"color:#fff\">'''+4'''</span>")).toBe('+4')
  })
})
