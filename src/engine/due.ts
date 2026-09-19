import type { Book, Chapter, Concept, Section } from '../types/content'
import { compareDates } from './dates'
import { conceptKey } from './records'
import type { ConceptRecord, ProgressRecords } from './records'
import { isDue } from './scheduling'

export interface DueConcept {
  book: Book
  chapter: Chapter
  section: Section
  concept: Concept
  record: ConceptRecord
}

/**
 * The concepts due on `today` across all books, earliest due date first. Ties keep content order: books as
 * given, then chapters, sections and concepts in file order. Records of concepts that are no longer in the
 * content are never listed.
 */
export function dueConcepts(books: readonly Book[], records: ProgressRecords, today: string): DueConcept[] {
  const due: { item: DueConcept; date: string }[] = []
  for (const book of books) {
    for (const chapter of book.chapters) {
      for (const section of chapter.sections) {
        for (const concept of section.concepts) {
          const record = records.concepts.get(conceptKey(book.id, concept.id))
          if (record?.due != null && isDue(record, today)) {
            due.push({ item: { book, chapter, section, concept, record }, date: record.due })
          }
        }
      }
    }
  }
  // Array.prototype.sort is stable, so equal dates stay in the order they were collected.
  return due.sort((a, b) => compareDates(a.date, b.date)).map(({ item }) => item)
}
