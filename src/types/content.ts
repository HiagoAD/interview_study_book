// Content model shared by the build-time pipeline and the browser app.
// Rendered text (section html, prompts, options, explanations) is HTML. Ids, titles and `accepted` are
// plain text: escape them when they go into a page.

export interface Book {
  id: string
  title: string
  chapters: Chapter[]
  /** Terms the book uses without defining them, ordered by term. Outside the reading order: nothing tests them. */
  glossary: GlossaryEntry[]
}

export interface GlossaryEntry {
  id: string
  /** Plain text, as written in the heading. */
  term: string
  /** Plain text: the other names the term goes by, which `[[...]]` also resolves. */
  names: string[]
  /** One paragraph of HTML. A preview card shows this whole, so it is short by rule. */
  summary: string
  /** The rest of the entry, as HTML; empty when the entry is only a summary. */
  html: string
  /** Ids of related entries, shown as "See also". */
  see: string[]
  /** The sections that link here, in content order. */
  uses: SectionUse[]
}

export interface SectionUse {
  chapter: string
  section: string
}

export interface Chapter {
  id: string // slug(title)
  title: string
  sections: Section[]
}

export interface Section {
  id: string
  title: string
  html: string
  concepts: Concept[]
}

export interface Concept {
  id: string
  variants: Variant[]
}

interface VariantBase {
  prompt: string
  explanation: string
}

export type Variant =
  | (VariantBase & { type: 'mc' | 'multi'; correct: string[]; wrong: string[]; n: number })
  | (VariantBase & { type: 'tf'; answer: boolean })
  | (VariantBase & { type: 'short'; accepted: string[] })
