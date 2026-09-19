import type { Concept, Variant } from '../types/content'
import { conceptKey } from './records'
import type { ConceptRecord } from './records'
import { sampleOptions } from './sampling'
import type { Rng, ShownOption } from './sampling'
import { pickVariant } from './scheduling'

/**
 * A question ready to show: the variant picked for a concept and, for `mc` and `multi`, the options sampled
 * from its pool. It is plain data, made once. Answering changes the concept's record, and picking again from
 * the new record would choose another variant, so whoever shows a question keeps this object and never
 * prepares it a second time.
 */
export interface PreparedQuestion {
  conceptId: string
  /** The variant's index in `concept.variants`, which is what history stores. */
  v: number
  variant: Variant
  /** The options as shown, in order. Empty for `tf` and `short`. */
  options: readonly ShownOption[]
}

export function prepareQuestion(concept: Concept, record: ConceptRecord | undefined, rng: Rng): PreparedQuestion {
  const v = pickVariant(concept, record)
  const variant = concept.variants[v]
  const options = variant.type === 'mc' || variant.type === 'multi' ? sampleOptions(variant, rng) : []
  return { conceptId: concept.id, v, variant, options }
}

/** One question per concept, in the order given: file order for a section. */
export function prepareQuestions(
  bookId: string,
  concepts: readonly Concept[],
  records: ReadonlyMap<string, ConceptRecord>,
  rng: Rng,
): PreparedQuestion[] {
  return concepts.map((concept) => prepareQuestion(concept, records.get(conceptKey(bookId, concept.id)), rng))
}
