import type { RawBook } from './load.ts'
import type { RawVariant } from './parse.ts'

/**
 * Words a reader can use to rule an option out without knowing the answer. The distractor standard asks
 * that rejecting every option holding one gains nothing.
 */
export const TELL_WORDS = ['always', 'never', 'every', 'automatically', 'only', 'guarantees', 'cannot', 'forbids']

const TELL = new RegExp(`\\b(?:${TELL_WORDS.join('|')})\\b`, 'i')

/**
 * Figures for the options of choice questions (`mc` and `multi`), over every option a variant lists
 * rather than the sample the site shows. An option's length is the length of its Markdown source.
 */
export interface OptionFigures {
  /** Choice variants. */
  sets: number
  /** Sets whose longest option is correct and longer than every wrong one. */
  correctLongest: number
  /** Sets whose shortest option is correct and shorter than every wrong one. */
  correctShortest: number
  correct: number
  wrong: number
  medianCorrect: number
  medianWrong: number
  /** Options holding one of `TELL_WORDS`. */
  tellCorrect: number
  tellWrong: number
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function measureOptions(variants: RawVariant[]): OptionFigures {
  const correct: string[] = []
  const wrong: string[] = []
  let sets = 0
  let correctLongest = 0
  let correctShortest = 0
  for (const variant of variants) {
    if (variant.type !== 'mc' && variant.type !== 'multi') continue
    const right = variant.correct.map((option) => option.md.length)
    const other = variant.wrong.map((option) => option.md.length)
    sets++
    if (other.length > 0 && Math.max(...right) > Math.max(...other)) correctLongest++
    if (other.length > 0 && Math.min(...right) < Math.min(...other)) correctShortest++
    correct.push(...variant.correct.map((option) => option.md))
    wrong.push(...variant.wrong.map((option) => option.md))
  }
  return {
    sets,
    correctLongest,
    correctShortest,
    correct: correct.length,
    wrong: wrong.length,
    medianCorrect: median(correct.map((text) => text.length)),
    medianWrong: median(wrong.map((text) => text.length)),
    tellCorrect: correct.filter((text) => TELL.test(text)).length,
    tellWrong: wrong.filter((text) => TELL.test(text)).length,
  }
}

/** True when rejecting every option that holds a tell word would discard wrong options no more often than correct ones. */
export function tellGainsNothing(figures: OptionFigures): boolean {
  const rate = (hits: number, of: number) => (of === 0 ? 0 : hits / of)
  return rate(figures.tellWrong, figures.wrong) <= rate(figures.tellCorrect, figures.correct)
}

export interface BookFigures {
  book: string
  /** One entry per chapter file, in the order the site shows them. */
  files: { file: string; figures: OptionFigures }[]
  total: OptionFigures
}

export function optionFigures(books: RawBook[]): BookFigures[] {
  return books.map((book) => {
    const byFile = new Map<string, RawVariant[]>()
    for (const chapter of book.chapters) {
      const variants = chapter.sections.flatMap((section) => section.concepts.flatMap((concept) => concept.variants))
      byFile.set(chapter.file, [...(byFile.get(chapter.file) ?? []), ...variants])
    }
    return {
      book: book.id,
      files: [...byFile].map(([file, variants]) => ({ file, figures: measureOptions(variants) })),
      total: measureOptions([...byFile.values()].flat()),
    }
  })
}

const percent = (part: number, whole: number, digits = 0) => `${whole === 0 ? (0).toFixed(digits) : ((100 * part) / whole).toFixed(digits)}%`

/** One line of figures, in the terms the phase log records them. */
export function describeFigures(figures: OptionFigures): string {
  const f = figures
  return [
    `${f.sets} choice ${f.sets === 1 ? 'set' : 'sets'}`,
    `correct option longest in ${percent(f.correctLongest, f.sets)}, shortest in ${percent(f.correctShortest, f.sets)}`,
    `median length ${f.medianCorrect} correct, ${f.medianWrong} wrong`,
    `word list in ${percent(f.tellCorrect, f.correct, 1)} of ${f.correct} correct, ${percent(f.tellWrong, f.wrong, 1)} of ${f.wrong} wrong (${tellGainsNothing(f) ? 'gains nothing' : 'GAINS'})`,
  ].join('; ')
}
