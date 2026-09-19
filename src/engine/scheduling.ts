import { addDays, compareDates } from './dates'
import { emptyConceptRecord } from './records'
import type { Box, ConceptRecord, Mode } from './records'

/** Days until a concept is due again, by the box it moves into. */
export const BOX_INTERVAL_DAYS: Record<Box, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 }

const NEXT_BOX = { 1: 2, 2: 3, 3: 4, 4: 5 } as const

export interface Answer {
  /** With `conceptId`, names the record to start when there is none yet. */
  bookId: string
  conceptId: string
  v: number
  ok: boolean
  mode: Mode
  /** ISO timestamp, stored in `history` and `lastShownAt`. */
  now: string
  /** The local date every due-date calculation uses. */
  today: string
}

/** The box of a concept that is due on `today`, and null for one that is not due. */
function dueBox(record: ConceptRecord | undefined, today: string): Box | null {
  if (!record || record.box === null || record.due === null) return null
  return compareDates(record.due, today) <= 0 ? record.box : null
}

export function isDue(record: ConceptRecord | undefined, today: string): boolean {
  return dueBox(record, today) !== null
}

/**
 * The record after an answer, in study or review alike. A wrong answer always goes to box 1, due tomorrow.
 * A right answer moves a due concept up one box, or out of the queue after box 5, and changes nothing for
 * any other concept: a first correct answer never enters the queue and practising early doesn't advance it.
 */
export function applyAnswer(record: ConceptRecord | undefined, answer: Answer): ConceptRecord {
  const { v, ok, mode, now, today } = answer
  const before = record ?? emptyConceptRecord(answer.bookId, answer.conceptId)
  const after: ConceptRecord = {
    ...before,
    history: [...before.history, { at: now, v, ok, mode }],
    variants: { ...before.variants, [v]: { lastShownAt: now, lastOk: ok } },
  }

  if (!ok) return { ...after, box: 1, due: addDays(today, BOX_INTERVAL_DAYS[1]) }

  const box = dueBox(before, today)
  if (box === null) return after
  if (box === 5) return { ...after, box: null, due: null }
  const next = NEXT_BOX[box]
  return { ...after, box: next, due: addDays(today, BOX_INTERVAL_DAYS[next]) }
}

/**
 * The index of the variant to show for a concept:
 * 1. the lowest-index variant never shown;
 * 2. otherwise the one shown longest ago, leaving out the variant just answered wrong;
 * 3. a concept with one variant shows variant 0 again.
 * Stored indices at or past the current variant count are ignored. Timestamps are ISO strings in UTC, which
 * sort in time order as text; a tie goes to the lowest index.
 */
export function pickVariant(concept: { variants: readonly unknown[] }, record: ConceptRecord | undefined): number {
  const count = concept.variants.length
  if (count <= 1) return 0

  const shown = record?.variants ?? {}
  for (let i = 0; i < count; i++) {
    if (shown[i] === undefined) return i
  }

  const last = record?.history.at(-1)
  const excluded = last && !last.ok ? last.v : -1
  let oldest = -1
  for (let i = 0; i < count; i++) {
    if (i === excluded) continue
    if (oldest === -1 || shown[i].lastShownAt < shown[oldest].lastShownAt) oldest = i
  }
  return oldest
}
