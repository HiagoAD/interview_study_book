// The progress records the study flow keeps, and the keys they are stored under. Records are treated as
// immutable: every function that changes one returns a new object.

export type Mode = 'study' | 'review'
export type Box = 1 | 2 | 3 | 4 | 5

export interface HistoryEntry {
  at: string // ISO timestamp
  v: number // variant index
  ok: boolean
  mode: Mode
}

export interface VariantRecord {
  lastShownAt: string // ISO timestamp
  lastOk: boolean
}

export interface ConceptRecord {
  key: string // `${bookId}/${conceptId}`
  bookId: string
  conceptId: string
  box: Box | null // null = not in the review queue
  due: string | null // local date, YYYY-MM-DD; null exactly when box is null
  history: HistoryEntry[]
  variants: Record<number, VariantRecord>
}

export interface SectionRecord {
  key: string // `${bookId}/${sectionId}`
  bookId: string
  sectionId: string
  readAt: string | null // ISO timestamp
  completedAt: string | null // ISO timestamp
}

/** Every record held in memory, by key. Records of concepts and sections that left the content stay in here. */
export interface ProgressRecords {
  concepts: ReadonlyMap<string, ConceptRecord>
  sections: ReadonlyMap<string, SectionRecord>
}

export function conceptKey(bookId: string, conceptId: string): string {
  return `${bookId}/${conceptId}`
}

export function sectionKey(bookId: string, sectionId: string): string {
  return `${bookId}/${sectionId}`
}

export function emptyConceptRecord(bookId: string, conceptId: string): ConceptRecord {
  return { key: conceptKey(bookId, conceptId), bookId, conceptId, box: null, due: null, history: [], variants: {} }
}

export function emptySectionRecord(bookId: string, sectionId: string): SectionRecord {
  return { key: sectionKey(bookId, sectionId), bookId, sectionId, readAt: null, completedAt: null }
}
