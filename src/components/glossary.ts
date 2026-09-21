import type { Book, Chapter, GlossaryEntry, Section } from '../types/content'
import { isSectionUnlocked } from '../engine/sections'
import type { ProgressRecords } from '../engine/records'

/** Lowercase, with runs of spaces and hyphens flattened, so "Object Pool" and "object-pool" compare equal. */
export function normalizeTerm(text: string): string {
  return text.toLowerCase().replace(/[\s-]+/g, ' ').trim()
}

/** A term matches when its own name, or any of the other names it goes by, contains the query. */
export function matchesTerm(entry: GlossaryEntry, query: string): boolean {
  const needle = normalizeTerm(query)
  return needle === '' || [entry.term, ...entry.names].some((name) => normalizeTerm(name).includes(needle))
}

export interface Appearance {
  chapter: Chapter
  section: Section
  /** The section before this one, named by the locked notice. Null for the first section of a chapter. */
  previous: Section | null
  unlocked: boolean
}

/**
 * The sections that link to `entry`, resolved against the book and the reader's progress. A section the
 * entry names but the book no longer has is left out, which happens when content changes under a stale
 * build rather than through any fault of the reader.
 */
export function appearances(book: Book, entry: GlossaryEntry, records: ProgressRecords): Appearance[] {
  const found: Appearance[] = []
  for (const use of entry.uses) {
    const chapter = book.chapters.find((candidate) => candidate.id === use.chapter)
    const index = chapter?.sections.findIndex((candidate) => candidate.id === use.section) ?? -1
    if (!chapter || index < 0) continue
    found.push({
      chapter,
      section: chapter.sections[index],
      previous: index > 0 ? chapter.sections[index - 1] : null,
      unlocked: isSectionUnlocked(book.id, chapter, index, records),
    })
  }
  return found
}
