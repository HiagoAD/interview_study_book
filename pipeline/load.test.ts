import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { assembleBooks, findContentFiles, loadContent, summarize } from './load.ts'

/** A file whose body starts on line 4 (with a `chapter:` key) or line 3 (without). */
function file(book: string, chapter: string | null, ...body: string[]): string {
  return ['---', `book: ${book}`, ...(chapter ? [`chapter: ${chapter}`] : []), '---', ...body].join('\n')
}

/** `file` with the book's title on line 3, so its body starts a line later. */
function titled(book: string, title: string, chapter: string | null, ...body: string[]): string {
  return file(book, chapter, ...body).replace(`book: ${book}\n`, `book: ${book}\ntitle: ${title}\n`)
}

/** A valid section: heading on its first line, its concept on the third. */
function section(id: string, concept = `${id}-c`): string[] {
  return [`## ${id} {#${id}}`, 'Content.', `?? ${concept} Question?`, '* right', '- wrong', '> because']
}

const MC_LINES = ['?? other Question?', '* right', '- wrong', '> because']

test('one book split across files merges in path order, whatever order the sources arrive in', () => {
  const { books, errors } = assembleBooks([
    { path: 'content/b-scaling.md', text: file('system-design', 'Scaling', ...section('sharding')) },
    { path: 'content/a-caching.md', text: file('system-design', 'Caching', ...section('lru'), ...section('ttl')) },
    { path: 'content/c-queues.md', text: file('system-design', null, '# Queues', ...section('kafka')) },
  ])

  expect(errors).toEqual([])
  expect(books).toHaveLength(1)
  expect(books[0].id).toBe('system-design')
  expect(books[0].chapters.map((c) => [c.id, c.sections.map((s) => s.id)])).toEqual([
    ['caching', ['lru', 'ttl']],
    ['scaling', ['sharding']],
    ['queues', ['kafka']],
  ])
})

test('the id is the book: line and the title comes from the file that gives one, so a new title keeps the id', () => {
  const sources = (title: string) => [
    { path: 'content/a.md', text: file('system-design', 'Caching', ...section('lru')) },
    { path: 'content/b.md', text: titled('system-design', title, 'Scaling', ...section('sharding')) },
  ]
  const before = assembleBooks(sources('System Design'))
  const after = assembleBooks(sources('Scaling Systems'))
  expect(before.errors).toEqual([])
  expect(after.errors).toEqual([])
  expect(before.books.map((b) => [b.id, b.title])).toEqual([['system-design', 'System Design']])
  expect(after.books.map((b) => [b.id, b.title])).toEqual([['system-design', 'Scaling Systems']])
})

test('books are ordered by title, and a book without one shows its id', () => {
  const { books, errors } = assembleBooks([
    { path: 'content/1.md', text: titled('b', 'banana Book', 'C', ...section('a')) },
    { path: 'content/2.md', text: titled('a', 'Apple Book', 'C', ...section('b')) },
    { path: 'content/3.md', text: file('cherry', 'C', ...section('c')) },
  ])
  expect(errors).toEqual([])
  expect(books.map((b) => [b.id, b.title])).toEqual([
    ['a', 'Apple Book'],
    ['b', 'banana Book'],
    ['cherry', 'cherry'],
  ])
})

test('a second title in one book is an error at the later file, even when it matches the first', () => {
  const { books, errors } = assembleBooks([
    { path: 'content/a.md', text: titled('t', 'First', 'One', ...section('one')) },
    { path: 'content/b.md', text: titled('t', 'First', 'Two', ...section('two')) },
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ file: 'content/b.md', line: 3 })
  expect(errors[0].message).toContain('book "t" already has the title "First" (content/a.md:3)')
  expect(books.map((b) => [b.id, b.title, b.chapters.length])).toEqual([['t', 'First', 2]])
})

test('two books with the same title are an error at the later one', () => {
  const { books, errors } = assembleBooks([
    { path: 'content/a.md', text: titled('one', 'Same', 'C', ...section('a')) },
    { path: 'content/b.md', text: titled('two', 'Same', 'C', ...section('b')) },
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ file: 'content/b.md', line: 3 })
  expect(errors[0].message).toContain('book "two" has the same title as book "one" (content/a.md:3)')
  expect(books.map((b) => b.id)).toEqual(['one', 'two'])
})

test('the same section id twice in a book is an error naming both locations', () => {
  const { errors } = assembleBooks([
    { path: 'content/a.md', text: file('t', 'One', ...section('shared', 'c1')) },
    { path: 'content/b.md', text: file('t', 'Two', ...section('shared', 'c2')) },
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ file: 'content/b.md', line: 5 })
  expect(errors[0].message).toContain('section id "shared" is already used at content/a.md:5')
})

test('the same concept id twice in a book is an error that points to "?+"', () => {
  const { errors } = assembleBooks([
    { path: 'content/a.md', text: file('t', 'One', ...section('one', 'same')) },
    { path: 'content/b.md', text: file('t', 'Two', ...section('two', 'same')) },
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ file: 'content/b.md', line: 7 })
  expect(errors[0].message).toContain('concept id "same" is already used at content/a.md:7')
  expect(errors[0].message).toContain('"?+"')
})

test('ids may repeat across different books', () => {
  const { errors } = assembleBooks([
    { path: 'content/a.md', text: file('book-a', 'One', ...section('intro', 'c')) },
    { path: 'content/b.md', text: file('book-b', 'One', ...section('intro', 'c')) },
  ])
  expect(errors).toEqual([])
})

test('a chapter title used twice in a book is an error, even across files', () => {
  const { books, errors } = assembleBooks([
    { path: 'content/a.md', text: file('t', 'Caching', ...section('one')) },
    { path: 'content/b.md', text: file('t', null, '# Caching', ...section('two')) },
    { path: 'content/c.md', text: file('t', 'caching!', ...section('three')) },
  ])
  expect(errors.map((e) => [e.file, e.line])).toEqual([
    ['content/b.md', 4],
    ['content/c.md', 3],
  ])
  expect(errors[0].message).toContain('"Caching" (content/a.md:3)')
  expect(errors[1].message).toContain('same id "caching" as chapter "Caching"')
  expect(books[0].chapters.map((c) => c.title)).toEqual(['Caching'])
})

test('errors from every file are collected, sorted by file and then line', () => {
  const { errors } = assembleBooks([
    { path: 'content/z.md', text: file('t', 'Z', '## Sec', 'Content.', ...MC_LINES) },
    { path: 'content/a.md', text: ['# no front matter', ...section('a1'), 'stray'].join('\n') },
    { path: 'content/m.md', text: file('t', 'M', ...section('m1'), '', ...section('m1', 'other')) },
  ])
  // a: no front matter (1), stray line (8); m: second "m1" heading (12); z: section without an id (5)
  expect(errors.map((e) => `${e.file}:${e.line}`)).toEqual(['content/a.md:1', 'content/a.md:8', 'content/m.md:12', 'content/z.md:5'])
})

test('a file without a usable book id adds no chapters but its errors are still reported', () => {
  const { books, errors } = assembleBooks([{ path: 'content/a.md', text: ['---', 'chapter: One', '---', ...section('one')].join('\n') }])
  expect(books).toEqual([])
  expect(errors.map((e) => e.line)).toEqual([1])
})

test('summarize counts books, chapters, sections, concepts and variants', () => {
  const { books } = assembleBooks([
    { path: 'content/a.md', text: file('a', 'One', ...section('s1'), ...section('s2'), '?+ Another?', '* r', '- w', '> b') },
    { path: 'content/b.md', text: file('b', 'One', ...section('s1', 'x')) },
  ])
  expect(summarize(books)).toEqual({ books: 2, chapters: 2, sections: 3, concepts: 3, variants: 4, terms: 0, links: 0 })
})

const tempRoots: string[] = []
afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function tempRepo(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'content-test-'))
  tempRoots.push(root)
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), text)
  }
  return root
}

test('findContentFiles returns every .md file under content/ in plain string order', () => {
  const root = tempRepo({
    'content/b.md': '',
    'content/a/z.md': '',
    'content/A.md': '',
    'content/a/notes.txt': '',
    'content/images/pic.png': '',
    'content/folder.md/x.md': '',
    'other/ignored.md': '',
  })
  expect(findContentFiles(root)).toEqual(['content/A.md', 'content/a/z.md', 'content/b.md', 'content/folder.md/x.md'])
})

test('a missing content directory means no files, not a crash', async () => {
  const root = tempRepo({ 'other/file.md': '' })
  expect(findContentFiles(root)).toEqual([])
  expect(await loadContent(root)).toEqual({ books: [], errors: [] })
})

test('loadContent reads files from disk and reports errors with repo-relative paths', async () => {
  const root = tempRepo({
    'content/good.md': file('book', 'One', ...section('one')),
    'content/sub/bad.md': file('book', 'Two', '## Sec', 'Content.', ...MC_LINES),
  })
  const { books, errors } = await loadContent(root)
  expect(books[0].chapters.map((c) => c.title)).toEqual(['One', 'Two'])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ file: 'content/sub/bad.md', line: 5 })
  expect(errors[0].message).toContain('write "## Sec {#sec}"')
})
