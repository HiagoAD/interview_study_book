// Content model shared by the build-time pipeline and the browser app.
// Every string is HTML except `accepted`, which is plain text.

export interface Book {
  id: string
  title: string
  chapters: Chapter[]
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
