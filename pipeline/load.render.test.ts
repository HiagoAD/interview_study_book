import { expect, test } from 'vitest'
import { loadContent } from './load.ts'
import { docExample, tempRepo } from './test-helpers.ts'

/** The 1-based line of the first line containing `needle`, so each expectation names the text it points at. */
const lineOf = (lines: string[], needle: string) => lines.findIndex((line) => line.includes(needle)) + 1

test('renderer errors land on the file line of each kind of chunk', async () => {
  const lines = [
    '---',
    'book: T',
    'chapter: C',
    '---',
    '## S {#s}',
    'Text before.',
    '',
    'Bad content math $\\bad0$ here.',
    '',
    '?? q Prompt $\\bad1$ here?',
    '* fine option',
    '* option $\\bad2$',
    '- wrong $\\bad3$',
    '> line one',
    '>',
    '> line three $\\bad4$',
    '',
    '?+ Show code',
    '```nolang',
    'x',
    '```',
    '* a',
    '- b',
    '> because ![img](images/missing.png)',
  ]
  const root = tempRepo({ 'content/b.md': lines.join('\n') })
  const { books, errors } = await loadContent(root)

  expect(errors.map((e) => [e.file, e.line])).toEqual([
    ['content/b.md', lineOf(lines, '\\bad0')],
    ['content/b.md', lineOf(lines, '\\bad1')],
    ['content/b.md', lineOf(lines, '\\bad2')],
    ['content/b.md', lineOf(lines, '\\bad3')],
    ['content/b.md', lineOf(lines, '\\bad4')],
    ['content/b.md', lineOf(lines, '```nolang')],
    ['content/b.md', lineOf(lines, 'missing.png')],
  ])
  for (const error of errors.slice(0, 5)) {
    expect(error.message).toMatch(/^invalid LaTeX: KaTeX parse error: Undefined control sequence: \\bad at position 1/)
  }
  expect(errors[5].message).toContain('unknown code language "nolang"')
  expect(errors[6].message).toContain('image file not found: "images/missing.png"')
  // A chunk that failed has no HTML, so nothing half-rendered can be shipped.
  expect(books[0].chapters[0].sections[0].html).toBe('')
})

test('errors in files that parse cleanly are reported next to the parse errors of other files', async () => {
  const root = tempRepo({
    'content/a.md': ['---', 'book: T', 'chapter: One', '---', '## A {#a}', 'Math $\\nope$.', '?? qa Q?', '* r', '- w', '> e'].join('\n'),
    'content/b.md': [
      '---',
      'book: T',
      'chapter: Two',
      '---',
      '## No id',
      'Content.',
      '?? qb Q?',
      '* r',
      '- w',
      '> e',
      '## B {#b}',
      'Code:',
      '```nope',
      'x',
      '```',
      '?? qc Q?',
      '* r',
      '- w',
      '> e',
    ].join('\n'),
  })
  const { errors } = await loadContent(root)
  expect(errors.map((e) => `${e.file}:${e.line}`)).toEqual(['content/a.md:6', 'content/b.md:5', 'content/b.md:13'])
})

test('the rendered books have HTML in every field but titles, ids and accepted answers', async () => {
  const root = tempRepo({
    'content/shape.md': [
      '---',
      'book: Shape',
      'chapter: One',
      '---',
      '## R&D notes {#rd}',
      'Some *content*.',
      '?? mc-1 Which is `x`?',
      '* right',
      '- wrong',
      '> because **so**',
      '?+ [multi n=3] Pick both',
      '* a',
      '* b',
      '- c',
      '> both',
      '?? tf-1 [tf] It is true.',
      '* TRUE',
      '> yes',
      '?? short-1 [short] Say it.',
      '= a < b | R&D',
      '> ok',
    ].join('\n'),
  })
  const { books, errors } = await loadContent(root)
  expect(errors).toEqual([])
  expect(books).toEqual([
    {
      id: 'shape',
      title: 'Shape',
      glossary: [],
      chapters: [
        {
          id: 'one',
          title: 'One',
          sections: [
            {
              id: 'rd',
              title: 'R&D notes',
              html: '<p>Some <em>content</em>.</p>',
              concepts: [
                {
                  id: 'mc-1',
                  variants: [
                    { type: 'mc', prompt: '<p>Which is <code>x</code>?</p>', explanation: '<p>because <strong>so</strong></p>', correct: ['right'], wrong: ['wrong'], n: 4 },
                    { type: 'multi', prompt: '<p>Pick both</p>', explanation: '<p>both</p>', correct: ['a', 'b'], wrong: ['c'], n: 3 },
                  ],
                },
                { id: 'tf-1', variants: [{ type: 'tf', prompt: '<p>It is true.</p>', explanation: '<p>yes</p>', answer: true }] },
                { id: 'short-1', variants: [{ type: 'short', prompt: '<p>Say it.</p>', explanation: '<p>ok</p>', accepted: ['a < b', 'R&D'] }] },
              ],
            },
          ],
        },
      ],
    },
  ])
})

test('images resolve from the folder of the file that names them, so two books can each have images/', async () => {
  const svg = (color: string) => `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="${color}"/></svg>`
  const file = (book: string) => ['---', `book: ${book}`, 'chapter: C', '---', '## S {#s}', '![x](images/pic.svg)', '?? q Q?', '* r', '- w', '> e'].join('\n')
  const root = tempRepo({
    'content/one/a.md': file('One'),
    'content/one/images/pic.svg': svg('red'),
    'content/two/b.md': file('Two'),
    'content/two/images/pic.svg': svg('blue'),
  })
  const { books, errors } = await loadContent(root)
  expect(errors).toEqual([])
  const decoded = books.map((book) => {
    const uri = /src="data:image\/svg\+xml;base64,([^"]+)"/.exec(book.chapters[0].sections[0].html)![1]
    return Buffer.from(uri, 'base64').toString()
  })
  expect(decoded).toEqual([svg('red'), svg('blue')])
})

test('the example in docs/content-format.md loads and renders without errors', async () => {
  const example = docExample('docs/content-format.md', '## Example')
  const root = tempRepo({
    'content/example.md': example,
    'content/images/lru.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>',
  })
  const { books, errors } = await loadContent(root)
  expect(errors).toEqual([])
  const html = books.flatMap((book) => book.chapters.flatMap((chapter) => chapter.sections.map((section) => section.html))).join('\n')
  expect(html).toContain('class="katex-display"')
  expect(html).toContain('class="shiki ')
  expect(html).toContain('<img src="data:image/svg+xml;base64,')
})
