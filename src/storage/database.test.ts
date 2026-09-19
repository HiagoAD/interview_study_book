import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ConceptRecord } from '../engine/records'
import { answeredRecord, conceptRecord, sectionRecord } from '../test-helpers'
import { deleteBookRecords, loadRecords, openStudyDb, putConcept, putSection, replaceRecords } from './database'

// A new, empty IndexedDB for every test.
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const rich: ConceptRecord = conceptRecord('sys', 'lru', {
  box: 3,
  due: '2026-09-26',
  history: [
    { at: '2026-09-01T10:00:00.000Z', v: 0, ok: false, mode: 'study' },
    { at: '2026-09-19T10:00:00.000Z', v: 2, ok: true, mode: 'review' },
  ],
  variants: {
    0: { lastShownAt: '2026-09-01T10:00:00.000Z', lastOk: false },
    2: { lastShownAt: '2026-09-19T10:00:00.000Z', lastOk: true },
  },
})

describe('the database', () => {
  test('is named "study", version 1, with stores keyed by "key" and an index on bookId', async () => {
    const db = await openStudyDb()
    expect(db.name).toBe('study')
    expect(db.version).toBe(1)
    expect([...db.objectStoreNames].sort()).toEqual(['concepts', 'sections'])
    for (const name of ['concepts', 'sections'] as const) {
      const store = db.transaction(name).store
      expect(store.keyPath).toBe('key')
      expect([...store.indexNames]).toEqual(['bookId'])
      expect(store.index('bookId').keyPath).toBe('bookId')
    }
  })

  test('starts with no records', async () => {
    expect(await loadRecords(await openStudyDb())).toEqual({ concepts: [], sections: [] })
  })

  test('can be opened again without losing the stores', async () => {
    const first = await openStudyDb()
    await putConcept(first, rich)
    first.close()
    const second = await openStudyDb()
    expect([...second.objectStoreNames].sort()).toEqual(['concepts', 'sections'])
    expect((await loadRecords(second)).concepts).toEqual([rich])
  })
})

describe('reading and writing records', () => {
  test('round trips concept and section records exactly, including null fields and numbered variants', async () => {
    const db = await openStudyDb()
    const empty = conceptRecord('sys', 'fresh')
    const section = sectionRecord('sys', 'cache', { readAt: '2026-09-01T10:00:00.000Z', completedAt: null })
    await putConcept(db, rich)
    await putConcept(db, empty)
    await putSection(db, section)

    const stored = await loadRecords(db)
    expect(stored.concepts).toHaveLength(2)
    expect(stored.concepts).toContainEqual(rich)
    expect(stored.concepts).toContainEqual(empty)
    expect(stored.sections).toEqual([section])
  })

  test('survives closing and reopening the database', async () => {
    const first = await openStudyDb()
    await putConcept(first, rich)
    await putSection(first, sectionRecord('sys', 'cache', { readAt: '2026-09-01T10:00:00.000Z' }))
    first.close()

    const stored = await loadRecords(await openStudyDb())
    expect(stored.concepts).toEqual([rich])
    expect(stored.sections).toEqual([sectionRecord('sys', 'cache', { readAt: '2026-09-01T10:00:00.000Z' })])
  })

  test('writing a record with an existing key replaces it', async () => {
    const db = await openStudyDb()
    await putConcept(db, conceptRecord('sys', 'lru', { box: 1, due: '2026-09-20' }))
    await putConcept(db, rich)
    expect((await loadRecords(db)).concepts).toEqual([rich])
  })

  test('the bookId index finds the records of one book, in both stores', async () => {
    const db = await openStudyDb()
    for (const record of [answeredRecord('a', 'c1'), answeredRecord('a', 'c2'), answeredRecord('b', 'c1')]) {
      await putConcept(db, record)
    }
    await putSection(db, sectionRecord('a', 's1'))
    await putSection(db, sectionRecord('b', 's1'))
    await putSection(db, sectionRecord('b', 's2'))

    expect((await db.getAllFromIndex('concepts', 'bookId', 'a')).map((r) => r.key).sort()).toEqual(['a/c1', 'a/c2'])
    expect((await db.getAllFromIndex('sections', 'bookId', 'b')).map((r) => r.key).sort()).toEqual(['b/s1', 'b/s2'])
  })
})

describe('replaceRecords', () => {
  test('replaces every record: old ones that are not in the new set are gone', async () => {
    const db = await openStudyDb()
    await putConcept(db, answeredRecord('old', 'c1'))
    await putSection(db, sectionRecord('old', 's1'))

    const concepts = [answeredRecord('new', 'c1'), rich]
    const sections = [sectionRecord('new', 's1', { completedAt: '2026-09-01T10:00:00.000Z' })]
    await replaceRecords(db, { concepts, sections })

    const stored = await loadRecords(db)
    expect(stored.concepts.map((r) => r.key).sort()).toEqual(['new/c1', 'sys/lru'])
    expect(stored.sections).toEqual(sections)
  })

  test('with nothing empties both stores', async () => {
    const db = await openStudyDb()
    await putConcept(db, rich)
    await putSection(db, sectionRecord('sys', 's'))
    await replaceRecords(db, { concepts: [], sections: [] })
    expect(await loadRecords(db)).toEqual({ concepts: [], sections: [] })
  })

  test('is all or nothing: a record that cannot be stored leaves the old records untouched', async () => {
    const db = await openStudyDb()
    const before = answeredRecord('old', 'c1')
    const section = sectionRecord('old', 's1')
    await putConcept(db, before)
    await putSection(db, section)

    const unstorable = { bookId: 'new', conceptId: 'c' } as ConceptRecord // no key
    await expect(replaceRecords(db, { concepts: [answeredRecord('new', 'c1'), unstorable], sections: [] })).rejects.toThrow()

    expect(await loadRecords(db)).toEqual({ concepts: [before], sections: [section] })
  })
})

describe('deleteBookRecords', () => {
  test('deletes the concept and section records of one book and no others', async () => {
    const db = await openStudyDb()
    for (const record of [answeredRecord('a', 'c1'), answeredRecord('a', 'c2'), answeredRecord('b', 'c1')]) {
      await putConcept(db, record)
    }
    await putSection(db, sectionRecord('a', 's1'))
    await putSection(db, sectionRecord('b', 's1'))

    await deleteBookRecords(db, 'a')

    const stored = await loadRecords(db)
    expect(stored.concepts.map((r) => r.key)).toEqual(['b/c1'])
    expect(stored.sections.map((r) => r.key)).toEqual(['b/s1'])
  })

  test('does nothing for a book with no records', async () => {
    const db = await openStudyDb()
    await putConcept(db, rich)
    await deleteBookRecords(db, 'nobody')
    expect((await loadRecords(db)).concepts).toEqual([rich])
  })

  test('does not match a book whose id only starts with the same letters', async () => {
    const db = await openStudyDb()
    await putConcept(db, answeredRecord('sys', 'c1'))
    await putConcept(db, answeredRecord('sys-design', 'c1'))
    await deleteBookRecords(db, 'sys')
    expect((await loadRecords(db)).concepts.map((r) => r.key)).toEqual(['sys-design/c1'])
  })
})

describe('when the database cannot be opened', () => {
  test('rejects when the browser holds a newer version', async () => {
    const newer = await openDB('study', 2)
    await expect(openStudyDb()).rejects.toMatchObject({ name: 'VersionError' })
    newer.close()
  })

  test('rejects when there is no IndexedDB at all', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await expect(openStudyDb()).rejects.toThrow()
  })

  test('rejects when opening throws, as some browsers do for file:// pages', async () => {
    vi.stubGlobal('indexedDB', {
      open() {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    })
    await expect(openStudyDb()).rejects.toMatchObject({ name: 'SecurityError' })
  })
})
