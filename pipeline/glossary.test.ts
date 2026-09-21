import { expect, test } from 'vitest'
import { assembleBooks, summarize } from './load.ts'
import { SUMMARY_LIMIT, parseContentFile } from './parse.ts'
import { docExample } from './test-helpers.ts'

const FM = ['---', 'book: Test', 'kind: glossary', '---'] // lines 1-4
/** A valid entry, starting on line 5. */
const ENTRY = ['## Term {#term}', 'Summary.']

const parse = (...lines: string[]) => parseContentFile('content/g.md', lines.join('\n'))

function parseOk(...lines: string[]) {
  const { file, errors } = parse(...lines)
  expect(errors).toEqual([])
  return file
}

test('the glossary example in docs/content-format.md is a valid glossary', () => {
  const { books, errors } = assembleBooks([{ path: 'content/g.md', text: docExample('docs/content-format.md', '## Glossary files') }])
  expect(errors).toEqual([])
  expect(books[0].entries.map((entry) => [entry.id, entry.names.map((name) => name.text), entry.see.map((see) => see.id)])).toEqual([
    ['read-through', ['lazy loading'], []],
    ['write-through', ['synchronous write'], ['read-through']],
  ])
})

test('the glossary example in PROJECT.md is a valid glossary', () => {
  const { books, errors } = assembleBooks([{ path: 'content/g.md', text: docExample('PROJECT.md', '### Glossary format') }])
  expect(errors).toEqual([])
  expect(books[0].entries.map((entry) => entry.id)).toEqual(['strategy'])
})

test('an entry parses to its term, names, related entries, summary and body', () => {
  const file = parseOk(
    ...FM,
    '## Object pool {#object-pool}',
    '= pool | pooling',
    '= object pooling',
    '-> strategy | observer',
    '',
    'Reused instances kept alive instead of allocated.',
    '',
    'The body runs on.',
    '',
    '```csharp',
    'var bullet = pool.Rent();',
    '```',
    '## Strategy {#strategy}',
    'One rule behind an interface.',
    '## Observer {#observer}',
    'A source and its listeners.',
  )

  expect(file.chapters).toEqual([])
  expect(file.entries).toHaveLength(3)
  const [pool] = file.entries
  expect(pool).toMatchObject({ id: 'object-pool', term: 'Object pool', line: 5, file: 'content/g.md' })
  expect(pool.names).toEqual([
    { text: 'pool', line: 6 },
    { text: 'pooling', line: 6 },
    { text: 'object pooling', line: 7 },
  ])
  expect(pool.see).toEqual([
    { id: 'strategy', line: 8 },
    { id: 'observer', line: 8 },
  ])
  expect(pool.summary).toEqual({ md: 'Reused instances kept alive instead of allocated.', line: 10 })
  expect(pool.body).toEqual({ md: 'The body runs on.\n\n```csharp\nvar bullet = pool.Rent();\n```', line: 12 })
})

test('an entry can be a summary and nothing else', () => {
  const [entry] = parseOk(...FM, '## Term {#term}', 'Just the summary.').entries
  expect(entry.summary.md).toBe('Just the summary.')
  expect(entry.body.md).toBe('')
})

test('a summary can run over several lines, and ends at the blank line', () => {
  const [entry] = parseOk(...FM, '## Term {#term}', 'One line,', 'and its second.', '', 'Body.').entries
  expect(entry.summary).toEqual({ md: 'One line,\nand its second.', line: 6 })
  expect(entry.body).toEqual({ md: 'Body.', line: 9 })
})

test('a code fence ends the summary even with no blank line before it', () => {
  const [entry] = parseOk(...FM, '## Term {#term}', 'Summary.', '```', 'code', '```').entries
  expect(entry.summary.md).toBe('Summary.')
  expect(entry.body).toEqual({ md: '```\ncode\n```', line: 7 })
})

test('blank lines may sit between the heading and its = and -> lines', () => {
  const [entry] = parseOk(...FM, '## Term {#term}', '', '= other name', '', 'Summary.').entries
  expect(entry.names).toEqual([{ text: 'other name', line: 7 }])
  expect(entry.summary.md).toBe('Summary.')
})

test('= and -> lines below the summary are ordinary text, not markers', () => {
  const [entry] = parseOk(...FM, '## Term {#term}', 'Summary.', '', '= not a name', '-> not a link').entries
  expect(entry.names).toEqual([])
  expect(entry.see).toEqual([])
  expect(entry.body.md).toBe('= not a name\n-> not a link')
})

test('a ## line inside a fence does not start an entry', () => {
  const file = parseOk(...FM, '## Term {#term}', 'Summary.', '', '```md', '## Not an entry {#nope}', '```')
  expect(file.entries).toHaveLength(1)
  expect(file.entries[0].body.md).toBe('```md\n## Not an entry {#nope}\n```')
})

test('a summary of exactly the limit is allowed, and one character more is not', () => {
  expect(parse(...FM, '## Term {#term}', 'x'.repeat(SUMMARY_LIMIT)).errors).toEqual([])
  const { errors } = parse(...FM, '## Term {#term}', 'x'.repeat(SUMMARY_LIMIT + 1))
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain(`${SUMMARY_LIMIT + 1} characters, over the limit of ${SUMMARY_LIMIT}`)
})

type Case = [name: string, lines: string[], expected: [line: number, fragment: string][]]

const cases: Case[] = [
  ['unknown kind', ['---', 'book: Test', 'kind: notes', '---', ...ENTRY], [[3, 'unknown kind "notes"']]],
  ['kind beside chapter', ['---', 'book: Test', 'chapter: Intro', 'kind: glossary', '---', '## Term {#term}', 'Summary.'], [[3, 'a glossary file has no chapters, so "chapter" cannot be set beside']]],
  ['glossary file with no entries', FM, [[1, 'this glossary file has no entries']]],
  ['text before the first entry', [...FM, 'Stray.', ...ENTRY], [[5, 'text before the first entry']]],
  ['fence before the first entry', [...FM, '```', 'x', '```', ...ENTRY], [[5, 'text before the first entry']]],
  ['a chapter heading', [...FM, '# Chapter', ...ENTRY], [[5, 'a glossary file has no chapters']]],
  ['a question', [...FM, ...ENTRY, '?? q1 Question?'], [[7, 'a glossary entry has no questions']]],
  ['a variant', [...FM, ...ENTRY, '?+ Question?'], [[7, 'a glossary entry has no questions']]],
  ['entry heading without an id', [...FM, '## Term', 'Summary.'], [[5, 'write "## Term {#term}"']]],
  ['entry heading with a bad id', [...FM, '## Term {#Bad_Id}', 'Summary.'], [[5, 'invalid glossary entry id "Bad_Id"']]],
  ['entry heading without a title', [...FM, '## {#term}', 'Summary.'], [[5, 'the glossary entry heading has no title']]],
  ['entry heading empty', [...FM, '##', 'Summary.'], [[5, 'the glossary entry heading is empty']]],
  ['entry without a summary', [...FM, '## Term {#term}'], [[5, 'this entry has no summary']]],
  ['entry whose body has no summary above it', [...FM, '## Term {#term}', '```', 'code', '```'], [[5, 'this entry has no summary']]],
  ['= line with no names', [...FM, '## Term {#term}', '=', 'Summary.'], [[6, 'the "=" line has no names']]],
  ['= line with only separators', [...FM, '## Term {#term}', '=  | ', 'Summary.'], [[6, 'the "=" line has no names']]],
  ['= name without letters or digits', [...FM, '## Term {#term}', '= !!!', 'Summary.'], [[6, 'at least one letter or digit']]],
  ['-> line with no entries', [...FM, '## Term {#term}', '->', 'Summary.'], [[6, 'the "->" line has no entries']]],
  ['-> line with a bad id', [...FM, '## Term {#term}', '-> Bad_Id', 'Summary.'], [[6, 'invalid entry id "Bad_Id" after "->"']]],
  ['unclosed fence in a body', [...FM, '## Term {#term}', 'Summary.', '', '```', 'code'], [[8, 'never closed']]],
]

test.each(cases)('%s', (_name, lines, expected) => {
  const { errors } = parse(...lines)
  const report = errors.map((e) => `${e.file}:${e.line}: ${e.message}`).join('\n')

  expect(errors.map((e) => e.line), report).toEqual(expected.map(([line]) => line))
  errors.forEach((error, i) => {
    expect(error.file).toBe('content/g.md')
    expect(error.message, report).toContain(expected[i][1])
  })
})

// Assembly: one namespace per book for ids and names, and "->" targets that exist.

const source = (path: string, ...lines: string[]) => ({ path, text: lines.join('\n') })
const book = (...lines: string[]) => source('content/g.md', ...FM, ...lines)

test('a book takes its entries from every glossary file, and keeps its chapters', () => {
  const { books, errors } = assembleBooks([
    source('content/a.md', '---', 'book: Test', 'chapter: Intro', '---', '## Sec {#sec}', 'Text.', '?? q1 Q?', '* right', '- wrong', '> because'),
    source('content/g1.md', ...FM, '## One {#one}', 'First.'),
    source('content/g2.md', ...FM, '## Two {#two}', 'Second.'),
  ])
  expect(errors).toEqual([])
  expect(books[0].entries.map((entry) => entry.id)).toEqual(['one', 'two'])
  expect(books[0].chapters).toHaveLength(1)
  expect(summarize(books)).toMatchObject({ terms: 2, links: 0 })
})

test('two entries cannot claim the same id', () => {
  const { errors } = assembleBooks([book('## One {#same}', 'First.', '## Two {#same}', 'Second.')])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ line: 7 })
  expect(errors[0].message).toContain('"same" already names the glossary entry "One" (content/g.md:5)')
})

test('a name cannot repeat another entry id, in this file or another', () => {
  const { errors } = assembleBooks([
    source('content/g1.md', ...FM, '## Pool {#pool}', 'First.'),
    source('content/g2.md', ...FM, '## Other {#other}', '= pool', 'Second.'),
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ file: 'content/g2.md', line: 6 })
  expect(errors[0].message).toContain('already names the glossary entry "Pool" (content/g1.md:5)')
})

test('names are compared by their letters, so "Object Pool" and "object-pool" collide', () => {
  const { errors } = assembleBooks([book('## One {#one}', '= Object Pool', 'First.', '## Two {#two}', '= object-pool', 'Second.')])
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain('"object-pool" already names the glossary entry "One"')
})

test('-> must name another entry of the same book', () => {
  const { errors } = assembleBooks([book('## One {#one}', '-> missing', 'First.')])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ line: 6 })
  expect(errors[0].message).toContain('no glossary entry has the id "missing"')
})

test('-> cannot point at its own entry', () => {
  const { errors } = assembleBooks([book('## One {#one}', '-> one', 'First.')])
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain('points at this entry itself')
})

test('a section and an entry may share an id, because they are separate namespaces', () => {
  const { errors } = assembleBooks([
    source('content/a.md', '---', 'book: Test', 'chapter: Intro', '---', '## Sec {#pool}', 'Text.', '?? q1 Q?', '* right', '- wrong', '> because'),
    source('content/g.md', ...FM, '## Pool {#pool}', 'Reused instances.'),
  ])
  expect(errors).toEqual([])
})
