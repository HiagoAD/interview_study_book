import { expect, test } from 'vitest'
import { loadContent, summarize } from './load.ts'
import { tempRepo } from './test-helpers.ts'

// Both templates put their first body line on line 6, so a section's heading is line 6 and its content line 7.
const page = (...body: string[]) => ['---', 'book: test', 'chapter: Intro', '---', '', ...body].join('\n')
const glossary = (...body: string[]) => ['---', 'book: test', 'kind: glossary', '---', '', ...body].join('\n')

/** One section, its heading on line 6 and its content on line 7. */
const section = (content: string) => page('## Sec {#sec}', content, '', '?? q1 Q?', '* right', '- wrong', '> because')

/** The entry "Strategy", with the other name "strategy pattern". Its heading is line 6, its summary line 9. */
const STRATEGY = ['## Strategy {#strategy}', '= strategy pattern', '', 'One rule behind an interface.']

const load = (files: Record<string, string>) => loadContent(tempRepo(files))

async function loadOk(files: Record<string, string>) {
  const { books, errors } = await load(files)
  expect(errors).toEqual([])
  return books[0]
}

const links = (html: string) => [...html.matchAll(/<a[^>]*class="ref[^"]*"[^>]*>[^<]*<\/a>/g)].map((match) => match[0])

test('a term resolves by its id and by any of its other names, to one entry', async () => {
  const book = await loadOk({
    'content/a.md': section('By id [[strategy]], by name [[strategy pattern]], by letters [[Strategy Pattern]].'),
    'content/g.md': glossary(...STRATEGY),
  })
  expect(links(book.chapters[0].sections[0].html)).toEqual([
    '<a href="#/g/test/strategy" class="ref ref-term">strategy</a>',
    '<a href="#/g/test/strategy" class="ref ref-term">strategy pattern</a>',
    '<a href="#/g/test/strategy" class="ref ref-term">Strategy Pattern</a>',
  ])
})

test('a term link shows what was written, or the words after the bar', async () => {
  const book = await loadOk({
    'content/a.md': section('Plain [[Strategy]], renamed [[strategy|a policy object]].'),
    'content/g.md': glossary(...STRATEGY),
  })
  expect(links(book.chapters[0].sections[0].html)).toEqual([
    '<a href="#/g/test/strategy" class="ref ref-term">Strategy</a>',
    '<a href="#/g/test/strategy" class="ref ref-term">a policy object</a>',
  ])
})

test('a section link shows the section title, or the words after the bar', async () => {
  const book = await loadOk({
    'content/a.md': page(
      '## One {#one}',
      'Go to [[#two]], or [[#two|the next part]].',
      '',
      '?? q1 Q?',
      '* right',
      '- wrong',
      '> because',
      '',
      '## Two {#two}',
      'Text.',
      '',
      '?? q2 Q?',
      '* right',
      '- wrong',
      '> because',
    ),
  })
  expect(links(book.chapters[0].sections[0].html)).toEqual([
    '<a href="#/b/test/intro/two" class="ref ref-section">Two</a>',
    '<a href="#/b/test/intro/two" class="ref ref-section">the next part</a>',
  ])
})

test('links work in a prompt, an option and an explanation', async () => {
  const book = await loadOk({
    'content/a.md': page('## Sec {#sec}', 'Text.', '', '?? q1 Which [[strategy]]?', '* the [[strategy]] one', '- wrong', '> see [[strategy]]'),
    'content/g.md': glossary(...STRATEGY),
  })
  const [variant] = book.chapters[0].sections[0].concepts[0].variants
  expect(links(variant.prompt)).toHaveLength(1)
  expect(links(variant.explanation)).toHaveLength(1)
  expect(variant.type === 'mc' && links(variant.correct[0])).toHaveLength(1)
})

test('a glossary entry can link other entries and sections from its summary and its body', async () => {
  const book = await loadOk({
    'content/a.md': section('Text.'),
    'content/g.md': glossary(
      '## Strategy {#strategy}',
      '',
      'Like [[state]], but chosen once.',
      '',
      'See [[#sec]].',
      '## State {#state}',
      'One object per phase.',
    ),
  })
  const [strategy] = book.glossary.filter((entry) => entry.id === 'strategy')
  expect(links(strategy.summary)).toEqual(['<a href="#/g/test/state" class="ref ref-term">state</a>'])
  expect(links(strategy.html)).toEqual(['<a href="#/b/test/intro/sec" class="ref ref-section">Sec</a>'])
})

test('brackets inside a code span or a fence are left alone', async () => {
  const book = await loadOk({
    'content/a.md': section('Write `[[strategy]]` like this:\n\n```text\n[[strategy]]\n```'),
    'content/g.md': glossary(...STRATEGY),
  })
  const { html } = book.chapters[0].sections[0]
  expect(links(html)).toEqual([])
  expect(html).toContain('<code>[[strategy]]</code>')
})

test('an entry lists the sections that link to it once each, in content order', async () => {
  const book = await loadOk({
    'content/a.md': page(
      '## One {#one}',
      'A [[strategy]] and another [[strategy pattern]].',
      '',
      '?? q1 About [[strategy]]?',
      '* right',
      '- wrong',
      '> because',
      '',
      '## Two {#two}',
      'Also a [[strategy]].',
      '',
      '?? q2 Q?',
      '* right',
      '- wrong',
      '> because',
    ),
    'content/g.md': glossary(...STRATEGY),
  })
  expect(book.glossary[0].uses).toEqual([
    { chapter: 'intro', section: 'one' },
    { chapter: 'intro', section: 'two' },
  ])
  expect(summarize([book])).toMatchObject({ terms: 1, links: 2 })
})

test('a link written inside a glossary entry is not a place the term appears', async () => {
  const book = await loadOk({
    'content/a.md': section('Text.'),
    'content/g.md': glossary('## Strategy {#strategy}', 'Like [[state]].', '## State {#state}', 'One object per phase.'),
  })
  expect(book.glossary.map((entry) => [entry.id, entry.uses])).toEqual([
    ['state', []],
    ['strategy', []],
  ])
})

test('an entry keeps its related entries and other names on the model', async () => {
  const book = await loadOk({
    'content/a.md': section('Text.'),
    'content/g.md': glossary('## Strategy {#strategy}', '= strategy pattern | policies', '-> state', '', 'One rule.', '## State {#state}', 'One phase.'),
  })
  expect(book.glossary[1]).toMatchObject({ id: 'strategy', term: 'Strategy', names: ['strategy pattern', 'policies'], see: ['state'], html: '' })
})

type Case = [name: string, files: Record<string, string>, line: number, fragment: string]

const cases: Case[] = [
  [
    'unknown term, with one plausible entry',
    { 'content/a.md': section('Many [[strategies]] here.'), 'content/g.md': glossary(...STRATEGY) },
    7,
    'no glossary entry is called "strategies": did you mean "Strategy"?',
  ],
  [
    'unknown term, with nothing close',
    { 'content/a.md': section('A [[mutex]] here.'), 'content/g.md': glossary(...STRATEGY) },
    7,
    'no glossary entry is called "mutex": add an entry for it in a "kind: glossary" file',
  ],
  [
    'unknown term, with several plausible entries',
    {
      'content/a.md': section('A [[poo]] here.'),
      'content/g.md': glossary('## Pool {#pool}', 'One.', '## Pooling {#pooling}', 'Two.'),
    },
    7,
    'no glossary entry is called "poo": add an entry for it',
  ],
  ['a term with no glossary at all', { 'content/a.md': section('A [[strategy]] here.') }, 7, 'no glossary entry is called "strategy"'],
  ['unknown section id', { 'content/a.md': section('See [[#missing]].') }, 7, 'no section has the id "missing"'],
  ['a section linking to itself', { 'content/a.md': section('See [[#sec]].') }, 7, 'points at the section it is written in ("sec")'],
  [
    'an entry linking to itself',
    { 'content/a.md': section('Text.'), 'content/g.md': glossary('## Strategy {#strategy}', 'A [[strategy]] is one rule.') },
    7,
    'points at the entry it is written in ("Strategy")',
  ],
  ['an empty target', { 'content/a.md': section('Here [[]].') }, 7, 'this "[[...]]" link has no target'],
  ['a bar with nothing after it', { 'content/a.md': section('Here [[strategy|]].') }, 7, 'has nothing to show'],
  ['brackets that never close', { 'content/a.md': section('Here [[strategy.') }, 7, 'this "[[" is never closed'],
  ['brackets inside a Markdown link', { 'content/a.md': section('A [named [[strategy]] link](#x).') }, 7, 'cannot go inside a Markdown link'],
  [
    'a link in a prompt reports the prompt line',
    { 'content/a.md': page('## Sec {#sec}', 'Text.', '', '?? q1 Which [[missing]]?', '* right', '- wrong', '> because'), 'content/g.md': glossary(...STRATEGY) },
    9,
    'no glossary entry is called "missing"',
  ],
  [
    'a link on the second line of a paragraph reports that line',
    { 'content/a.md': section('First line,\nand a [[missing]] one.'), 'content/g.md': glossary(...STRATEGY) },
    8,
    'no glossary entry is called "missing"',
  ],
]

test.each(cases)('%s', async (_name, files, line, fragment) => {
  const { errors } = await load(files)
  const report = errors.map((error) => `${error.file}:${error.line}: ${error.message}`).join('\n')
  expect(errors, report).toHaveLength(1)
  expect(errors[0].line, report).toBe(line)
  expect(errors[0].message, report).toContain(fragment)
})

test('a summary has to be one paragraph', async () => {
  const { errors } = await load({
    'content/a.md': section('Text.'),
    'content/g.md': glossary('## Strategy {#strategy}', '- a list, not a paragraph', '', 'Body.'),
  })
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ line: 7 })
  expect(errors[0].message).toContain('the summary must be one paragraph')
})
