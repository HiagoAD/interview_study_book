import { describe, expect, test } from 'vitest'
import { concept, conceptRecord, deepFreeze } from '../test-helpers'
import { addDays } from './dates'
import type { Box, ConceptRecord, HistoryEntry } from './records'
import { BOX_INTERVAL_DAYS, applyAnswer, isDue, pickVariant } from './scheduling'
import type { Answer } from './scheduling'

const NOW = '2026-09-19T10:00:00.000Z'
const TODAY = '2026-09-19'

function answer(record: ConceptRecord | undefined, ok: boolean, over: Partial<Answer> = {}): ConceptRecord {
  return applyAnswer(record, { bookId: 'b', conceptId: 'c', v: 0, ok, mode: 'study', now: NOW, today: TODAY, ...over })
}

function inBox(box: Box | null, due: string | null): ConceptRecord {
  return conceptRecord('b', 'c', { box, due })
}

describe('BOX_INTERVAL_DAYS', () => {
  test('boxes 1 to 5 are due after 1, 3, 7, 14 and 30 days', () => {
    expect(BOX_INTERVAL_DAYS).toEqual({ 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 })
  })
})

describe('isDue', () => {
  test('a concept in a box is due on its due date and after it, not before', () => {
    expect(isDue(inBox(2, '2026-09-18'), TODAY)).toBe(true)
    expect(isDue(inBox(2, '2026-09-19'), TODAY)).toBe(true)
    expect(isDue(inBox(2, '2026-09-20'), TODAY)).toBe(false)
    expect(isDue(inBox(2, '2026-01-01'), TODAY)).toBe(true)
  })

  test('a concept not in the queue is never due', () => {
    expect(isDue(inBox(null, null), TODAY)).toBe(false)
    expect(isDue(undefined, TODAY)).toBe(false)
    expect(isDue(inBox(3, null), TODAY)).toBe(false)
  })

  test('compares whole dates, not just the day of the month', () => {
    expect(isDue(inBox(1, '2026-10-01'), '2026-09-30')).toBe(false)
    expect(isDue(inBox(1, '2026-09-30'), '2026-10-01')).toBe(true)
  })
})

describe('applyAnswer: history and variants (rule 1)', () => {
  test('starts a record for a concept that has none, and appends the answer to its history', () => {
    const record = answer(undefined, true, { bookId: 'book', conceptId: 'lru', v: 2, mode: 'review' })
    expect(record).toMatchObject({ key: 'book/lru', bookId: 'book', conceptId: 'lru' })
    expect(record.history).toEqual([{ at: NOW, v: 2, ok: true, mode: 'review' }])
  })

  test('appends to an existing history, in order, keeping earlier entries', () => {
    const first = answer(undefined, false, { now: '2026-09-01T08:00:00.000Z', v: 0 })
    const second = answer(first, true, { now: '2026-09-02T08:00:00.000Z', v: 1, mode: 'review' })
    expect(second.history).toEqual<HistoryEntry[]>([
      { at: '2026-09-01T08:00:00.000Z', v: 0, ok: false, mode: 'study' },
      { at: '2026-09-02T08:00:00.000Z', v: 1, ok: true, mode: 'review' },
    ])
  })

  test('records when the variant was shown and whether it was right, and leaves other variants alone', () => {
    const first = answer(undefined, false, { now: '2026-09-01T08:00:00.000Z', v: 0 })
    const second = answer(first, true, { now: '2026-09-02T08:00:00.000Z', v: 2 })
    expect(second.variants).toEqual({
      0: { lastShownAt: '2026-09-01T08:00:00.000Z', lastOk: false },
      2: { lastShownAt: '2026-09-02T08:00:00.000Z', lastOk: true },
    })
    const third = answer(second, true, { now: '2026-09-03T08:00:00.000Z', v: 0 })
    expect(third.variants[0]).toEqual({ lastShownAt: '2026-09-03T08:00:00.000Z', lastOk: true })
    expect(third.variants[2]).toEqual(second.variants[2])
  })

  test('study and review are the same rule: the mode is only recorded', () => {
    for (const setup of [inBox(null, null), inBox(2, '2026-09-19'), inBox(3, '2026-10-05')]) {
      for (const ok of [true, false]) {
        const study = answer(setup, ok, { mode: 'study' })
        const review = answer(setup, ok, { mode: 'review' })
        expect({ box: review.box, due: review.due }).toEqual({ box: study.box, due: study.due })
        expect(study.history.at(-1)?.mode).toBe('study')
        expect(review.history.at(-1)?.mode).toBe('review')
      }
    }
  })

  test('returns a new record and leaves the one it was given untouched', () => {
    const before = deepFreeze(inBox(2, '2026-09-19'))
    const after = answer(before, true)
    expect(after).not.toBe(before)
    expect(before.box).toBe(2)
    expect(before.history).toEqual([])
  })
})

describe('applyAnswer: a wrong answer (rule 2)', () => {
  test('puts a concept with no record in box 1, due tomorrow', () => {
    expect(answer(undefined, false)).toMatchObject({ box: 1, due: '2026-09-20' })
  })

  test('sends a concept back to box 1, due tomorrow, from any box', () => {
    for (const box of [1, 2, 3, 4, 5] as const) {
      expect(answer(inBox(box, '2026-09-19'), false)).toMatchObject({ box: 1, due: '2026-09-20' })
    }
  })

  test('does the same when the concept was not due yet, moving its due date earlier', () => {
    expect(answer(inBox(4, '2026-10-30'), false)).toMatchObject({ box: 1, due: '2026-09-20' })
  })

  test('puts a graduated concept back in the queue', () => {
    expect(answer(inBox(null, null), false)).toMatchObject({ box: 1, due: '2026-09-20' })
  })

  test('counts days from today, however overdue the concept was', () => {
    expect(answer(inBox(3, '2026-06-01'), false)).toMatchObject({ box: 1, due: '2026-09-20' })
  })
})

describe('applyAnswer: a right answer on a due concept (rule 3)', () => {
  test.each([
    [1, 2, 3],
    [2, 3, 7],
    [3, 4, 14],
    [4, 5, 30],
  ] as const)('moves box %i up to box %i, due in %i days', (from, to, days) => {
    const record = answer(inBox(from, '2026-09-19'), true)
    expect(record).toMatchObject({ box: to, due: addDays(TODAY, days) })
  })

  test('counts the new interval from today, not from the old due date', () => {
    expect(answer(inBox(1, '2026-09-19'), true).due).toBe('2026-09-22')
    expect(answer(inBox(1, '2026-08-01'), true).due).toBe('2026-09-22')
    expect(answer(inBox(3, '2026-07-01'), true)).toMatchObject({ box: 4, due: '2026-10-03' })
  })

  test('moves an overdue concept up exactly one box', () => {
    expect(answer(inBox(2, '2026-01-01'), true).box).toBe(3)
  })

  test('takes a concept out of the queue after box 5', () => {
    const record = answer(inBox(5, '2026-09-19'), true)
    expect(record.box).toBeNull()
    expect(record.due).toBeNull()
    expect(record.history).toHaveLength(1)
  })

  test('an overdue concept in box 5 leaves the queue too', () => {
    expect(answer(inBox(5, '2026-01-01'), true)).toMatchObject({ box: null, due: null })
  })

  test('after leaving the queue, a right answer keeps it out and a wrong one brings it back', () => {
    const graduated = answer(inBox(5, '2026-09-19'), true)
    expect(answer(graduated, true)).toMatchObject({ box: null, due: null })
    expect(answer(graduated, false)).toMatchObject({ box: 1, due: '2026-09-20' })
  })

  test('walks a concept through every box on its due dates and out of the queue', () => {
    let record = answer(undefined, false, { today: '2026-01-01' })
    const path: [Box | null, string | null][] = []
    for (let step = 0; step < 5; step++) {
      record = answer(record, true, { today: record.due! })
      path.push([record.box, record.due])
    }
    expect(path).toEqual([
      [2, '2026-01-05'],
      [3, '2026-01-12'],
      [4, '2026-01-26'],
      [5, '2026-02-25'],
      [null, null],
    ])
  })
})

describe('applyAnswer: every other right answer (rule 4)', () => {
  test('a first correct answer never enters the queue', () => {
    const record = answer(undefined, true)
    expect(record.box).toBeNull()
    expect(record.due).toBeNull()
    expect(record.history).toHaveLength(1)
  })

  test('a correct answer before the due date leaves box and due as they were', () => {
    for (const box of [1, 2, 3, 4, 5] as const) {
      const record = answer(inBox(box, '2026-09-20'), true)
      expect(record).toMatchObject({ box, due: '2026-09-20' })
      expect(record.history).toHaveLength(1)
    }
    expect(answer(inBox(2, '2026-12-25'), true)).toMatchObject({ box: 2, due: '2026-12-25' })
  })

  test('practising box 5 early does not take the concept out of the queue', () => {
    expect(answer(inBox(5, '2026-10-19'), true)).toMatchObject({ box: 5, due: '2026-10-19' })
  })

  test('a concept out of the queue stays out', () => {
    expect(answer(inBox(null, null), true)).toMatchObject({ box: null, due: null })
  })
})

describe('applyAnswer: now and today are separate', () => {
  test('due dates come from today, timestamps from now', () => {
    const simulated = answer(undefined, false, { now: '2026-09-19T23:30:00.000Z', today: '2026-12-25' })
    expect(simulated.due).toBe('2026-12-26')
    expect(simulated.history[0].at).toBe('2026-09-19T23:30:00.000Z')
    expect(simulated.variants[0].lastShownAt).toBe('2026-09-19T23:30:00.000Z')
  })

  test('whether a concept is due depends on today, not on now', () => {
    const scheduled = inBox(2, '2026-12-25')
    const early = answer(scheduled, true, { now: '2027-06-01T00:00:00.000Z', today: '2026-12-24' })
    expect(early).toMatchObject({ box: 2, due: '2026-12-25' })
    const onTime = answer(scheduled, true, { now: '2026-01-01T00:00:00.000Z', today: '2026-12-25' })
    expect(onTime).toMatchObject({ box: 3, due: '2027-01-01' })
  })
})

describe('pickVariant', () => {
  const at = (n: number) => `2026-09-0${n}T10:00:00.000Z`

  /** A record with these variants shown at these times, and this history ending with these answers. */
  function shownAt(times: Record<number, string>, ...history: [v: number, ok: boolean][]): ConceptRecord {
    return conceptRecord('b', 'c', {
      variants: Object.fromEntries(Object.entries(times).map(([v, lastShownAt]) => [v, { lastShownAt, lastOk: true }])),
      history: history.map(([v, ok]) => ({ at: at(9), v, ok, mode: 'study' as const })),
    })
  }

  test('a concept with one variant shows variant 0 every time, even after a wrong answer', () => {
    const one = concept('c', 1)
    expect(pickVariant(one, undefined)).toBe(0)
    expect(pickVariant(one, shownAt({ 0: at(1) }, [0, true]))).toBe(0)
    expect(pickVariant(one, shownAt({ 0: at(1) }, [0, false]))).toBe(0)
  })

  test('with no record, shows variant 0', () => {
    expect(pickVariant(concept('c', 3), undefined)).toBe(0)
    expect(pickVariant(concept('c', 3), conceptRecord('b', 'c'))).toBe(0)
  })

  test('shows the lowest-index variant that was never shown', () => {
    const three = concept('c', 3)
    expect(pickVariant(three, shownAt({ 0: at(1) }, [0, true]))).toBe(1)
    expect(pickVariant(three, shownAt({ 0: at(1), 2: at(2) }, [2, true]))).toBe(1)
    expect(pickVariant(three, shownAt({ 1: at(1) }, [1, true]))).toBe(0)
    expect(pickVariant(three, shownAt({ 1: at(1), 2: at(2) }, [2, true]))).toBe(0)
  })

  test('a never-shown variant comes before an older shown one', () => {
    expect(pickVariant(concept('c', 3), shownAt({ 0: at(1), 1: at(5) }, [1, true]))).toBe(2)
  })

  test('once every variant has been shown, picks the one shown longest ago', () => {
    const three = concept('c', 3)
    expect(pickVariant(three, shownAt({ 0: at(3), 1: at(1), 2: at(2) }, [0, true]))).toBe(1)
    expect(pickVariant(three, shownAt({ 0: at(3), 1: at(2), 2: at(1) }, [0, true]))).toBe(2)
    expect(pickVariant(three, shownAt({ 0: at(1), 1: at(2), 2: at(3) }, [2, true]))).toBe(0)
  })

  test('compares whole timestamps, not just the day of the month', () => {
    const times = { 0: '2026-09-19T10:00:00.000Z', 1: '2026-10-01T10:00:00.000Z' }
    expect(pickVariant(concept('c', 2), shownAt(times, [1, true]))).toBe(0)
  })

  test('leaves out the variant just answered wrong, even when it was shown longest ago', () => {
    // A clock that went backwards can leave the variant just answered as the oldest.
    const three = concept('c', 3)
    expect(pickVariant(three, shownAt({ 0: at(1), 1: at(2), 2: at(3) }, [0, false]))).toBe(1)
    expect(pickVariant(concept('c', 2), shownAt({ 0: at(1), 1: at(2) }, [0, false]))).toBe(1)
  })

  test('only leaves out a variant that was answered wrong, and only the last answer counts', () => {
    const three = concept('c', 3)
    const times = { 0: at(1), 1: at(2), 2: at(3) }
    expect(pickVariant(three, shownAt(times, [0, true]))).toBe(0)
    expect(pickVariant(three, shownAt(times, [0, false], [0, true]))).toBe(0)
    expect(pickVariant(three, shownAt(times, [0, true], [2, false]))).toBe(0)
  })

  test('a tie in time goes to the lowest index', () => {
    const three = concept('c', 3)
    expect(pickVariant(three, shownAt({ 0: at(1), 1: at(1), 2: at(1) }, [2, true]))).toBe(0)
    expect(pickVariant(three, shownAt({ 0: at(2), 1: at(1), 2: at(1) }, [0, true]))).toBe(1)
    expect(pickVariant(three, shownAt({ 0: at(1), 1: at(1), 2: at(1) }, [0, false]))).toBe(1)
  })

  test('ignores stored indices at or past the current variant count', () => {
    const three = concept('c', 3)
    // Variant 5 no longer exists, so its old time must not win, and it must not stand in for a missing one.
    expect(pickVariant(three, shownAt({ 0: at(3), 1: at(2), 2: at(4), 5: at(1) }, [2, true]))).toBe(1)
    expect(pickVariant(concept('c', 2), shownAt({ 3: at(1), 4: at(2) }, [3, true]))).toBe(0)
    expect(pickVariant(concept('c', 3), shownAt({ 0: at(1), 1: at(2), 3: at(3) }, [3, true]))).toBe(2)
  })

  test('ignores a last wrong answer on a variant that no longer exists', () => {
    // Variant 3 is gone. A modulo would turn it into variant 0 and skip the right pick.
    const three = concept('c', 3)
    expect(pickVariant(three, shownAt({ 0: at(1), 1: at(2), 2: at(3) }, [3, false]))).toBe(0)
    expect(pickVariant(three, shownAt({ 0: at(1), 1: at(2), 2: at(3) }, [4, false]))).toBe(0)
  })

  test('shows a variant added since the last answer', () => {
    expect(pickVariant(concept('c', 3), shownAt({ 0: at(2), 1: at(1) }, [0, true]))).toBe(2)
  })

  test('shows variant 0 for a concept that shrank to one variant, whatever is stored', () => {
    expect(pickVariant(concept('c', 1), shownAt({ 0: at(3), 1: at(1), 2: at(2) }, [2, false]))).toBe(0)
  })
})
