import path from 'node:path'
import { loadContent, summarize } from './load.ts'
import { formatError } from './parse.ts'

const root = path.resolve(import.meta.dirname, '..')
const { books, errors } = await loadContent(root)

if (errors.length > 0) {
  for (const error of errors) console.error(formatError(error))
  console.error(`\ncheck failed: ${errors.length} ${errors.length === 1 ? 'error' : 'errors'}`)
  process.exitCode = 1
} else {
  const totals = summarize(books)
  console.log('content OK')
  for (const [name, count] of Object.entries(totals)) console.log(`  ${name.padEnd(9)} ${count}`)

  // Not an error: an entry can be worth having and only ever reached from the glossary page.
  const unlinked = books.flatMap((book) => book.glossary.filter((entry) => entry.uses.length === 0).map((entry) => `${book.id}/${entry.id}`))
  if (unlinked.length > 0) {
    console.log(`\nnothing links to ${unlinked.length} ${unlinked.length === 1 ? 'entry' : 'entries'}: ${unlinked.join(', ')}`)
  }
}
