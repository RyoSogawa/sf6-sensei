import { describe, expect, it } from 'vitest'
import {
  buildCargoQueryUrl,
  getCharacterSlug,
  mapMoveType,
  parseAdvantage,
  parseCancel,
  parseFrameValue,
  parseGuard,
  stripMarkup,
} from './index'

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

  it('handles nbsp entities', () => {
    expect(stripMarkup('text&nbsp;with&nbsp;spaces')).toBe('text with spaces')
  })
})

describe('parseAdvantage', () => {
  it('parses positive integers', () => {
    const result = parseAdvantage('+4')
    expect(result.value).toBe(4)
    expect(result.knockdown).toBe(false)
  })

  it('parses negative integers', () => {
    const result = parseAdvantage('-7')
    expect(result.value).toBe(-7)
    expect(result.knockdown).toBe(false)
  })

  it('parses knockdown values', () => {
    const result = parseAdvantage('KD +23')
    expect(result.value).toBe(23)
    expect(result.knockdown).toBe(true)
  })

  it('parses HKD values', () => {
    const result = parseAdvantage('HKD +18')
    expect(result.value).toBe(18)
    expect(result.knockdown).toBe(true)
  })

  it('handles dash (no advantage)', () => {
    const result = parseAdvantage('-')
    expect(result.value).toBeNull()
    expect(result.knockdown).toBe(false)
  })

  it('handles template placeholders', () => {
    const result = parseAdvantage('{{{blockAdv}}}')
    expect(result.value).toBeNull()
    expect(result.knockdown).toBe(false)
  })
})

describe('parseFrameValue', () => {
  it('extracts leading integer', () => {
    const result = parseFrameValue('7')
    expect(result.value).toBe(7)
  })

  it('handles values with units', () => {
    const result = parseFrameValue('3 land')
    expect(result.value).toBe(3)
    expect(result.text).toBe('3 land')
  })

  it('handles ranges', () => {
    const result = parseFrameValue('11(13)')
    expect(result.value).toBe(11)
    expect(result.text).toBe('11(13)')
  })

  it('handles wavy notation', () => {
    const result = parseFrameValue('18~')
    expect(result.value).toBe(18)
  })

  it('handles dash', () => {
    const result = parseFrameValue('-')
    expect(result.value).toBeNull()
  })

  it('handles template placeholders', () => {
    const result = parseFrameValue('{{{startup}}}')
    expect(result.value).toBeNull()
  })
})

describe('parseCancel', () => {
  it('parses cancel codes separated by space', () => {
    const result = parseCancel('Chn Sp SA TC')
    expect(result).toContain('chain')
    expect(result).toContain('special')
    expect(result).toContain('super')
    expect(result).toContain('target_combo')
  })

  it('parses codes separated by comma', () => {
    const result = parseCancel('Sp, SA1')
    expect(result).toContain('special')
    expect(result).toContain('super')
  })

  it('ignores parenthetical notes', () => {
    const result = parseCancel('SA2(2nd) DR')
    expect(result).toContain('super')
    expect(result).toContain('drive_rush')
  })

  it('handles dash', () => {
    const result = parseCancel('-')
    expect(result).toHaveLength(0)
  })

  it('handles empty string', () => {
    const result = parseCancel('')
    expect(result).toHaveLength(0)
  })

  it('deduplicates codes', () => {
    const result = parseCancel('Sp Sp SA')
    expect(result.filter((x) => x === 'special')).toHaveLength(1)
  })
})

describe('parseGuard', () => {
  it('parses low guard', () => {
    const result = parseGuard('L')
    expect(result).toContain('low')
  })

  it('parses high guard', () => {
    const result = parseGuard('H')
    expect(result).toContain('high')
  })

  it('parses low/high combined', () => {
    const result = parseGuard('LH')
    expect(result).toContain('low')
    expect(result).toContain('high')
  })

  it('parses comma-separated', () => {
    const result = parseGuard('L,H')
    expect(result).toContain('low')
    expect(result).toContain('high')
  })

  it('parses throw', () => {
    const result = parseGuard('Throw')
    expect(result).toContain('throw')
  })

  it('handles empty string', () => {
    const result = parseGuard('')
    expect(result).toHaveLength(0)
  })
})

describe('mapMoveType', () => {
  it('normalizes ground_normal to normal', () => {
    expect(mapMoveType('ground_normal')).toBe('normal')
  })

  it('normalizes air_normal to normal', () => {
    expect(mapMoveType('air_normal')).toBe('normal')
  })

  it('case-insensitive: Special/special', () => {
    expect(mapMoveType('Special')).toBe('special')
    expect(mapMoveType('special')).toBe('special')
  })

  it('case-insensitive: Super/super', () => {
    expect(mapMoveType('Super')).toBe('super_art')
    expect(mapMoveType('super')).toBe('super_art')
  })

  it('maps critical art', () => {
    expect(mapMoveType('critical art')).toBe('critical_art')
  })

  it('defaults to normal for unknown', () => {
    expect(mapMoveType('unknown_type')).toBe('normal')
  })
})

describe('getCharacterSlug', () => {
  it('handles standard lowercase names', () => {
    expect(getCharacterSlug('Ryu')).toBe('ryu')
  })

  it('handles punctuated names', () => {
    expect(getCharacterSlug('A.K.I.')).toBe('aki')
    expect(getCharacterSlug('E.Honda')).toBe('e_honda')
    expect(getCharacterSlug('M.Bison')).toBe('m_bison')
  })

  it('handles hyphenated names', () => {
    expect(getCharacterSlug('Chun-Li')).toBe('chunli')
  })

  it('handles space-separated names', () => {
    expect(getCharacterSlug('Dee Jay')).toBe('dee_jay')
  })

  it('handles JP characters', () => {
    expect(getCharacterSlug('JP')).toBe('jp')
  })

  it('defaults to lowercase+underscore for unknown', () => {
    expect(getCharacterSlug('Test Name')).toBe('test_name')
  })
})
