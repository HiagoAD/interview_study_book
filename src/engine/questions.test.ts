import { describe, expect, test } from 'vitest'
import {
  answeredRecord,
  book,
  chapter,
  choice,
  concept,
  conceptRecord,
  deepFreeze,
  records,
  section,
  seededRng,
  short,
  trueFalse,
} from '../test-helpers'
import type { Concept } from '../types/content'
import { dueConcepts } from './due'
import { prepareQuestion, prepareQuestions, prepareReview } from './questions'
import type { Box, ConceptRecord } from './records'
import { applyAnswer } from './scheduling'

const B = 'book'
const NOW = '2026-09-19T10:00:00.000Z'
const TODAY = '2026-09-19'

const mc = choice('mc', ['right 1', 'right 2'], ['wrong 1', 'wrong 2', 'wrong 3', 'wrong 4'])
const multi = choice('multi', ['right 1', 'right 2'], ['wrong 1', 'wrong 2', 'wrong 3'], 5)
const twoVariants: Concept = { id: 'two', variants: [mc, trueFalse(true)] }

describe('prepareQuestion', () => {
  test('shows the variant pickVariant chooses: the first one never shown', () => {
    expect(prepareQuestion(twoVariants, undefined, seededRng(1)).v).toBe(0)
    expect(prepareQuestion(twoVariants, answeredRecord(B, 'two'), seededRng(1)).v).toBe(1)
  })

  test('carries the concept id, the variant and its index', () => {
    const question = prepareQuestion(twoVariants, answeredRecord(B, 'two'), seededRng(1))
    expect(question.conceptId).toBe('two')
    expect(question.variant).toBe(twoVariants.variants[1])
  })

  test('samples the options of a multiple choice variant: one correct and n - 1 wrong', () => {
    const { options } = prepareQuestion({ id: 'c', variants: [mc] }, undefined, seededRng(2))
    expect(options).toHaveLength(4)
    expect(options.filter((option) => option.correct)).toHaveLength(1)
  })

  test('shows every correct option of a multiple select variant', () => {
    const { options } = prepareQuestion({ id: 'c', variants: [multi] }, undefined, seededRng(3))
    expect(options).toHaveLength(5)
    expect(options.filter((option) => option.correct).map((option) => option.html).sort()).toEqual(['right 1', 'right 2'])
  })

  test('has no options for true/false and short answer variants', () => {
    expect(prepareQuestion({ id: 'c', variants: [trueFalse(false)] }, undefined, seededRng(1)).options).toEqual([])
    expect(prepareQuestion({ id: 'c', variants: [short(['x'])] }, undefined, seededRng(1)).options).toEqual([])
  })

  test('a concept with one variant shows it again with a fresh sample', () => {
    const one: Concept = { id: 'one', variants: [mc] }
    const record = answeredRecord(B, 'one')
    const orders = new Set<string>()
    for (let seed = 1; seed <= 20; seed++) {
      const question = prepareQuestion(one, record, seededRng(seed))
      expect(question.v).toBe(0)
      orders.add(question.options.map((option) => option.html).join('|'))
    }
    expect(orders.size).toBeGreaterThan(1)
  })

  test('takes the randomness from the rng it is given', () => {
    const a = prepareQuestion({ id: 'c', variants: [mc] }, undefined, seededRng(7))
    const b = prepareQuestion({ id: 'c', variants: [mc] }, undefined, seededRng(7))
    expect(a).toEqual(b)
  })

  test('is a snapshot: a later answer changes the next pick but not the question already made', () => {
    const question = prepareQuestion(twoVariants, undefined, seededRng(4))
    const after = applyAnswer(undefined, { bookId: B, conceptId: 'two', v: question.v, ok: false, mode: 'study', now: NOW, today: TODAY })

    expect(question.v).toBe(0)
    expect(prepareQuestion(twoVariants, after, seededRng(4)).v).toBe(1)
    expect(question.v).toBe(0)
  })

  test('does not change what it is given', () => {
    const frozen = deepFreeze({ ...twoVariants })
    expect(() => prepareQuestion(frozen, deepFreeze(answeredRecord(B, 'two')), seededRng(1))).not.toThrow()
  })
})

describe('prepareQuestions', () => {
  const concepts = [concept('a'), concept('b'), concept('c')]

  test('makes one question per concept, in the order of the concepts', () => {
    const questions = prepareQuestions(B, concepts, new Map(), seededRng(1))
    expect(questions.map((question) => question.conceptId)).toEqual(['a', 'b', 'c'])
  })

  test("reads each concept's own record, under the book's key", () => {
    const withTwo = [{ id: 'a', variants: [mc, trueFalse(true)] }, { id: 'b', variants: [mc, trueFalse(true)] }]
    const records = new Map([
      [`${B}/a`, answeredRecord(B, 'a')],
      [`other/b`, answeredRecord('other', 'b')],
    ])
    expect(prepareQuestions(B, withTwo, records, seededRng(1)).map((question) => question.v)).toEqual([1, 0])
  })

  test('makes nothing for a section with no concepts', () => {
    expect(prepareQuestions(B, [], new Map(), seededRng(1))).toEqual([])
  })

  test('a record with a stale variant index is handled by pickVariant', () => {
    const stale = new Map([[`${B}/a`, conceptRecord(B, 'a', { variants: { 5: { lastShownAt: NOW, lastOk: true } } })]])
    expect(prepareQuestions(B, [{ id: 'a', variants: [mc, trueFalse(true)] }], stale, seededRng(1))[0].v).toBe(0)
  })
})

describe('prepareReview', () => {
  function queued(bookId: string, conceptId: string, due: string, box: Box = 1): ConceptRecord {
    return conceptRecord(bookId, conceptId, { box, due })
  }

  function ids(items: ReturnType<typeof prepareReview>): string[] {
    return items.map((item) => `${item.book.id}/${item.question.conceptId}`)
  }

  const books = [
    book('alpha', [chapter('ch1', [section('s1', ['a1', 'a2']), section('s2', ['a3'])])]),
    book('beta', [chapter('ch1', [section('s1', ['b1'])])]),
  ]

  test('makes one question per due concept, in the order of the due list', () => {
    const progress = records([
      queued('alpha', 'a3', '2026-09-10'),
      queued('beta', 'b1', '2026-09-05'),
      queued('alpha', 'a1', '2026-09-10'),
      queued('alpha', 'a2', '2026-09-30'), // not due yet
    ])
    const review = prepareReview(books, progress, TODAY, seededRng(1))
    expect(ids(review)).toEqual(['beta/b1', 'alpha/a1', 'alpha/a3'])
    expect(ids(review)).toEqual(dueConcepts(books, progress, TODAY).map((due) => `${due.book.id}/${due.concept.id}`))
  })

  test('says where each concept lives, so the page can link back to its section', () => {
    const [item] = prepareReview(books, records([queued('alpha', 'a3', '2026-09-10')]), TODAY, seededRng(1))
    expect(item.book).toBe(books[0])
    expect(item.chapter).toBe(books[0].chapters[0])
    expect(item.section).toBe(books[0].chapters[0].sections[1])
  })

  test('is empty when nothing is due, and depends on the date it is given', () => {
    const progress = records([queued('alpha', 'a1', '2026-09-20')])
    expect(prepareReview(books, records(), TODAY, seededRng(1))).toEqual([])
    expect(prepareReview(books, progress, TODAY, seededRng(1))).toEqual([])
    expect(ids(prepareReview(books, progress, '2026-09-20', seededRng(1)))).toEqual(['alpha/a1'])
  })

  test("picks each variant from that concept's own record, as a review of one concept would", () => {
    const withTwo = [book('alpha', [chapter('ch1', [{ ...section('s1', []), concepts: [twoVariants, { ...twoVariants, id: 'other' }] }])])]
    const progress = records([
      { ...answeredRecord('alpha', 'two'), box: 1, due: '2026-09-10' }, // variant 0 shown: 1 is next
      queued('alpha', 'other', '2026-09-11'), // nothing shown: 0 is next
    ])
    const review = prepareReview(withTwo, progress, TODAY, seededRng(5))
    expect(review.map((item) => item.question.v)).toEqual([1, 0])
    expect(review[0].question).toEqual(prepareQuestion(twoVariants, progress.concepts.get('alpha/two'), seededRng(5)))
  })

  test('samples the options with the rng it is given', () => {
    const one = [book('alpha', [chapter('ch1', [{ ...section('s1', []), concepts: [{ id: 'c', variants: [mc] }] }])])]
    const progress = records([queued('alpha', 'c', '2026-09-10')])
    const first = prepareReview(one, progress, TODAY, seededRng(9))
    expect(first).toEqual(prepareReview(one, progress, TODAY, seededRng(9)))
    expect(first[0].question.options).toHaveLength(4)
  })

  test('is frozen: answering every concept empties the due list but not the review already made', () => {
    const progress = records([queued('alpha', 'a1', '2026-09-10'), queued('alpha', 'a2', '2026-09-11'), queued('beta', 'b1', '2026-09-12')])
    const review = prepareReview(books, progress, TODAY, seededRng(1))
    expect(review).toHaveLength(3)

    // Answer the first question right and the second wrong, the way a review does.
    const answers = [true, false]
    const after = new Map(progress.concepts)
    review.slice(0, 2).forEach(({ book: b, question }, i) => {
      const key = `${b.id}/${question.conceptId}`
      const record = applyAnswer(after.get(key), {
        bookId: b.id,
        conceptId: question.conceptId,
        v: question.v,
        ok: answers[i],
        mode: 'review',
        now: NOW,
        today: TODAY,
      })
      after.set(key, record)
    })

    // Both leave the due list: the right one moved up a box, the wrong one is due tomorrow.
    const live = dueConcepts(books, { concepts: after, sections: new Map() }, TODAY)
    expect(live.map((due) => due.concept.id)).toEqual(['b1'])
    expect(ids(review)).toEqual(['alpha/a1', 'alpha/a2', 'beta/b1'])
  })

  test('does not change what it is given', () => {
    const progress = deepFreeze(records([queued('alpha', 'a1', '2026-09-10')]))
    expect(() => prepareReview(deepFreeze(books), progress, TODAY, seededRng(1))).not.toThrow()
  })
})
