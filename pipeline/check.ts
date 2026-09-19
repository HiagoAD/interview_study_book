import path from 'node:path'
import { loadContent, summarize } from './load.ts'
import { formatError } from './parse.ts'

const root = path.resolve(import.meta.dirname, '..')
const { books, errors } = loadContent(root)

if (errors.length > 0) {
  for (const error of errors) console.error(formatError(error))
  console.error(`\ncheck failed: ${errors.length} ${errors.length === 1 ? 'error' : 'errors'}`)
  process.exitCode = 1
} else {
  const totals = summarize(books)
  console.log('content OK')
  for (const [name, count] of Object.entries(totals)) console.log(`  ${name.padEnd(9)} ${count}`)
}
