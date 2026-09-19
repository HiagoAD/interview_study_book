import { conceptKey, sectionKey } from './records'
import type { ConceptRecord, ProgressRecords } from './records'

/** The part of a section the rules need. */
export interface SectionRef {
  id: string
  concepts: readonly { id: string }[]
}

export interface ChapterRef {
  sections: readonly SectionRef[]
}

/** True when every concept of the section has at least one answer in its history. */
export function allConceptsAnswered(
  bookId: string,
  section: SectionRef,
  concepts: ReadonlyMap<string, ConceptRecord>,
): boolean {
  return section.concepts.every((concept) => (concepts.get(conceptKey(bookId, concept.id))?.history.length ?? 0) > 0)
}

/**
 * A section is complete once `completedAt` is set, or when every one of its concepts has been answered.
 * `completedAt` sticks: adding a concept to a completed section later doesn't make it incomplete.
 */
export function isSectionComplete(bookId: string, section: SectionRef, records: ProgressRecords): boolean {
  return (
    records.sections.get(sectionKey(bookId, section.id))?.completedAt != null ||
    allConceptsAnswered(bookId, section, records.concepts)
  )
}

/**
 * The section at `index` in its chapter is unlocked when it is the first one, has been read, or the section
 * before it is complete. Chapters are independent of each other.
 */
export function isSectionUnlocked(
  bookId: string,
  chapter: ChapterRef,
  index: number,
  records: ProgressRecords,
): boolean {
  const section = chapter.sections[index]
  if (index === 0 || records.sections.get(sectionKey(bookId, section.id))?.readAt != null) return true
  return isSectionComplete(bookId, chapter.sections[index - 1], records)
}
