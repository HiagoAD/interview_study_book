import type { Book, Chapter, Concept, Section, Variant } from '../types/content'
import { dueConcepts } from './due'
import { conceptKey } from './records'
import type { ConceptRecord, ProgressRecords } from './records'
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

/** A question in a review, with where its concept lives, for the breadcrumb that links back to the section. */
export interface ReviewItem {
  book: Book
  chapter: Chapter
  section: Section
  question: PreparedQuestion
}

/**
 * The whole review, made once when it starts: a question for every concept due on `today`, in the order of the
 * due list. The list is a copy of that moment. Answering moves concepts out of the due list, so a page that
 * walked the live list would skip questions as it went; walk this one.
 */
export function prepareReview(
  books: readonly Book[],
  records: ProgressRecords,
  today: string,
  rng: Rng,
): ReviewItem[] {
  return dueConcepts(books, records, today).map(({ book, chapter, section, concept, record }) => ({
    book,
    chapter,
    section,
    question: prepareQuestion(concept, record, rng),
  }))
}
