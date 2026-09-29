import { expect, test } from 'vitest'
import { parseContentFile, slug } from './parse.ts'
import { docExample } from './test-helpers.ts'

const parse = (...lines: string[]) => parseContentFile('content/t.md', lines.join('\n'))

function parseOk(...lines: string[]) {
  const { file, errors } = parse(...lines)
  expect(errors).toEqual([])
  return file
}

const FM = ['---', 'book: test', 'chapter: Intro', '---']
const MC = ['?? q1 Question?', '* right', '- wrong', '> because']

test('the PROJECT.md example parses to the expected structure', () => {
  const example = docExample('PROJECT.md', '### File format')
  const { file, errors } = parseContentFile('content/example.md', example)

  expect(errors).toEqual([])
  expect(file.book).toEqual({ id: 'system-design', line: 2 })
  expect(file.title).toEqual({ text: 'System Design', line: 3 })
  expect(file.chapters).toHaveLength(1)
  const [chapter] = file.chapters
  expect(chapter).toMatchObject({ id: 'caching', title: 'Caching', line: 4 })
  expect(chapter.sections).toHaveLength(1)
  const [section] = chapter.sections
  expect(section).toMatchObject({ id: 'cache-eviction', title: 'Cache eviction', line: 7 })
  expect(section.content).toEqual({
    line: 9,
    md: [
      'Content in plain Markdown. Inline math $O(1)$, display math:',
      '',
      String.raw`$$ hit\ rate = \frac{hits}{hits + misses} $$`,
      '',
      '```python',
      'cache = LRUCache(capacity=100)',
      '```',
      '',
      '![LRU diagram](images/lru.png)',
    ].join('\n'),
  })

  expect(section.concepts.map((c) => [c.id, c.line, c.variants.length])).toEqual([
    ['lru-evict', 19, 2],
    ['lru-cost', 34, 1],
    ['fifo-name', 38, 1],
  ])
  const [evict, cost, fifo] = section.concepts
  expect(evict.variants[0]).toEqual({
    type: 'mc',
    n: 4,
    line: 19,
    prompt: { md: 'Which entry does an LRU cache evict first?', line: 19 },
    correct: [
      { md: 'The least recently used entry', line: 20 },
      { md: 'The entry that has gone longest without being read', line: 21 },
    ],
    wrong: [
      { md: 'The most recently used entry', line: 22 },
      { md: 'The largest entry', line: 23 },
      { md: 'The oldest inserted entry', line: 24 },
      { md: 'A random entry', line: 25 },
    ],
    explanation: {
      md: 'LRU tracks access order and removes the entry that has gone longest without being read.',
      line: 26,
    },
  })
  expect(evict.variants[1]).toEqual({
    type: 'mc',
    n: 4,
    line: 28,
    prompt: { md: 'Keys A, B and C are inserted in that order, then A is read. Which key does LRU evict next?', line: 28 },
    correct: [{ md: 'B', line: 29 }],
    wrong: [
      { md: 'A', line: 30 },
      { md: 'C', line: 31 },
    ],
    explanation: { md: 'After A is read, B is the least recently used key.', line: 32 },
  })
  expect(cost.variants[0]).toEqual({
    type: 'tf',
    line: 34,
    prompt: { md: 'LRU lookups are O(n).', line: 34 },
    answer: false,
    explanation: { md: 'With a hash map plus a doubly linked list, both lookup and eviction are O(1).', line: 36 },
  })
  expect(fifo.variants[0]).toEqual({
    type: 'short',
    line: 38,
    prompt: { md: 'Name the eviction policy that removes the oldest inserted entry.', line: 38 },
    accepted: ['FIFO', 'first in first out'],
    explanation: { md: 'FIFO ignores access; it evicts by insertion order.', line: 40 },
  })
})

test('the example in docs/content-format.md parses cleanly and uses every question type', () => {
  const example = docExample('docs/content-format.md', '## Example')
  const { file, errors } = parseContentFile('content/example.md', example)

  expect(errors).toEqual([])
  expect(file.chapters.map((c) => c.id)).toEqual(['caching', 'consistency'])
  const variants = file.chapters.flatMap((c) => c.sections.flatMap((s) => s.concepts.flatMap((k) => k.variants)))
  expect([...new Set(variants.map((v) => v.type))].sort()).toEqual(['mc', 'multi', 'short', 'tf'])
})

test('lines inside a fenced code block in the content are content, not structure', () => {
  const file = parseOk(
    ...FM,
    '## Code {#code}',
    'Look:',
    '```python',
    '# a comment',
    '## not a section {#nope}',
    '?? not-a-concept Not a question',
    '?+ not a variant',
    '* not an option',
    '- not an option',
    '```',
    ...MC,
  )
  expect(file.chapters).toHaveLength(1)
  const [section] = file.chapters[0].sections
  expect(file.chapters[0].sections).toHaveLength(1)
  expect(section.content.md).toBe(
    ['Look:', '```python', '# a comment', '## not a section {#nope}', '?? not-a-concept Not a question', '?+ not a variant', '* not an option', '- not an option', '```'].join('\n'),
  )
  expect(section.concepts.map((c) => c.id)).toEqual(['q1'])
})

test('a fence directly after a question line is part of its prompt', () => {
  const file = parseOk(
    ...FM,
    '## Code {#code}',
    'Read the code.',
    '?? out What does this print?',
    '```js',
    '# heading',
    '## heading',
    '?? nope',
    '?+ nope',
    '* 1',
    '- 2',
    '= 3',
    '> 4',
    '```',
    '* one',
    '- two',
    '> It prints one.',
  )
  const [concept] = file.chapters[0].sections[0].concepts
  expect(concept.variants).toHaveLength(1)
  const variant = concept.variants[0]
  if (variant.type !== 'mc') throw new Error('expected mc')
  expect(variant.prompt).toEqual({
    line: 7,
    md: ['What does this print?', '```js', '# heading', '## heading', '?? nope', '?+ nope', '* 1', '- 2', '= 3', '> 4', '```'].join('\n'),
  })
  expect(variant.correct).toEqual([{ md: 'one', line: 18 }])
  expect(variant.explanation).toEqual({ md: 'It prints one.', line: 20 })
})

test('a fence closes only with the same character and at least as many of them', () => {
  const file = parseOk(
    ...FM,
    '## Fences {#fences}',
    '````md',
    '```',
    '## inside a longer backtick fence',
    '```',
    '````',
    '~~~',
    '```',
    '## inside a tilde fence',
    '~~~',
    '```not a fence```',
    ...MC,
    '## Next {#next}',
    'More.',
    ...MC,
  )
  // Had "```not a fence```" opened a fence, it would swallow the rest of the file and report it as unclosed.
  expect(file.chapters[0].sections.map((s) => s.id)).toEqual(['fences', 'next'])
  expect(file.chapters[0].sections[0].content.md).toContain('## inside a longer backtick fence')
  expect(file.chapters[0].sections[0].content.md).toContain('## inside a tilde fence')
})

test('a fence may be indented up to three spaces, but four spaces is not a fence', () => {
  const indented = parseOk(...FM, '## A {#a}', '   ```', '## inside', '   ```', ...MC)
  expect(indented.chapters[0].sections.map((s) => s.id)).toEqual(['a'])

  const { file } = parse(...FM, '## A {#a}', '    ```', '## B {#b}', 'Text.', ...MC)
  expect(file.chapters[0].sections.map((s) => s.id)).toEqual(['a', 'b'])
})

test('one file can hold several chapters, and front matter can name the first', () => {
  const file = parseOk(
    ...FM,
    '## A {#a}',
    'Content a.',
    ...MC,
    '',
    '# Second Chapter!',
    '',
    '## B {#b}',
    'Content b.',
    ...MC,
    '## C {#c}',
    'Content c.',
    ...MC,
  )
  expect(file.chapters.map((c) => [c.id, c.title, c.sections.map((s) => s.id)])).toEqual([
    ['intro', 'Intro', ['a']],
    ['second-chapter', 'Second Chapter!', ['b', 'c']],
  ])
  expect(file.chapters[1].line).toBe(12)
})

test('a file without a chapter key starts its first chapter with a # heading', () => {
  const file = parseOk('---', 'book: test', '---', '# One', '## A {#a}', 'Content.', ...MC)
  expect(file.chapters.map((c) => c.title)).toEqual(['One'])
})

test.each([
  ['', 'mc', 4],
  ['[n=5] ', 'mc', 5],
  ['[multi] ', 'multi', 4],
  ['[multi n=7] ', 'multi', 7],
  ['[multi, n=2] ', 'multi', 2],
  ['[ n=9 , multi ] ', 'multi', 9],
])('settings %j give type %s and n=%i', (settings, type, n) => {
  const file = parseOk(...FM, '## A {#a}', 'Content.', `?? q1 ${settings}Question?`, '* right', '- wrong', '> because')
  const variant = file.chapters[0].sections[0].concepts[0].variants[0]
  expect(variant).toMatchObject({ type, n, prompt: { md: 'Question?' } })
})

test('variants of one concept can use different types', () => {
  const file = parseOk(
    ...FM,
    '## A {#a}',
    'Content.',
    ...MC,
    '?+ [tf] It is true.',
    '* TRUE',
    '> yes',
    '?+ [short] Name it.',
    '= a',
    '> b',
  )
  const [concept] = file.chapters[0].sections[0].concepts
  expect(concept.variants.map((v) => v.type)).toEqual(['mc', 'tf', 'short'])
  expect(concept.variants[1]).toMatchObject({ answer: true })
})

test('explanation lines join with newlines and a bare > is a paragraph break', () => {
  const file = parseOk(...FM, '## A {#a}', 'Content.', '?? q1 Question?', '* right', '- wrong', '>', '> First.', '>', '> Second.', '>     indented', '>')
  const { explanation } = file.chapters[0].sections[0].concepts[0].variants[0]
  // The leading bare ">" is dropped, so the chunk starts on the first line with text.
  expect(explanation).toEqual({ md: 'First.\n\nSecond.\n    indented', line: 11 })
})

test('accepted answers are split on |, trimmed, and empty ones dropped, across several lines', () => {
  const file = parseOk(...FM, '## A {#a}', 'Content.', '?? q1 [short] Name it.', '= FIFO | first in first out |', '=  | queue ||', '= $5', '> because')
  expect(file.chapters[0].sections[0].concepts[0].variants[0]).toMatchObject({
    accepted: ['FIFO', 'first in first out', 'queue', '$5'],
  })
})

test('Windows line endings and a byte order mark change nothing', () => {
  const text = ['---', 'book: test', 'chapter: Intro', '---', '## A {#a}', 'Content.', ...MC].join('\r\n')
  const plain = parseContentFile('content/t.md', text.replaceAll('\r\n', '\n'))
  const crlf = parseContentFile('content/t.md', `﻿${text}`)
  expect(crlf.errors).toEqual([])
  expect(crlf).toEqual(plain)
})

test('slug strips accents, lowercases and collapses non-alphanumerics to dashes', () => {
  expect(slug('System Design')).toBe('system-design')
  expect(slug('  Café: Ünïcode & C++!  ')).toBe('cafe-unicode-c')
  expect(slug('２ Fast')).toBe('2-fast')
  expect(slug('---')).toBe('')
})
