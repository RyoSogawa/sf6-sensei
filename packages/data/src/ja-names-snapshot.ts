import type { Character } from '@repo/core'

/** Marks a move that has no Japanese name yet. Filling it in is not a regression. */
export const UNTRANSLATED = '-'

export interface JaNameRegression {
  key: string
  before: string[]
  after: string[]
}

/**
 * Serializes every move's resolved Japanese name as sorted `character\tinput\tname` lines.
 * Several moves can share an input (SA3/CA, taunt variants), so a key may appear more than once.
 */
export function serializeJaNames(characters: readonly Character[]): string {
  const lines = characters
    .flatMap((c) => c.moves.map((m) => `${c.id}\t${m.input.numpad}\t${m.name.ja ?? UNTRANSLATED}`))
    .sort()
  return `${lines.join('\n')}\n`
}

function groupByKey(text: string): Map<string, string[]> {
  return text
    .split('\n')
    .filter((line) => line !== '')
    .reduce((groups, line) => {
      const cut = line.lastIndexOf('\t')
      const key = line.slice(0, cut)
      return groups.set(key, [...(groups.get(key) ?? []), line.slice(cut + 1)])
    }, new Map<string, string[]>())
}

function hasAll(required: string[], available: string[]): boolean {
  const remaining = [...available]
  return required.every((name) => {
    const i = remaining.indexOf(name)
    if (i === -1) return false
    remaining.splice(i, 1)
    return true
  })
}

/**
 * Lists inputs whose recorded Japanese names are no longer all present.
 *
 * Only names already recorded are protected: new inputs and untranslated moves gaining a name
 * pass. Translation keys are upstream English names, so an upstream renumbering keeps every
 * key valid while moving each label onto a neighbouring move; this catches that shift.
 */
export function findJaNameRegressions(recorded: string, current: string): JaNameRegression[] {
  const now = groupByKey(current)
  return [...groupByKey(recorded)].flatMap(([key, before]) => {
    const after = now.get(key) ?? []
    const translated = before.filter((name) => name !== UNTRANSLATED)
    return hasAll(translated, after) ? [] : [{ after, before, key }]
  })
}
