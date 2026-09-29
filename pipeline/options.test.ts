import { expect, test } from 'vitest'
import { assembleBooks } from './load.ts'
import type { Source } from './load.ts'
import { describeFigures, measureOptions, optionFigures, tellGainsNothing } from './options.ts'
import type { OptionFigures } from './options.ts'
import { parseContentFile } from './parse.ts'

/** A chapter file with one section holding `questions`. */
function chapterFile(path: string, chapter: string, section: string, questions: string[]): Source {
  const lines = ['---', 'book: test', `chapter: ${chapter}`, '---', `## ${chapter} {#${section}}`, 'Text.', '', 'Exercise: do it.', '', ...questions]
  return { path, text: lines.join('\n') }
}

function variantsOf(questions: string[]) {
  const { file, errors } = parseContentFile('content/a.md', chapterFile('content/a.md', 'One', 'one', questions).text)
  expect(errors).toEqual([])
  return file.chapters[0].sections[0].concepts.flatMap((concept) => concept.variants)
}

const SETS = [
  '?? longest Which?',
  '* a long correct option',
  '- short',
  '- a middle one',
  '> Because.',
  '',
  '?? shortest Which?',
  '* ab',
  '- abc',
  '- abcd',
  '> Because.',
  '',
  '?? tie [multi] Which?',
  '* same',
  '* x',
  '- same',
  '> Because.',
  '',
  '?? others [tf] True?',
  '* true',
  '> It is.',
  '',
  '?+ [short] Name it.',
  '= it',
  '> Its name.',
]

test('a set counts only when a correct option is longer or shorter than every wrong one', () => {
  const figures = measureOptions(variantsOf(SETS))
  expect(figures).toMatchObject({ sets: 3, correctLongest: 1, correctShortest: 2, correct: 4, wrong: 5 })
})

test('medians take every option, and an even count averages the middle two', () => {
  const figures = measureOptions(variantsOf(SETS))
  // Correct lengths 21, 2, 4, 1; wrong lengths 5, 12, 3, 4, 4.
  expect(figures.medianCorrect).toBe(3)
  expect(figures.medianWrong).toBe(4)
})

test('the word list matches whole words, in any case', () => {
  const figures = measureOptions(
    variantsOf([
      '?? words Which?',
      '* It Always works',
      '* everything else',
      '- only once',
      '- onlyone',
      '- it cannot',
      "- it can't",
      '> Because.',
    ]),
  )
  expect(figures).toMatchObject({ tellCorrect: 1, tellWrong: 2 })
})

test('the word list gains nothing while wrong options hold its words no more often than correct ones', () => {
  const figures = (tellCorrect: number, correct: number, tellWrong: number, wrong: number): OptionFigures => ({
    sets: 1,
    correctLongest: 0,
    correctShortest: 0,
    correct,
    wrong,
    medianCorrect: 0,
    medianWrong: 0,
    tellCorrect,
    tellWrong,
  })
  expect(tellGainsNothing(figures(1, 10, 1, 40))).toBe(true)
  expect(tellGainsNothing(figures(0, 10, 1, 40))).toBe(false)
  expect(tellGainsNothing(figures(0, 0, 0, 0))).toBe(true)
})

test('figures are kept per chapter file and for the whole book, and read the way the log records them', () => {
  const first = chapterFile('content/b/01.md', 'One', 'one', SETS.slice(0, 12))
  const second = chapterFile('content/b/02.md', 'Two', 'two', SETS.slice(12))
  const { books, errors } = assembleBooks([first, second])
  expect(errors).toEqual([])
  const [book] = optionFigures(books)
  expect(book.files.map(({ file, figures }) => [file, figures.sets])).toEqual([
    ['content/b/01.md', 2],
    ['content/b/02.md', 1],
  ])
  expect(book.total.sets).toBe(3)
  expect(describeFigures(book.total)).toBe(
    '3 choice sets; correct option longest in 33%, shortest in 67%; median length 3 correct, 4 wrong; word list in 0.0% of 4 correct, 0.0% of 5 wrong (gains nothing)',
  )
})
