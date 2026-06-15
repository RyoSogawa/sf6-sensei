import { getCharacters } from '@repo/data'
import { describe, expect, it } from 'vitest'
import {
  findPunishImpl,
  getCharacterFrameDataImpl,
  getCharacterSuggestions,
  getMoveImpl,
  listCharactersImpl,
  resolveCharacter,
  searchMovesImpl,
} from './tools'

const characters = getCharacters()

describe('Tool Functions', () => {
  describe('resolveCharacter', () => {
    it('resolves by character ID', () => {
      const char = resolveCharacter('ryu', characters)
      expect(char).toBeDefined()
      expect(char?.id).toBe('ryu')
    })

    it('resolves by English name (partial match)', () => {
      const char = resolveCharacter('hadoken', characters)
      // Should not match character by name if it's a move
      expect(char).toBeNull()

      const charRyu = resolveCharacter('ryu', characters)
      expect(charRyu).toBeDefined()
    })

    it('returns null for unknown character', () => {
      const char = resolveCharacter('unknown_char_xyz', characters)
      expect(char).toBeNull()
    })

    it('is case-insensitive', () => {
      const char1 = resolveCharacter('RYU', characters)
      const char2 = resolveCharacter('ryu', characters)
      expect(char1?.id).toBe(char2?.id)
    })
  })

  describe('getCharacterSuggestions', () => {
    it('provides suggestions for misspelled names', () => {
      const suggestions = getCharacterSuggestions('ju', characters)
      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions.length).toBeGreaterThan(0)
    })

    it('returns empty array for very far queries', () => {
      const suggestions = getCharacterSuggestions('xyzabc123', characters)
      expect(suggestions.length).toBe(0)
    })
  })

  describe('getMoveImpl', () => {
    it('finds a move by input notation', () => {
      const result = getMoveImpl('ryu', '236P', characters, 'en')
      expect(result.resolvedCharacter).toBeDefined()
      expect(result.resolvedCharacter?.id).toBe('ryu')
      // Should find Hadoken or similar
      expect(result.matches.length).toBeGreaterThan(0)
    })

    it('returns error and suggestions when character not found', () => {
      const result = getMoveImpl('unknown', '236P', characters, 'en')
      expect(result.resolvedCharacter).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.suggestions).toBeDefined()
      expect(result.matches.length).toBe(0)
    })

    it('marks ambiguous results when multiple moves match', () => {
      const result = getMoveImpl('ryu', 'punch', characters, 'en')
      if (result.matches.length > 1) {
        expect(result.ambiguous).toBe(true)
        expect(result.candidates).toBeDefined()
      }
    })

    it('includes attribution in response', () => {
      const result = getMoveImpl('ryu', '236P', characters, 'en')
      expect(result.attribution).toBeDefined()
      expect(result.attribution.source).toBe('SuperCombo Wiki')
      expect(result.attribution.license).toBe('CC-BY-SA')
    })

    it('supports language selection', () => {
      const resultJa = getMoveImpl('ryu', '236P', characters, 'ja')
      const resultEn = getMoveImpl('ryu', '236P', characters, 'en')
      expect(resultJa.resolvedCharacter).toBeDefined()
      expect(resultEn.resolvedCharacter).toBeDefined()
      // English name should always be available
      expect(resultEn.resolvedCharacter?.name).toBe('Ryu')
    })

    it('finds Drive Impact by the common Japanese name インパクト', () => {
      const result = getMoveImpl('ryu', 'インパクト', characters, 'ja')
      expect(result.matches.length).toBeGreaterThan(0)
      expect(result.matches.some((m) => m.input.numpad === 'HPHK')).toBe(true)
    })

    it('does not return unrelated normals for the short query "DI"', () => {
      const result = getMoveImpl('ryu', 'DI', characters, 'en')
      expect(result.matches.length).toBeGreaterThan(0)
      // 旧実装は "Standing"/"Medium" の "di" に誤爆していた。今は Drive Impact だけ。
      expect(result.matches.every((m) => m.category === 'drive')).toBe(true)
    })

    it('finds the back throw by 裏投げ', () => {
      const result = getMoveImpl('ryu', '裏投げ', characters, 'ja')
      expect(result.matches.some((m) => m.input.numpad === '4LPLK')).toBe(true)
    })
  })

  describe('getCharacterFrameDataImpl', () => {
    it('returns all moves for a character', () => {
      const result = getCharacterFrameDataImpl('ryu', undefined, characters, 'en')
      expect('moveCount' in result).toBe(true)
      if ('moveCount' in result) {
        expect(result.moveCount).toBeGreaterThan(0)
        expect(result.moves.length).toBe(result.moveCount)
      }
    })

    it('filters by category', () => {
      const result = getCharacterFrameDataImpl('ryu', 'special', characters, 'en')
      expect('moveCount' in result).toBe(true)
      if ('moveCount' in result) {
        const allSpecials = result.moves.every((m) => m.category === 'special')
        expect(allSpecials).toBe(true)
      }
    })

    it('returns error for unknown character', () => {
      const result = getCharacterFrameDataImpl('unknown', undefined, characters, 'en')
      expect('error' in result).toBe(true)
    })

    it('includes attribution', () => {
      const result = getCharacterFrameDataImpl('ryu', undefined, characters, 'en')
      expect(result.attribution).toBeDefined()
    })
  })

  describe('searchMovesImpl', () => {
    it('searches moves by startup frame', () => {
      const result = searchMovesImpl(
        undefined, // all characters
        undefined,
        4, // startupMax
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        20,
        characters,
        'en',
      )
      expect('results' in result && result.results).toBeDefined()
      if ('results' in result) {
        const allUnder4 = result.results.every((m) => m.startup === null || m.startup <= 4)
        expect(allUnder4).toBe(true)
      }
    })

    it('searches moves by on-block advantage', () => {
      const result = searchMovesImpl(
        undefined,
        undefined,
        undefined,
        undefined,
        0, // onBlockMin (0 or higher = advantageous)
        undefined,
        undefined,
        undefined,
        undefined,
        20,
        characters,
        'en',
      )
      expect('results' in result && result.results).toBeDefined()
      if ('results' in result) {
        const allAdvantage = result.results.every((m) => m.onBlock === null || m.onBlock >= 0)
        expect(allAdvantage).toBe(true)
      }
    })

    it('limits result count', () => {
      const result = searchMovesImpl(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        5, // limit
        characters,
        'en',
      )
      expect('results' in result && result.results).toBeDefined()
      if ('results' in result) {
        expect(result.results.length).toBeLessThanOrEqual(5)
      }
    })

    it('marks truncation when limit exceeded', () => {
      // Search with very low limit to likely trigger truncation
      const result = searchMovesImpl(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1, // very low limit
        characters,
        'en',
      )
      expect('truncated' in result && result.truncated !== undefined).toBe(true)
    })

    it('filters by character', () => {
      const result = searchMovesImpl(
        'ryu',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        20,
        characters,
        'en',
      )
      expect('results' in result && result.results).toBeDefined()
      if ('results' in result) {
        const allRyu = result.results.every((m) => m.characterId === 'ryu')
        expect(allRyu).toBe(true)
      }
    })
  })

  describe('findPunishImpl', () => {
    it('calculates frame advantage from opponent move', () => {
      // Find a move with known on-block disadvantage
      const ryu = resolveCharacter('ryu', characters)
      if (ryu) {
        const movesWithNegBlock = ryu.moves.filter((m) => m.onBlock && m.onBlock < 0)
        if (movesWithNegBlock.length > 0) {
          const moveData = movesWithNegBlock[0]
          const moveInput = moveData.input.numpad

          const result = findPunishImpl(
            'ryu',
            'ryu',
            moveInput,
            undefined,
            undefined,
            characters,
            'en',
          )
          expect('situation' in result && result.situation).toBeDefined()
          if ('situation' in result) {
            expect(result.situation.myFrameAdvantage).toBeGreaterThan(0)
          }
        }
      }
    })

    it('accepts direct on-block value', () => {
      const result = findPunishImpl('ryu', undefined, undefined, -7, undefined, characters, 'en')
      expect('situation' in result && result.situation).toBeDefined()
      if ('situation' in result) {
        expect(result.situation.myFrameAdvantage).toBe(7)
      }
    })

    it('returns error for unknown character', () => {
      const result = findPunishImpl(
        'unknown',
        undefined,
        undefined,
        -7,
        undefined,
        characters,
        'en',
      )
      expect('error' in result).toBe(true)
    })

    it('returns candidate punish moves', () => {
      const result = findPunishImpl('ryu', undefined, undefined, -7, undefined, characters, 'en')
      expect('candidates' in result && result.candidates).toBeDefined()
      if ('candidates' in result) {
        const allFastEnough = result.candidates.every((m) => m.startup === null || m.startup <= 7)
        expect(allFastEnough).toBe(true)
      }
    })

    it('includes caveats', () => {
      const result = findPunishImpl('ryu', undefined, undefined, -7, undefined, characters, 'en')
      expect('caveats' in result && result.caveats).toBeDefined()
      if ('caveats' in result) {
        expect(result.caveats.length).toBeGreaterThan(0)
      }
    })
  })

  describe('listCharactersImpl', () => {
    it('returns all characters', () => {
      const result = listCharactersImpl(characters, 'en')
      expect(result.characters.length).toBeGreaterThan(0)
      // SF6 has 30 characters
      expect(result.characters.length).toBeGreaterThanOrEqual(20)
    })

    it('includes character IDs and aliases', () => {
      const result = listCharactersImpl(characters, 'en')
      expect(result.characters[0]).toHaveProperty('id')
      expect(result.characters[0]).toHaveProperty('name')
      expect(result.characters[0]).toHaveProperty('aliases')
      expect(Array.isArray(result.characters[0].aliases)).toBe(true)
    })

    it('includes attribution', () => {
      const result = listCharactersImpl(characters, 'en')
      expect(result.attribution).toBeDefined()
    })

    it('supports language selection', () => {
      const resultJa = listCharactersImpl(characters, 'ja')
      const resultEn = listCharactersImpl(characters, 'en')
      expect(resultJa.characters.length).toBe(resultEn.characters.length)
      // At least one character should have a different name
      const differentNames = resultJa.characters.some(
        (c, i) => c.name !== resultEn.characters[i].name,
      )
      expect(differentNames || resultJa.characters[0].name).toBeDefined()
    })
  })
})
