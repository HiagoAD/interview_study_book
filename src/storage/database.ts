import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { ConceptRecord, SectionRecord } from '../engine/records'

export const DB_NAME = 'study'
export const DB_VERSION = 1

interface StudySchema extends DBSchema {
  concepts: { key: string; value: ConceptRecord; indexes: { bookId: string } }
  sections: { key: string; value: SectionRecord; indexes: { bookId: string } }
}

export type StudyDb = IDBPDatabase<StudySchema>

export interface StoredRecords {
  concepts: ConceptRecord[]
  sections: SectionRecord[]
}

/**
 * Rejects when the browser won't open the database, or holds a newer version of it. It is `async` because
 * `openDB` throws, rather than rejects, when `indexedDB` is missing or `open` throws.
 */
export async function openStudyDb(): Promise<StudyDb> {
  return openDB<StudySchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('concepts', { keyPath: 'key' }).createIndex('bookId', 'bookId')
        db.createObjectStore('sections', { keyPath: 'key' }).createIndex('bookId', 'bookId')
      }
    },
  })
}

export async function loadRecords(db: StudyDb): Promise<StoredRecords> {
  const tx = db.transaction(['concepts', 'sections'], 'readonly')
  const [concepts, sections] = await Promise.all([
    tx.objectStore('concepts').getAll(),
    tx.objectStore('sections').getAll(),
    tx.done,
  ])
  return { concepts, sections }
}

export async function putConcept(db: StudyDb, record: ConceptRecord): Promise<void> {
  await db.put('concepts', record)
}

export async function putSection(db: StudyDb, record: SectionRecord): Promise<void> {
  await db.put('sections', record)
}

/**
 * Replaces every record in one transaction, so a failure leaves the old records as they were. A request that
 * fails aborts the transaction by itself, but a `put` that throws before it is queued doesn't, and the
 * `clear` already queued would go through. That is why the transaction is aborted by hand.
 */
export async function replaceRecords(db: StudyDb, records: StoredRecords): Promise<void> {
  const tx = db.transaction(['concepts', 'sections'], 'readwrite')
  const requests: Promise<unknown>[] = [tx.done]
  try {
    const concepts = tx.objectStore('concepts')
    const sections = tx.objectStore('sections')
    requests.push(concepts.clear(), sections.clear())
    for (const record of records.concepts) requests.push(concepts.put(record))
    for (const record of records.sections) requests.push(sections.put(record))
    await Promise.all(requests)
  } catch (error) {
    // The requests already queued all reject once the transaction aborts. Listen, so that isn't unhandled.
    void Promise.allSettled(requests)
    try {
      tx.abort()
    } catch {
      // The transaction had already ended.
    }
    throw error
  }
}

/** Deletes every record of one book, in one transaction. */
export async function deleteBookRecords(db: StudyDb, bookId: string): Promise<void> {
  const tx = db.transaction(['concepts', 'sections'], 'readwrite')
  const concepts = tx.objectStore('concepts')
  const sections = tx.objectStore('sections')
  const [conceptKeys, sectionKeys] = await Promise.all([
    concepts.index('bookId').getAllKeys(bookId),
    sections.index('bookId').getAllKeys(bookId),
  ])
  await Promise.all([
    ...conceptKeys.map((key) => concepts.delete(key)),
    ...sectionKeys.map((key) => sections.delete(key)),
    tx.done,
  ])
}
