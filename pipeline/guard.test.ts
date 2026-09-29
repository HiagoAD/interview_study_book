import { expect, test } from 'vitest'
import { checkStyle, compareQuestions, compareStructure, maskNonProse, readStructureChanges } from './guard.ts'
import type { Allow, StructureChanges } from './guard.ts'
import type { Source } from './load.ts'

const PATH = 'content/a.md'

/** A chapter file: one section with three concepts, then a second section. Line numbers are in the comments. */
const BASE = [
  '---', // 1
  'book: test', // 2
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

test('a base from before book ids, whose book: line gave the title, is read with the id that title made', () => {
  const byTitle = edited({ 2: 'book: Test' })
  const withTitle = source(edited({ 2: 'book: test\ntitle: Test' }))
  for (const text of [byTitle.join('\n'), byTitle.join('\r\n')]) {
    const report = compareQuestions([{ path: PATH, text }], [withTitle], { rev: 'base', allow: null })
    expect(report.errors).toEqual([])
    expect(report).toMatchObject({ sections: 2, concepts: 4, variants: 5 })
  }
  // Only the base is read that way: the content being checked needs an id.
  expect(where(compare(byTitle).errors)).toEqual([[2, expect.stringContaining('invalid book id "Test"')]])
})

test('a book split across files compares by section id, whichever file holds the section', () => {
  const [head, one, two] = [BASE.slice(0, 4), BASE.slice(4, 29), BASE.slice(29)]
  const split = [source([...head, ...one]), source(['---', 'book: test', '---', '# Intro Two', ...two], 'content/b.md')]
  const report = compareQuestions([source(BASE)], split, { rev: 'base', allow: null })
  expect(report.errors).toEqual([])
})

/** A second chapter of BASE's book, in a file of its own. */
const OUTRO = source(['---', 'book: test', '---', '# Outro', '## Three {#three}', 'Text.', '', 'Exercise: write three.', '', '?? c5 New?', '* yes', '- no', '> Yes.'], 'content/b.md')

/** A second book whose section id repeats one of BASE's: sections are keyed by book, so it is still new. */
const OTHER_BOOK = source(['---', 'book: other', 'chapter: First', '---', '## One {#one}', 'Text.', '', 'Exercise: write one.', '', '?? c1 Other?', '* yes', '- no', '> Yes.', '?+ [tf] True?', '* true', '> Yes.'], 'content/other/a.md')

/** BASE with a third section, and its concept, added to its only chapter. */
const NEW_SECTION = edited({ 38: '> Yes.\n\n## Three {#three}\nText.\n\nExercise: write three.\n\n?? c5 New?\n* yes\n- no\n> Yes.' })

function compareWork(work: Source[], allow: Allow) {
  return compareQuestions([source(BASE)], work, { rev: 'base', allow })
}

test('with new chapters allowed, a new chapter and a new book pass, and each is counted', () => {
  const report = compareWork([source(BASE), OUTRO, OTHER_BOOK], 'new-chapters')
  expect(report.errors).toEqual([])
  expect(report.newChapters).toEqual([
    { book: 'other', title: 'First', file: 'content/other/a.md', sections: 1, concepts: 1, variants: 2 },
    { book: 'test', title: 'Outro', file: 'content/b.md', sections: 1, concepts: 1, variants: 1 },
  ])
  expect(report).toMatchObject({ sections: 4, concepts: 6, variants: 8 })

  expect(where(compareWork([source(BASE), OUTRO], null).errors)).toEqual([
    [5, 'section "three" is new: section ids may not change, and it is not at base'],
    [10, 'concept "c5" is new: it is not at base'],
  ])
})

test('with new chapters allowed, a new section, a new concept or a changed option in an existing chapter still fails', () => {
  expect(where(compareWork([source(NEW_SECTION), OTHER_BOOK], 'new-chapters').errors)).toEqual([
    [40, 'section "three" is new: section ids may not change, and it is not at base'],
    [45, 'concept "c5" is new: it is not at base'],
  ])
  const newConcept = edited({ 28: '> Yes.\n\n?? c5 New?\n* yes\n- no\n> Yes.' })
  expect(where(compareWork([source(newConcept)], 'new-chapters').errors)).toEqual([[30, 'concept "c5" is new: it is not at base']])
  matches(compareWork([source(edited({ 11: '* right now' })), OUTRO], 'new-chapters').errors, strictCases[1][2])
})

test('a chapter is recognized by its sections, so a renamed chapter is still compared strictly', () => {
  const renamed = edited({ 3: 'chapter: Introduction' })
  const report = compareWork([source(renamed)], 'new-chapters')
  expect(report.errors).toEqual([])
  expect(report.newChapters).toEqual([])

  const renamedAndGrown = [...NEW_SECTION.slice(0, 2), 'chapter: Introduction', ...NEW_SECTION.slice(3)]
  expect(compareWork([source(renamedAndGrown)], 'new-chapters').errors.map((e) => e.line)).toEqual([40, 45])
})

test('a concept moved into a new chapter is reported as moved, not accepted as new', () => {
  const withoutC3 = edited({ 25: null, 26: null, 27: null, 28: null })
  const outroWithC3 = source([...OUTRO.text.split('\n').slice(0, 9), '?? c3 Another?', '* yes', '- no', '> Yes.'], 'content/b.md')
  expect(fileLines(compareWork([source(withoutC3), outroWithC3], 'new-chapters').errors)).toEqual([
    ['content/b.md:10', 'concept "c3" has moved from section "one" to section "three"'],
  ])
})

const NO_CHANGES: StructureChanges = { newConcepts: [], movedVariants: [], addedVariants: [], addedAnswers: [] }

function structure(work: string[], changes: Partial<StructureChanges>) {
  return compareStructure([source(BASE)], [source(work)], { rev: 'base', changes: { ...NO_CHANGES, ...changes }, file: 'changes.json' })
}

const fileLines = (errors: { file: string; line: number; message: string }[]) => errors.map((e) => [`${e.file}:${e.line}`, e.message])

/** BASE with c1's second variant turned into the first variant of a new concept, c1b. */
const SPLIT = edited({ 17: '?? c1b [short] Name it.' })
const SPLIT_C1B = { id: 'c1b', section: 'one', variants: [{ from: 'c1', variant: 2 }] }

test('a split listed in the changes file passes; unlisted or not done, it fails', () => {
  const report = structure(SPLIT, { newConcepts: [SPLIT_C1B] })
  expect(report.errors).toEqual([])
  expect(report).toMatchObject({ concepts: 5, variants: 5 })

  expect(fileLines(structure(SPLIT, {}).errors)).toEqual([
    [`${PATH}:10`, 'concept "c1" has 1 variants, where the changes file leads to 2'],
    [`${PATH}:17`, 'concept "c1b" is new, and the changes file does not list it'],
  ])
  expect(fileLines(structure(BASE, { newConcepts: [SPLIT_C1B] }).errors)).toEqual([
    ['changes.json:1', 'the changes file lists new concept "c1b", but the book has no such concept'],
    [`${PATH}:10`, 'concept "c1" has 2 variants, where the changes file leads to 1'],
  ])
})

test('a moved variant goes to the end of its new concept, unchanged', () => {
  const moved = [...edited({ 17: null, 18: null, 19: null }), '', '?+ [short] Name it.', '= it | that', '> Its name.']
  expect(structure(moved, { movedVariants: [{ from: 'c1', variant: 2, to: 'c4' }] }).errors).toEqual([])

  const changed = [...moved.slice(0, -1), '> Its new name.']
  expect(fileLines(structure(changed, { movedVariants: [{ from: 'c1', variant: 2, to: 'c4' }] }).errors)).toEqual([
    [`${PATH}:39`, 'concept "c4", variant 2, which was variant 2 of "c1" at base: the explanation changed; at base it was "Its name."'],
  ])
})

test('a concept may give up only its last variants, and has to keep one', () => {
  const early = structure(BASE, { newConcepts: [{ id: 'c1a', section: 'one', variants: [{ from: 'c1', variant: 1 }] }] })
  expect(early.errors[0]).toMatchObject({ file: 'changes.json', line: 1 })
  expect(early.errors[0].message).toContain('"c1" would give up variant 1 while a later one stays: take its last variants only')

  const empty = structure(BASE, { movedVariants: [{ from: 'c3', variant: 1, to: 'c4' }] })
  expect(empty.errors.map((e) => e.message)).toContain('"c3" would be left with no variants, and every concept id has to survive')
})

test('added variants and answers pass where the file lists them, and nowhere else', () => {
  const work = edited({ 18: '= it | that | those', 28: '> Yes.\n\n?+ Another again?\n* yes\n- no\n> Yes again.' })
  const listed = { addedVariants: [{ concept: 'c3', variant: 2 }], addedAnswers: [{ concept: 'c1', variant: 2, answers: ['those'] }] }
  expect(structure(work, listed).errors).toEqual([])

  expect(fileLines(structure(work, { ...listed, addedVariants: [{ concept: 'c3', variant: 3 }] }).errors)).toEqual([
    ['changes.json:1', 'the added variant of "c3" is listed as variant 3, but added variants follow the others, so it is variant 2'],
    [`${PATH}:25`, 'concept "c3" has 2 variants, where the changes file leads to 1'],
  ])
  expect(fileLines(structure(work, { addedVariants: listed.addedVariants }).errors)).toEqual([
    [`${PATH}:17`, 'concept "c1", variant 2: the accepted answers changed from "it | that" to "it | that | those"'],
  ])
})

test('a concept split off another stays in its section, and every base concept survives', () => {
  expect(fileLines(structure(SPLIT, { newConcepts: [{ ...SPLIT_C1B, section: 'two' }] }).errors)).toEqual([
    ['changes.json:1', 'new concept "c1b" is placed in section "two", but its variant from "c1" is in section "one": a concept split off another stays in its section'],
    [`${PATH}:17`, 'concept "c1b" is in section "one", but the changes file places it in "two"'],
  ])
  expect(fileLines(structure(edited({ 25: null, 26: null, 27: null, 28: null }), {}).errors)).toEqual([
    [`${PATH}:25`, 'concept "c3" is gone (this line is at base): every concept id has to survive a structure change'],
  ])
})

test('a changes file of the wrong shape is refused, with every problem named', () => {
  const text = '{"newConcepts": [{"id": "x"}], "extra": 1, "addedAnswers": [{"concept": "c1", "variant": 0, "answers": []}]}'
  const { changes, errors } = readStructureChanges(text, 'changes.json')
  expect(changes).toBeNull()
  expect(errors.map((e) => e.message)).toEqual([
    'unknown key "extra": the keys are "about", "newConcepts", "movedVariants", "addedVariants", "addedAnswers"',
    'newConcepts[0]: "section" must be a non-empty string',
    'newConcepts[0]: "variants" must be a non-empty list',
    'addedAnswers[0]: "variant" must be a whole number from 1',
    'addedAnswers[0]: "answers" must be a non-empty list of non-empty strings',
  ])
  expect(readStructureChanges('{', 'changes.json').errors[0].message).toMatch(/^not valid JSON/)
  expect(readStructureChanges(JSON.stringify({ about: 'x', ...NO_CHANGES }), 'changes.json').changes).toEqual({ about: 'x', ...NO_CHANGES })
})

const glossary = (...lines: string[]) => source(['---', 'book: test', 'kind: glossary', '---', ...lines], 'content/glossary.md')

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
