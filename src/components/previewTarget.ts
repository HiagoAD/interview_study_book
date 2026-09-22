import type { Book, Chapter, GlossaryEntry, Section } from '../types/content'
import { parseRoute } from '../router'

/** What a preview card shows: a term with its summary, or a section with its opening paragraph. */
export type PreviewTarget =
  | { kind: 'term'; book: Book; entry: GlossaryEntry }
  | { kind: 'section'; book: Book; chapter: Chapter; index: number; section: Section }

/**
 * What the link at `href` would preview, or null when it previews nothing. The link carries its route in
 * its href, so nothing has to be repeated into data attributes for this to read it back.
 */
export function previewTarget(href: string | null, books: readonly Book[]): PreviewTarget | null {
  if (href === null) return null
  const route = parseRoute(href)

  if (route.name === 'term') {
    const book = books.find((candidate) => candidate.id === route.book)
    const entry = book?.glossary.find((candidate) => candidate.id === route.term)
    return book && entry ? { kind: 'term', book, entry } : null
  }

  if (route.name === 'section') {
    const book = books.find((candidate) => candidate.id === route.book)
    const chapter = book?.chapters.find((candidate) => candidate.id === route.chapter)
    const index = chapter?.sections.findIndex((candidate) => candidate.id === route.section) ?? -1
    return book && chapter && index >= 0 ? { kind: 'section', book, chapter, index, section: chapter.sections[index] } : null
  }

  return null
}

/**
 * The inside of a section's opening paragraph, or "" when it does not start with one. The HTML comes from
 * the pipeline and a `<p>` never nests, so the first closing tag ends it and no parser is needed.
 */
export function sectionLead(html: string): string {
  return /^\s*<p>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? ''
}
