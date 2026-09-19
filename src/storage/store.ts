import { conceptKey, emptySectionRecord, sectionKey } from '../engine/records'
import type { Mode, ProgressRecords } from '../engine/records'
import { applyAnswer } from '../engine/scheduling'
import { allConceptsAnswered, isSectionUnlocked } from '../engine/sections'
import type { ChapterRef, SectionRef } from '../engine/sections'
import type { Clock } from './clock'
import { deleteBookRecords, loadRecords, openStudyDb, putConcept, putSection, replaceRecords } from './database'
import type { StudyDb } from './database'
import { buildExport, readProgressExport } from './exchange'
import type { ProgressExport } from './exchange'

export interface ProgressSnapshot extends ProgressRecords {
  readonly today: string
  /** False when progress isn't being saved to IndexedDB: it wouldn't open, or a write failed. */
  readonly persistent: boolean
}

export interface RecordAnswerInput {
  bookId: string
  section: SectionRef
  conceptId: string
  v: number
  ok: boolean
  mode: Mode
}

export type ImportOutcome = { ok: true; concepts: number; sections: number } | { ok: false; error: string }

export interface ProgressStore {
  /** For `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void
  /** The same object until something changes. */
  getSnapshot(): ProgressSnapshot
  /** Applies the answer, and sets the section's `completedAt` when this answers its last concept. */
  recordAnswer(input: RecordAnswerInput): void
  /** Sets `readAt` the first time an unlocked section is opened. Does nothing for a locked one. */
  markRead(bookId: string, chapter: ChapterRef, sectionId: string): void
  /** Everything in memory, as the contents of a backup file. */
  exportData(): ProgressExport
  /** Replaces all progress with the contents of a backup file, unless the file is invalid. */
  importProgress(text: string): Promise<ImportOutcome>
  /** Deletes every record of the book, records of concepts that left the content included. */
  resetBook(bookId: string): Promise<void>
  /** Dev builds only: see `Clock.setToday`. */
  setToday(date: string | null): void
  /** Resolves when every write started so far has finished, or failed. */
  flush(): Promise<void>
}

function byKey<T extends { key: string }>(records: Iterable<T>): Map<string, T> {
  return new Map([...records].map((record) => [record.key, record]))
}

function without<T extends { bookId: string }>(records: ReadonlyMap<string, T>, bookId: string): Map<string, T> {
  return new Map([...records].filter(([, record]) => record.bookId !== bookId))
}

/**
 * Progress in memory, written through to IndexedDB. Memory is what the app reads and is always current; each
 * change is written to `db` as it happens. With no `db`, or once a write fails, `persistent` is false and the
 * store carries on in memory alone. Loads the stored records first.
 */
export async function createProgressStore(db: StudyDb | null, clock: Clock): Promise<ProgressStore> {
  const stored = db ? await loadRecords(db) : { concepts: [], sections: [] }
  let snapshot: ProgressSnapshot = {
    concepts: byKey(stored.concepts),
    sections: byKey(stored.sections),
    today: clock.today(),
    persistent: db !== null,
  }
  const listeners = new Set<() => void>()
  const writes = new Set<Promise<void>>()

  function update(changes: Partial<Pick<ProgressSnapshot, 'concepts' | 'sections' | 'persistent'>>): void {
    snapshot = { ...snapshot, ...changes, today: clock.today() }
    for (const listener of [...listeners]) listener()
  }

  /** Starts a write now, so writes reach IndexedDB in the order the changes were made. Never rejects. */
  function write(operation: (db: StudyDb) => Promise<void>): Promise<void> {
    if (!db) return Promise.resolve()
    const connection = db
    const task = (async () => operation(connection))().catch(() => {
      if (snapshot.persistent) update({ persistent: false })
    })
    writes.add(task)
    void task.then(() => writes.delete(task))
    return task
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },

    getSnapshot: () => snapshot,

    recordAnswer({ bookId, section, conceptId, v, ok, mode }) {
      const now = clock.now()
      const concept = applyAnswer(snapshot.concepts.get(conceptKey(bookId, conceptId)), {
        bookId,
        conceptId,
        v,
        ok,
        mode,
        now,
        today: clock.today(),
      })
      const concepts = new Map(snapshot.concepts).set(concept.key, concept)
      void write((connection) => putConcept(connection, concept))

      const key = sectionKey(bookId, section.id)
      const existing = snapshot.sections.get(key)
      let sections = snapshot.sections
      if (existing?.completedAt == null && allConceptsAnswered(bookId, section, concepts)) {
        const completed = { ...(existing ?? emptySectionRecord(bookId, section.id)), completedAt: now }
        sections = new Map(sections).set(key, completed)
        void write((connection) => putSection(connection, completed))
      }

      update({ concepts, sections })
    },

    markRead(bookId, chapter, sectionId) {
      const index = chapter.sections.findIndex((section) => section.id === sectionId)
      if (index === -1 || !isSectionUnlocked(bookId, chapter, index, snapshot)) return
      const key = sectionKey(bookId, sectionId)
      const existing = snapshot.sections.get(key)
      if (existing?.readAt != null) return

      const record = { ...(existing ?? emptySectionRecord(bookId, sectionId)), readAt: clock.now() }
      void write((connection) => putSection(connection, record))
      update({ sections: new Map(snapshot.sections).set(key, record) })
    },

    exportData: () => buildExport(snapshot.concepts.values(), snapshot.sections.values(), clock.now()),

    async importProgress(text) {
      const result = readProgressExport(text)
      if (!result.ok) return result
      const { concepts, sections } = result.data
      const written = write((connection) => replaceRecords(connection, { concepts, sections }))
      update({ concepts: byKey(concepts), sections: byKey(sections) })
      await written
      return { ok: true, concepts: concepts.length, sections: sections.length }
    },

    resetBook(bookId) {
      const written = write((connection) => deleteBookRecords(connection, bookId))
      update({ concepts: without(snapshot.concepts, bookId), sections: without(snapshot.sections, bookId) })
      return written
    },

    setToday(date) {
      clock.setToday(date)
      if (clock.today() !== snapshot.today) update({})
    },

    async flush() {
      while (writes.size > 0) await Promise.all([...writes])
    },
  }
}

/**
 * Opens the database and the store. When the database can't be opened or read, which some browsers do for
 * `file://` pages and in private mode, returns a store that keeps progress in memory only.
 */
export async function openProgressStore(
  clock: Clock,
  open: () => Promise<StudyDb> = openStudyDb,
): Promise<ProgressStore> {
  let db: StudyDb | null = null
  try {
    db = await open()
    return await createProgressStore(db, clock)
  } catch {
    db?.close()
    return createProgressStore(null, clock)
  }
}
