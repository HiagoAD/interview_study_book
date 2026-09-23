import path from 'node:path'
import { loadContent, summarize } from './load.ts'
import type { Countable } from './load.ts'
import { formatError } from './parse.ts'

/**
 * The totals `check` prints for valid content: the sums over every book, then each book's own, so one
 * book can be compared with its outline while another sits beside it.
 */
export function totalsLines(books: (Countable & { id: string })[]): string[] {
  const lines = Object.entries(summarize(books)).map(([name, count]) => `  ${name.padEnd(9)} ${count}`)
  if (books.length === 0) return lines
  const width = Math.max(...books.map((book) => book.id.length))
  lines.push('')
  for (const book of books) {
    const { books: _, ...totals } = summarize([book])
    const counts = Object.entries(totals).map(([name, count]) => `${count} ${count === 1 ? name.slice(0, -1) : name}`)
    lines.push(`  ${book.id.padEnd(width)}  ${counts.join(', ')}`)
  }
  return lines
}

async function main(): Promise<number> {
  const root = path.resolve(import.meta.dirname, '..')
  const { books, errors } = await loadContent(root)

  if (errors.length > 0) {
    for (const error of errors) console.error(formatError(error))
    console.error(`\ncheck failed: ${errors.length} ${errors.length === 1 ? 'error' : 'errors'}`)
    return 1
  }
  console.log('content OK')
  for (const line of totalsLines(books)) console.log(line)

  // Not an error: an entry can be worth having and only ever reached from the glossary page.
  const unlinked = books.flatMap((book) => book.glossary.filter((entry) => entry.uses.length === 0).map((entry) => `${book.id}/${entry.id}`))
  if (unlinked.length > 0) {
    console.log(`\nnothing links to ${unlinked.length} ${unlinked.length === 1 ? 'entry' : 'entries'}: ${unlinked.join(', ')}`)
  }
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) process.exitCode = await main()
