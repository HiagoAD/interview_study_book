import { expect, test } from 'vitest'
import { checkStyle, compareQuestions, maskNonProse } from './guard.ts'
import type { Allow } from './guard.ts'
import type { Source } from './load.ts'

const PATH = 'content/a.md'

/** A chapter file: one section with three concepts, then a second section. Line numbers are in the comments. */
const BASE = [
  '---', // 1
  'book: Test', // 2
  'chapter: Intro', // 3
  '---', // 4
  '## One {#one}', // 5
  'Text.', // 6
  '', // 7
  'Exercise: write one.', // 8
  '', // 9
  '?? c1 [n=3] Which is right?', // 10
  '* right', // 11
  '* also right', // 12
  '- wrong', // 13
  '- also wrong', // 14
  '> Because.', // 15
  '', // 16
  '?+ [short] Name it.', // 17
  '= it | that', // 18
  '> Its name.', // 19
  '', // 20
  '?? c2 [tf] It is true.', // 21
  '* true', // 22
  '> It is.', // 23
  '', // 24
  '?? c3 Another?', // 25
  '* yes', // 26
  '- no', // 27
  '> Yes.', // 28
  '', // 29
  '## Two {#two}', // 30
  'More text.', // 31
  '', // 32
  'Exercise: write two.', // 33
  '', // 34
  '?? c4 Last?', // 35
  '* yes', // 36
  '- no', // 37
  '> Yes.', // 38
]

const source = (lines: string[], path = PATH): Source => ({ path, text: lines.join('\n') })

/** BASE with each 1-based line number in `edits` replaced by its text; `null` removes the line. */
function edited(edits: Record<number, string | null>): string[] {
  return BASE.flatMap((text, i) => {
    const edit = edits[i + 1]
    return edit === undefined ? [text] : edit === null ? [] : [edit]
  })
}

function compare(work: string[], allow: Allow = null) {
  return compareQuestions([source(BASE)], [source(work)], { rev: 'base', allow })
}

const where = (errors: { line: number; message: string }[]) => errors.map((e) => [e.line, e.message])

test('the same questions match, however far prose moved them', () => {
  const moved = edited({ 6: 'Text.\n\nA new paragraph.\n\n```ts\nconst x = 1\n```', 31: 'More text, and more.\nAnd a second line.' })
  const report = compare(moved)
  expect(report.errors).toEqual([])
  expect(report).toMatchObject({ sections: 2, concepts: 4, variants: 5 })
})

type Case = [name: string, edits: Record<number, string | null>, expected: [line: number, fragment: string][]]

const strictCases: Case[] = [
  ['a changed prompt', { 25: '?? c3 Another one?' }, [[25, 'concept "c3", variant 1: the prompt changed; at base it was "Another?"']]],
  [
    'a changed correct option',
    { 11: '* right now' },
    [
      [10, 'concept "c1", variant 1: the correct option "right" is gone or changed'],
      [11, 'concept "c1", variant 1: this correct option is new or changed: "right now"'],
    ],
  ],
  ['a removed correct option', { 12: null }, [[10, 'the correct option "also right" is gone or changed']]],
  ['a changed explanation', { 15: '> Because of it.' }, [[15, 'the explanation changed; at base it was "Because."']]],
  ['a changed accepted answer', { 18: '= it | this' }, [[17, 'concept "c1", variant 2: the accepted answers changed from "it | that" to "it | this"']]],
  ['a flipped true/false answer', { 22: '* false' }, [[21, 'the answer changed from true to false']]],
  ['a changed option count', { 10: '?? c1 [n=4] Which is right?' }, [[10, 'the option count changed from n=3 to n=4']]],
  ['a changed type', { 25: '?? c3 [multi] Another?' }, [[25, 'the type changed from multiple choice to [multi]']]],
  [
    'a changed wrong option',
    { 13: '- very wrong' },
    [
      [10, 'the wrong option "wrong" is gone or changed'],
      [13, 'this wrong option is new or changed: "very wrong"'],
    ],
  ],
  ['an added wrong option', { 14: '- also wrong\n- wrong again' }, [[15, 'this wrong option is new or changed: "wrong again"']]],
  ['a removed wrong option', { 14: null }, [[10, 'the wrong option "also wrong" is gone or changed']]],
  ['wrong options in a new order', { 13: '- also wrong', 14: '- wrong' }, [[13, 'the wrong options are in a different order']]],
  ['an added variant', { 23: '> It is.\n?+ [tf] It is false.\n* false\n> It is not.' }, [[24, 'concept "c2", variant 2 is new: it is not at base']]],
  ['a removed variant', { 17: null, 18: null, 19: null }, [[10, 'concept "c1", variant 2 is gone: at base it asked "Name it."']]],
]

/** Each error's line, and whether its message contains the expected fragment. */
function matches(errors: { file: string; line: number; message: string }[], expected: Case[2]) {
  expect(errors.map((e) => e.file)).toEqual(expected.map(() => PATH))
  expect(errors.map((e) => e.line)).toEqual(expected.map(([line]) => line))
  errors.forEach((error, i) => expect(error.message).toContain(expected[i][1]))
}

test.each(strictCases)('%s fails the question check', (_name, edits, expected) => {
  matches(compare(edited(edits)).errors, expected)
})

test('with distractors allowed, wrong options may change, appear and disappear, and are counted', () => {
  const report = compare(edited({ 13: '- very wrong', 14: '- also wrong\n- wrong again', 27: null, 26: '* yes\n- not at all' }), 'distractors')
  expect(report.errors).toEqual([])
  expect(report.distractors).toEqual({ added: 3, removed: 2 })
})

test.each(strictCases.filter(([name]) => !name.includes('wrong option')))('with distractors allowed, %s still fails', (_name, edits, expected) => {
  matches(compare(edited(edits), 'distractors').errors, expected)
})

test('a section that is renamed, removed or moved fails, at the line to look at', () => {
  expect(where(compare(edited({ 30: '## Two {#second}' })).errors)).toEqual([
    [30, 'section "two" is gone (this line is at base): section ids may not change, so restore it or its id'],
    [30, 'section "second" is new: section ids may not change, and it is not at base'],
    [35, 'concept "c4" has moved from section "two" to section "second"'],
  ])

  const swapped = [...BASE.slice(0, 4), ...BASE.slice(29), '', ...BASE.slice(4, 28)]
  expect(where(compare(swapped).errors)).toEqual([
    [5, 'section "two" has moved: at base it came after "one", and now it comes first in its book'],
    [15, 'section "one" has moved: at base it came first in its book, and now it comes after "two"'],
  ])
})

test('a concept that is renamed, removed, reordered or moved to another section fails', () => {
  expect(where(compare(edited({ 25: '?? c3b Another?' })).errors)).toEqual([
    [25, 'concept "c3" is gone (this line is at base): concept ids are progress, so restore it or its id'],
    [25, 'concept "c3b" is new: it is not at base'],
  ])

  const reordered = [...BASE.slice(0, 20), ...BASE.slice(24, 29), ...BASE.slice(20, 24), ...BASE.slice(29)]
  expect(where(compare(reordered).errors)).toEqual([
    [21, 'concept "c3" has moved within section "one": at base it came after "c2", and now it comes after "c1"'],
    [26, 'concept "c2" has moved within section "one": at base it came after "c1", and now it comes after "c3"'],
  ])

  const intoTwo = [...BASE.slice(0, 24), ...BASE.slice(29), '', ...BASE.slice(24, 28)]
  expect(where(compare(intoTwo).errors)).toEqual([[35, 'concept "c3" has moved from section "one" to section "two"']])
})

test('content errors are reported instead of a comparison, naming the revision they are at', () => {
  const broken = edited({ 15: null })
  expect(where(compare(broken).errors)).toEqual([[10, 'this variant has no explanation: add a "> text" line after the options']])
  const report = compareQuestions([source(broken)], [source(BASE)], { rev: 'base', allow: null })
  expect(report.errors[0].message).toMatch(/^at base: this variant has no explanation/)
})

test('a book split across files compares by section id, whichever file holds the section', () => {
  const [head, one, two] = [BASE.slice(0, 4), BASE.slice(4, 29), BASE.slice(29)]
  const split = [source([...head, ...one]), source(['---', 'book: Test', '---', '# Intro Two', ...two], 'content/b.md')]
  const report = compareQuestions([source(BASE)], split, { rev: 'base', allow: null })
  expect(report.errors).toEqual([])
})

const glossary = (...lines: string[]) => source(['---', 'book: Test', 'kind: glossary', '---', ...lines], 'content/glossary.md')

test('em dashes, contractions and straight double quotes in prose are reported at their lines', () => {
  const errors = checkStyle([source(edited({ 6: 'A pool — reused.', 31: "It isn't here,\nand it's \"there\"." }))])
  expect(where(errors)).toEqual([
    [6, 'em dash in prose: use a comma, a semicolon, parentheses or two sentences, near "A pool — reused."'],
    [31, `contraction "isn't" in prose: write the words out, near "It isn't here,"`],
    [32, `contraction "it's" in prose: write the words out, near "and it's "there"."`],
    [32, 'straight double quote in prose: use curly quotes, or a code span for code, near "and it\'s "there"."'],
    [32, 'straight double quote in prose: use curly quotes, or a code span for code, near "and it\'s "there"."'],
  ])
})

test('possessives, code, math, link targets and quotations are not flagged', () => {
  const prose = [
    "The player's pool and everyone's first attempt, in the game's own words.",
    '`a — b` and ``x "y" `z` `` and $a - b$ and $$ c $$ are code and math.',
    '[the manual](https://example.com/a—b"c) and “don’t quote me — ever”.',
    '```cs',
    'var s = "don\'t — stop";',
    '```',
  ].join('\n')
  expect(checkStyle([source(edited({ 6: prose }))])).toEqual([])
})

test('headings, question text and glossary entries are prose too', () => {
  const chapter = edited({ 5: '## One — first {#one}', 10: "?? c1 [n=3] Which one isn't right?", 14: '- also — wrong', 19: '> Its "name".' })
  expect(checkStyle([source(chapter)]).map((e) => e.line)).toEqual([5, 10, 14, 19, 19])

  const entry = glossary('## Pool — reuse {#pool}', '= won\'t', '', 'A summary — short.', '', 'A body with "quotes".')
  expect(checkStyle([entry]).map((e) => e.line)).toEqual([5, 6, 8, 10, 10])
})

test('a section must close with its exercise; a glossary entry has none', () => {
  expect(checkStyle([source(BASE), glossary('## Pool {#pool}', 'A summary.')])).toEqual([])
  expect(checkStyle([source(edited({ 8: 'Design exercise: draw it.' }))])).toEqual([])

  const after = checkStyle([source(edited({ 8: 'Exercise: write one.\n\nDesign exercise: draw it.\n\nOne more paragraph.' }))])
  expect(where(after)).toEqual([[10, 'section "one" goes on after its closing exercise: move the exercise to the end of the content, after the block at line 12']])

  const fenced = checkStyle([source(edited({ 8: 'Exercise: write one.\n```ts\nconst x = 1\n```' }))])
  expect(fenced.map((e) => e.line)).toEqual([8])

  const none = checkStyle([source(edited({ 8: 'No exercise here.' }))])
  expect(where(none)).toEqual([[5, 'section "one" has no closing exercise: end its content with a paragraph that starts "Exercise:"']])
})

test('masking keeps every index, so a finding lands on its own line and column', () => {
  const text = 'a `b\nc` d\n```\ne\n```\n“f\ng” h'
  const masked = maskNonProse(text)
  expect(masked).toHaveLength(text.length)
  expect(masked.split('\n')).toEqual(['a   ', '   d', '   ', ' ', '   ', '  ', '   h'])
})
