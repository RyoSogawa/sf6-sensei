import { readFileSync, writeFileSync } from 'node:fs'
import { characters } from '../src/index'
import { findJaNameRegressions, serializeJaNames } from '../src/ja-names-snapshot'

const file = new URL('../src/ja-names.tsv', import.meta.url)
const acceptChanges = process.argv.includes('--accept-changes')
const current = serializeJaNames(characters)
const regressions = findJaNameRegressions(readFileSync(file, 'utf8'), current)

if (regressions.length > 0 && !acceptChanges) {
  for (const { key, before, after } of regressions) {
    console.error(
      `${key.replace('\t', ' ')}: ${before.join(' / ')} -> ${after.join(' / ') || '(gone)'}`,
    )
  }
  console.error(
    `${regressions.length} recorded Japanese name(s) changed. Check them against frame-search, then rerun with --accept-changes.`,
  )
  process.exit(1)
}

writeFileSync(file, current)
process.stdout.write(`Updated ja-names.tsv (${regressions.length} accepted change(s)).\n`)
