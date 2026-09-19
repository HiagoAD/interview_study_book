import { vi } from 'vitest'
import type { ConceptRecord, ProgressRecords, SectionRecord } from './engine/records'
import { emptyConceptRecord, emptySectionRecord } from './engine/records'
import type { ChoiceVariant } from './engine/sampling'
import type { Book, Chapter, Concept, Section, Variant } from './types/content'

/** A repeatable Rng (mulberry32): the same seed gives the same sequence. */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Runs `fn` with the process in another time zone, then switches back. */
export function inTimeZone<T>(zone: string, fn: () => T): T {
  vi.stubEnv('TZ', zone)
  try {
    return fn()
  } finally {
    vi.unstubAllEnvs()
  }
}

/** Freezes a value and everything inside it, so code that changes its input throws. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const inner of Object.values(value)) deepFreeze(inner)
  }
  return value
}

// Content builders

export function choice(type: 'mc' | 'multi', correct: string[], wrong: string[], n = 4): ChoiceVariant {
  return { type, prompt: 'Question?', explanation: 'Because.', correct, wrong, n }
}

export function trueFalse(answer: boolean): Variant {
  return { type: 'tf', prompt: 'Statement.', explanation: 'Because.', answer }
}

export function short(accepted: string[]): Variant {
  return { type: 'short', prompt: 'Name it.', explanation: 'Because.', accepted }
}

export function concept(id: string, variantCount = 1): Concept {
  return { id, variants: Array.from({ length: variantCount }, () => choice('mc', ['right'], ['wrong'])) }
}

export function section(id: string, conceptIds: string[]): Section {
  return { id, title: id, html: `<p>${id}</p>`, concepts: conceptIds.map((conceptId) => concept(conceptId)) }
}

export function chapter(id: string, sections: Section[]): Chapter {
  return { id, title: id, sections }
}

export function book(id: string, chapters: Chapter[]): Book {
  return { id, title: id, chapters }
}

// Record builders

export function conceptRecord(bookId: string, conceptId: string, over: Partial<ConceptRecord> = {}): ConceptRecord {
  return { ...emptyConceptRecord(bookId, conceptId), ...over }
}

/** A concept record with one answer in its history. */
export function answeredRecord(bookId: string, conceptId: string, ok = true): ConceptRecord {
  const at = '2026-01-01T00:00:00.000Z'
  return conceptRecord(bookId, conceptId, {
    history: [{ at, v: 0, ok, mode: 'study' }],
    variants: { 0: { lastShownAt: at, lastOk: ok } },
  })
}

export function sectionRecord(bookId: string, sectionId: string, over: Partial<SectionRecord> = {}): SectionRecord {
  return { ...emptySectionRecord(bookId, sectionId), ...over }
}

export function records(concepts: ConceptRecord[] = [], sections: SectionRecord[] = []): ProgressRecords {
  return {
    concepts: new Map(concepts.map((record) => [record.key, record])),
    sections: new Map(sections.map((record) => [record.key, record])),
  }
}
