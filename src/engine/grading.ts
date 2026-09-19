import type { ShownOption } from './sampling'

/** NFKC, then lowercase, then no whitespace at all. */
export function normalizeShort(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/gu, '')
}

/** Correct when the normalized input equals any normalized accepted answer. */
export function gradeShort(accepted: readonly string[], input: string): boolean {
  const answer = normalizeShort(input)
  return accepted.some((candidate) => normalizeShort(candidate) === answer)
}

export function gradeTrueFalse(answer: boolean, chosen: boolean): boolean {
  return chosen === answer
}

/**
 * Correct only when the chosen options are exactly the correct ones. `chosen` holds indices into `shown`.
 * That makes `mc` (one correct option, one choice) and `multi` the same rule.
 */
export function gradeChoice(shown: readonly ShownOption[], chosen: readonly number[]): boolean {
  const picked = new Set(chosen)
  const correct = shown.flatMap((option, i) => (option.correct ? [i] : []))
  return picked.size === correct.length && correct.every((i) => picked.has(i))
}
