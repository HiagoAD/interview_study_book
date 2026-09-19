import type { Variant } from '../types/content'

/** Returns a number in [0, 1), like `Math.random`. The caller supplies it. */
export type Rng = () => number

/** An option as shown: its HTML and whether it is one of the correct ones. */
export interface ShownOption {
  html: string
  correct: boolean
}

export type ChoiceVariant = Extract<Variant, { type: 'mc' | 'multi' }>

/** A shuffled copy (Fisher-Yates). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** `count` distinct items in random order, or all of them when there are fewer. */
export function sample<T>(items: readonly T[], count: number, rng: Rng): T[] {
  return shuffle(items, rng).slice(0, Math.max(count, 0))
}

/**
 * The options to show for a `mc` or `multi` variant, in shuffled order.
 * - `mc`: one random correct option and min(n - 1, wrong.length) random wrong ones.
 * - `multi`: every correct option and min(max(n - correct.length, 0), wrong.length) random wrong ones.
 */
export function sampleOptions(variant: ChoiceVariant, rng: Rng): ShownOption[] {
  const { correct, wrong, n } = variant
  const shownCorrect = variant.type === 'mc' ? sample(correct, 1, rng) : correct
  const wrongCount = Math.min(variant.type === 'mc' ? n - 1 : Math.max(n - correct.length, 0), wrong.length)
  const options: ShownOption[] = [
    ...shownCorrect.map((html) => ({ html, correct: true })),
    ...sample(wrong, wrongCount, rng).map((html) => ({ html, correct: false })),
  ]
  return shuffle(options, rng)
}
