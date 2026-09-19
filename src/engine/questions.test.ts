import { describe, expect, test } from 'vitest'
import { answeredRecord, choice, concept, conceptRecord, deepFreeze, seededRng, short, trueFalse } from '../test-helpers'
import type { Concept } from '../types/content'
import { prepareQuestion, prepareQuestions } from './questions'
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
