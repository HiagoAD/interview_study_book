import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ConceptRecord, SectionRecord } from '../engine/records'
import { isSectionUnlocked } from '../engine/sections'
import { answeredRecord, section, sectionRecord } from '../test-helpers'
import { createClock } from './clock'
import type { Clock } from './clock'
import { loadRecords, openStudyDb, putConcept, putSection } from './database'
import type { StudyDb } from './database'
import { createProgressStore, openProgressStore } from './store'
import type { ProgressStore, RecordAnswerInput } from './store'

// A new, empty IndexedDB for every test.
beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

const T1 = '2026-09-19T10:00:00.000Z'
const T2 = '2026-09-20T11:30:00.000Z'
const T3 = '2026-09-21T08:00:00.000Z'

interface FakeClock extends Clock {
  set(now: string, today: string): void
}

/** A clock that says what it is told to. Its `setToday` does nothing: the real one has its own tests. */
function fakeClock(now = T1, today = '2026-09-19'): FakeClock {
  let current = { now, today }
  return {
    now: () => current.now,
    today: () => current.today,
    setToday: () => {},
    set: (nextNow, nextToday) => {
      current = { now: nextNow, today: nextToday }
    },
  }
}

// A book with two sections in one chapter: s1 has the concepts c1 and c2, s2 has c3.
const BOOK = 'b'
const s1 = section('s1', ['c1', 'c2'])
const s2 = section('s2', ['c3'])
const chapter = { sections: [s1, s2] }

function answer(store: ProgressStore, conceptId: string, ok: boolean, over: Partial<RecordAnswerInput> = {}): void {
  const owner = [s1, s2].find((s) => s.concepts.some((c) => c.id === conceptId)) ?? s1
  store.recordAnswer({ bookId: BOOK, section: owner, conceptId, v: 0, ok, mode: 'study', ...over })
}

async function openWith<C extends Clock>(clock: C) {
  const db = await openStudyDb()
  return { db, store: await createProgressStore(db, clock), clock }
}

function open() {
  return openWith(fakeClock())
}

function byKey<T extends { key: string }>(records: Iterable<T>): T[] {
  return [...records].sort((a, b) => (a.key < b.key ? -1 : 1))
}

/** What IndexedDB holds right now, read through a new connection. */
async function stored() {
  const db = await openStudyDb()
  const records = await loadRecords(db)
  db.close()
  return { concepts: byKey(records.concepts), sections: byKey(records.sections) }
}

/** What the store holds in memory. */
function held(store: ProgressStore) {
  const { concepts, sections } = store.getSnapshot()
  return { concepts: byKey(concepts.values()), sections: byKey(sections.values()) }
}

function conceptOf(store: ProgressStore, conceptId: string, bookId = BOOK): ConceptRecord {
  const record = store.getSnapshot().concepts.get(`${bookId}/${conceptId}`)
  if (!record) throw new Error(`no record for ${bookId}/${conceptId}`)
  return record
}

function sectionOf(store: ProgressStore, sectionId: string, bookId = BOOK): SectionRecord | undefined {
  return store.getSnapshot().sections.get(`${bookId}/${sectionId}`)
}

function listener(store: ProgressStore) {
  const calls = vi.fn()
  const unsubscribe = store.subscribe(calls)
  return { calls, unsubscribe }
}

describe('loading', () => {
  test('starts empty on a new database, saving progress', async () => {
    const { store } = await open()
    const snapshot = store.getSnapshot()
    expect(snapshot.concepts.size).toBe(0)
    expect(snapshot.sections.size).toBe(0)
    expect(snapshot.persistent).toBe(true)
    expect(snapshot.today).toBe('2026-09-19')
  })

  test('loads every stored record into memory', async () => {
    const db = await openStudyDb()
    const c = answeredRecord(BOOK, 'c1')
    const s = sectionRecord(BOOK, 's1', { readAt: T1 })
    await putConcept(db, c)
    await putSection(db, s)

    const store = await createProgressStore(db, fakeClock())
    expect(held(store)).toEqual({ concepts: [c], sections: [s] })
  })

  test('progress survives a reload: a new store on the same database has the same records and unlocks', async () => {
    const first = await open()
    answer(first.store, 'c1', false)
    answer(first.store, 'c2', true)
    first.store.markRead(BOOK, chapter, 's1')
    await first.store.flush()
    first.db.close()

    const second = await open()
    expect(held(second.store)).toEqual(held(first.store))
    expect(isSectionUnlocked(BOOK, chapter, 1, second.store.getSnapshot())).toBe(true)
  })
})

describe('recordAnswer', () => {
  test('applies the scheduling rules with the clock: due dates from today, timestamps from now', async () => {
    const { store, clock } = await open()
    answer(store, 'c1', false, { v: 2, mode: 'review' })
    expect(conceptOf(store, 'c1')).toMatchObject({
      key: 'b/c1',
      box: 1,
      due: '2026-09-20',
      history: [{ at: T1, v: 2, ok: false, mode: 'review' }],
      variants: { 2: { lastShownAt: T1, lastOk: false } },
    })

    clock.set(T2, '2026-09-20')
    answer(store, 'c1', true)
    expect(conceptOf(store, 'c1')).toMatchObject({ box: 2, due: '2026-09-23' })
    expect(conceptOf(store, 'c1').history.map((h) => h.at)).toEqual([T1, T2])
  })

  test('is in memory at once, and in IndexedDB once the write finishes', async () => {
    const { store } = await open()
    answer(store, 'c1', false)
    expect(conceptOf(store, 'c1').box).toBe(1)

    await store.flush()
    expect((await stored()).concepts).toEqual([conceptOf(store, 'c1')])
  })

  test('the same concept id in two books is two records', async () => {
    const { store } = await open()
    answer(store, 'c1', false)
    answer(store, 'c1', true, { bookId: 'other' })
    expect(conceptOf(store, 'c1', BOOK).box).toBe(1)
    expect(conceptOf(store, 'c1', 'other').box).toBeNull()
    await store.flush()
    expect((await stored()).concepts.map((r) => r.key)).toEqual(['b/c1', 'other/c1'])
  })

  test('writes reach IndexedDB in order: quick answers to one concept end as the last one', async () => {
    const { store } = await open()
    answer(store, 'c1', false)
    answer(store, 'c1', true)
    answer(store, 'c1', false)
    await store.flush()
    const [record] = (await stored()).concepts
    expect(record.history.map((h) => h.ok)).toEqual([false, true, false])
    expect(record).toEqual(conceptOf(store, 'c1'))
  })

  test('uses the local date when the UTC date is another day, in a zone ahead of UTC', async () => {
    vi.stubEnv('TZ', 'Pacific/Auckland')
    const moment = new Date(2026, 8, 19, 0, 30) // the 19th in Auckland, still the 18th in UTC
    const { store } = await openWith(createClock(() => moment))
    answer(store, 'c1', false)
    expect(moment.toISOString().slice(0, 10)).toBe('2026-09-18')
    expect(conceptOf(store, 'c1')).toMatchObject({ due: '2026-09-20' })
    expect(conceptOf(store, 'c1').history[0].at).toBe(moment.toISOString())
  })

  test('uses the local date when the UTC date is another day, in a zone behind UTC', async () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    const moment = new Date(2026, 8, 19, 23, 30) // the 19th in Los Angeles, already the 20th in UTC
    const { store } = await openWith(createClock(() => moment))
    answer(store, 'c1', false)
    expect(moment.toISOString().slice(0, 10)).toBe('2026-09-20')
    expect(conceptOf(store, 'c1')).toMatchObject({ due: '2026-09-20' })
  })
})

describe('subscribing', () => {
  test('tells subscribers once per change, and not after they unsubscribe', async () => {
    const { store } = await open()
    const { calls, unsubscribe } = listener(store)
    answer(store, 'c3', true)
    expect(calls).toHaveBeenCalledTimes(1)
    answer(store, 'c3', false)
    expect(calls).toHaveBeenCalledTimes(2)
    unsubscribe()
    answer(store, 'c3', true)
    expect(calls).toHaveBeenCalledTimes(2)
  })

  test('the snapshot is the same object until something changes, and a change never edits an old one', async () => {
    const { store } = await open()
    const before = store.getSnapshot()
    expect(store.getSnapshot()).toBe(before)

    answer(store, 'c1', false)
    const after = store.getSnapshot()
    expect(after).not.toBe(before)
    expect(store.getSnapshot()).toBe(after)
    expect(before.concepts.size).toBe(0)
    expect(before.sections.size).toBe(0)
    expect(after.concepts.size).toBe(1)
  })

  test('subscribers see the new snapshot when they are told', async () => {
    const { store } = await open()
    let seen = -1
    store.subscribe(() => {
      seen = store.getSnapshot().concepts.size
    })
    answer(store, 'c1', true)
    expect(seen).toBe(1)
  })
})

describe('completing a section', () => {
  test('sets completedAt when the last concept is answered, and not before', async () => {
    const { store, clock } = await open()
    answer(store, 'c1', true)
    expect(sectionOf(store, 's1')).toBeUndefined()

    clock.set(T2, '2026-09-20')
    answer(store, 'c2', true)
    expect(sectionOf(store, 's1')).toEqual({ key: 'b/s1', bookId: BOOK, sectionId: 's1', readAt: null, completedAt: T2 })
  })

  test('counts a wrong answer: the section completes and the concept goes to review', async () => {
    const { store } = await open()
    answer(store, 'c1', true)
    answer(store, 'c2', false)
    expect(sectionOf(store, 's1')?.completedAt).toBe(T1)
    expect(conceptOf(store, 'c2').box).toBe(1)
  })

  test('sets completedAt once: later answers do not move it', async () => {
    const { store, clock } = await open()
    answer(store, 'c1', true)
    answer(store, 'c2', true)
    clock.set(T3, '2026-09-21')
    answer(store, 'c1', false)
    answer(store, 'c2', true)
    expect(sectionOf(store, 's1')?.completedAt).toBe(T1)
  })

  test('only completes the section the concepts belong to', async () => {
    const { store } = await open()
    answer(store, 'c3', true)
    expect(sectionOf(store, 's2')?.completedAt).toBe(T1)
    expect(sectionOf(store, 's1')).toBeUndefined()
  })

  test('answers in review count the same', async () => {
    const { store } = await open()
    answer(store, 'c1', true, { mode: 'review' })
    answer(store, 'c2', true, { mode: 'review' })
    expect(sectionOf(store, 's1')?.completedAt).toBe(T1)
  })

  test('keeps readAt when the section completes, and completedAt when it is read', async () => {
    const { store, clock } = await open()
    store.markRead(BOOK, chapter, 's1')
    clock.set(T2, '2026-09-20')
    answer(store, 'c1', true)
    answer(store, 'c2', true)
    expect(sectionOf(store, 's1')).toMatchObject({ readAt: T1, completedAt: T2 })
    store.markRead(BOOK, chapter, 's1')
    expect(sectionOf(store, 's1')).toMatchObject({ readAt: T1, completedAt: T2 })
  })

  test('the section stays complete and the next one open after a concept is added to it', async () => {
    const { store } = await open()
    answer(store, 'c1', true)
    answer(store, 'c2', true)
    const grown = section('s1', ['c1', 'c2', 'c-new'])
    answer(store, 'c1', true, { section: grown })
    expect(sectionOf(store, 's1')?.completedAt).toBe(T1)
    expect(isSectionUnlocked(BOOK, { sections: [grown, s2] }, 1, store.getSnapshot())).toBe(true)
  })

  test('writes the section record, and it is there after a reload', async () => {
    const { store, db } = await open()
    answer(store, 'c1', true)
    answer(store, 'c2', true)
    await store.flush()
    expect((await stored()).sections).toEqual([sectionOf(store, 's1')])
    db.close()
    const reloaded = await open()
    expect(sectionOf(reloaded.store, 's1')?.completedAt).toBe(T1)
  })
})

describe('markRead', () => {
  test('sets readAt the first time and not again', async () => {
    const { store, clock } = await open()
    const { calls } = listener(store)
    store.markRead(BOOK, chapter, 's1')
    expect(sectionOf(store, 's1')).toEqual({ key: 'b/s1', bookId: BOOK, sectionId: 's1', readAt: T1, completedAt: null })
    expect(calls).toHaveBeenCalledTimes(1)

    clock.set(T2, '2026-09-20')
    store.markRead(BOOK, chapter, 's1')
    expect(sectionOf(store, 's1')?.readAt).toBe(T1)
    expect(calls).toHaveBeenCalledTimes(1)
  })

  test('does nothing for a section that is locked', async () => {
    const { store } = await open()
    const { calls } = listener(store)
    store.markRead(BOOK, chapter, 's2')
    expect(sectionOf(store, 's2')).toBeUndefined()
    expect(calls).not.toHaveBeenCalled()
    await store.flush()
    expect((await stored()).sections).toEqual([])
  })

  test('reads a later section once the one before it is complete', async () => {
    const { store } = await open()
    answer(store, 'c1', true)
    answer(store, 'c2', false)
    store.markRead(BOOK, chapter, 's2')
    expect(sectionOf(store, 's2')?.readAt).toBe(T1)
  })

  test('does nothing for a section that is not in the chapter', async () => {
    const { store } = await open()
    store.markRead(BOOK, chapter, 'nope')
    expect(store.getSnapshot().sections.size).toBe(0)
  })

  test('opens the section for good: a read section stays unlocked', async () => {
    const { store } = await open()
    answer(store, 'c1', true)
    answer(store, 'c2', true)
    store.markRead(BOOK, chapter, 's2')
    // s1 gains a concept, so s2 no longer follows a complete section; only its readAt keeps it open.
    const edited = { sections: [section('s1', ['c1', 'c2', 'c-new']), s2] }
    expect(sectionOf(store, 's1')?.completedAt).not.toBeNull()
    expect(isSectionUnlocked(BOOK, edited, 1, store.getSnapshot())).toBe(true)
  })

  test('is written to IndexedDB', async () => {
    const { store } = await open()
    store.markRead(BOOK, chapter, 's1')
    await store.flush()
    expect((await stored()).sections).toEqual([sectionOf(store, 's1')])
  })
})

describe('resetBook', () => {
  async function twoBooks() {
    const { store, db } = await open()
    answer(store, 'c1', false)
    answer(store, 'c2', true)
    store.markRead(BOOK, chapter, 's1')
    answer(store, 'c1', false, { bookId: 'sys' })
    answer(store, 'c2', true, { bookId: 'sys' })
    store.markRead('sys', chapter, 's1')
    answer(store, 'c1', true, { bookId: 'sys-design' })
    await store.flush()
    return { store, db }
  }

  test('deletes every record of that book, and only that book, in memory and in IndexedDB', async () => {
    const { store } = await twoBooks()
    const keptConcepts = ['b/c1', 'b/c2', 'sys-design/c1']
    await store.resetBook('sys')

    const keys = (records: Iterable<{ key: string }>) => [...records].map((r) => r.key).sort()
    expect(keys(store.getSnapshot().concepts.values())).toEqual(keptConcepts)
    expect(keys(store.getSnapshot().sections.values())).toEqual(['b/s1'])
    const inDb = await stored()
    expect(keys(inDb.concepts)).toEqual(keptConcepts)
    expect(keys(inDb.sections)).toEqual(['b/s1'])
  })

  test('leaves the other books exactly as they were', async () => {
    const { store } = await twoBooks()
    const before = conceptOf(store, 'c1', BOOK)
    const beforeSection = sectionOf(store, 's1', BOOK)
    await store.resetBook('sys')
    expect(conceptOf(store, 'c1', BOOK)).toBe(before)
    expect(sectionOf(store, 's1', BOOK)).toBe(beforeSection)
    expect(held(store)).toEqual(await stored())
  })

  test('deletes records of concepts that are no longer in the content too', async () => {
    const { store } = await open()
    answer(store, 'long-gone', false)
    await store.resetBook(BOOK)
    expect(store.getSnapshot().concepts.size).toBe(0)
    await store.flush()
    expect((await stored()).concepts).toEqual([])
  })

  test('notifies subscribers, and a book that starts afresh has a fresh history', async () => {
    const { store } = await twoBooks()
    const { calls } = listener(store)
    await store.resetBook(BOOK)
    expect(calls).toHaveBeenCalled()
    answer(store, 'c1', true)
    expect(conceptOf(store, 'c1').history).toHaveLength(1)
    expect(sectionOf(store, 's1')).toBeUndefined()
  })

  test('does nothing for a book with no records', async () => {
    const { store } = await twoBooks()
    const before = held(store)
    await store.resetBook('nobody')
    expect(held(store)).toEqual(before)
    expect(await stored()).toEqual(before)
  })
})

describe('export and import', () => {
  async function withProgress() {
    const { store, db, clock } = await open()
    answer(store, 'c1', false)
    answer(store, 'c2', true, { v: 1 })
    store.markRead(BOOK, chapter, 's1')
    answer(store, 'c1', false, { bookId: 'sys' })
    await store.flush()
    return { store, db, clock }
  }

  test('exportData has the format, the version, the time of the export and every record in key order', async () => {
    const { store, clock } = await withProgress()
    clock.set(T3, '2026-09-21')
    const data = store.exportData()
    expect(data).toMatchObject({ format: 'study-progress', version: 1, exportedAt: T3 })
    expect(data.concepts.map((r) => r.key)).toEqual(['b/c1', 'b/c2', 'sys/c1'])
    expect(data.sections.map((r) => r.key)).toEqual(['b/s1'])
    expect(data.concepts[0]).toBe(conceptOf(store, 'c1'))
  })

  test('exporting then importing into a new database gives the same progress, in memory and stored', async () => {
    const source = await withProgress()
    const file = JSON.stringify(source.store.exportData())

    vi.stubGlobal('indexedDB', new IDBFactory())
    const target = await open()
    expect(target.store.getSnapshot().concepts.size).toBe(0)

    expect(await target.store.importProgress(file)).toEqual({ ok: true, concepts: 3, sections: 1 })
    expect(held(target.store)).toEqual(held(source.store))
    expect(await stored()).toEqual(held(source.store))
  })

  test('exporting, resetting a book, then importing brings its progress back', async () => {
    const { store } = await withProgress()
    const file = JSON.stringify(store.exportData())
    const before = held(store)

    await store.resetBook(BOOK)
    expect(store.getSnapshot().concepts.size).toBe(1)

    await store.importProgress(file)
    expect(held(store)).toEqual(before)
    expect(await stored()).toEqual(before)
  })

  test('replaces all progress: what is not in the file is gone', async () => {
    const source = await withProgress()
    const file = JSON.stringify(source.store.exportData())

    const { store } = await open()
    answer(store, 'c3', true)
    answer(store, 'c1', true, { bookId: 'unrelated' })
    await store.flush()

    await store.importProgress(file)
    expect(store.getSnapshot().concepts.has('b/c3')).toBe(false)
    expect(store.getSnapshot().concepts.has('unrelated/c1')).toBe(false)
    expect(store.getSnapshot().sections.has('b/s2')).toBe(false)
    expect((await stored()).concepts.map((r) => r.key)).toEqual(['b/c1', 'b/c2', 'sys/c1'])
  })

  test('keeps the records of concepts that are not in the content', async () => {
    const file = JSON.stringify({
      ...(await withProgress()).store.exportData(),
      concepts: [answeredRecord('gone-book', 'gone-concept')],
      sections: [],
    })
    const { store } = await open()
    await store.importProgress(file)
    expect(store.getSnapshot().concepts.has('gone-book/gone-concept')).toBe(true)
  })

  test('notifies subscribers of an import', async () => {
    const source = await withProgress()
    const { store } = await open()
    const { calls } = listener(store)
    await store.importProgress(JSON.stringify(source.store.exportData()))
    expect(calls).toHaveBeenCalled()
  })

  describe('an invalid file', () => {
    async function goodFile() {
      return (await withProgress()).store.exportData()
    }

    async function badFiles(): Promise<[string, string][]> {
      const good = await goodFile()
      const oneBadRecordAmongGood = {
        ...good,
        concepts: [...good.concepts.slice(0, 2), { ...good.concepts[2], box: 9 }],
      }
      return [
        ['text that is not JSON', 'not json'],
        ['another format', JSON.stringify({ ...good, format: 'other' })],
        ['another version', JSON.stringify({ ...good, version: 2 })],
        ['a section that is not an object', JSON.stringify({ ...good, sections: [null] })],
        ['one bad record after good ones', JSON.stringify(oneBadRecordAmongGood)],
        ['a duplicated record', JSON.stringify({ ...good, concepts: [good.concepts[0], good.concepts[0]] })],
      ]
    }

    test('is rejected with a reason, and changes nothing: memory, IndexedDB and subscribers stay as they were', async () => {
      const files = await badFiles()
      vi.stubGlobal('indexedDB', new IDBFactory())
      const { store } = await open()
      answer(store, 'c3', false)
      await store.flush()
      const snapshot = store.getSnapshot()
      const inDb = await stored()
      const { calls } = listener(store)

      for (const [, file] of files) {
        const outcome = await store.importProgress(file)
        expect(outcome.ok).toBe(false)
        expect(outcome).toHaveProperty('error')
        expect((outcome as { error: string }).error).not.toBe('')
      }

      await store.flush()
      expect(store.getSnapshot()).toBe(snapshot)
      expect(calls).not.toHaveBeenCalled()
      expect(await stored()).toEqual(inDb)
    })

    test('says what is wrong with the file', async () => {
      const good = await goodFile()
      const outcome = await (await open()).store.importProgress(JSON.stringify({ ...good, version: 2 }))
      expect(outcome).toEqual({ ok: false, error: 'version: expected 1, but found 2' })
    })
  })
})

describe('setToday', () => {
  const real = new Date(2026, 8, 19, 12, 0)

  test('makes today another date for the whole store, and null brings the real date back', async () => {
    const { store } = await openWith(createClock(() => real))
    const { calls } = listener(store)
    expect(store.getSnapshot().today).toBe('2026-09-19')

    store.setToday('2026-12-25')
    expect(store.getSnapshot().today).toBe('2026-12-25')
    expect(calls).toHaveBeenCalledTimes(1)

    store.setToday(null)
    expect(store.getSnapshot().today).toBe('2026-09-19')
    expect(calls).toHaveBeenCalledTimes(2)
  })

  test('answers use the chosen date for due dates, and the real time for timestamps', async () => {
    const { store } = await openWith(createClock(() => real))
    store.setToday('2026-12-25')
    answer(store, 'c1', false)
    expect(conceptOf(store, 'c1')).toMatchObject({ box: 1, due: '2026-12-26' })
    expect(conceptOf(store, 'c1').history[0].at).toBe(real.toISOString())
  })

  test('a chosen date makes a concept due, so review can be tried without waiting', async () => {
    const { store } = await openWith(createClock(() => real))
    answer(store, 'c1', false)
    store.setToday('2026-09-20')
    answer(store, 'c1', true)
    expect(conceptOf(store, 'c1')).toMatchObject({ box: 2, due: '2026-09-23' })
  })

  test('setting the date that is already in effect changes nothing', async () => {
    const { store } = await openWith(createClock(() => real))
    const { calls } = listener(store)
    store.setToday(null)
    store.setToday('2026-09-19')
    expect(calls).not.toHaveBeenCalled()
  })

  test('in a production build it does nothing at all', async () => {
    vi.stubEnv('DEV', false)
    const { store } = await openWith(createClock(() => real))
    const snapshot = store.getSnapshot()
    const { calls } = listener(store)

    store.setToday('2030-01-01')
    expect(store.getSnapshot()).toBe(snapshot)
    expect(store.getSnapshot().today).toBe('2026-09-19')
    expect(calls).not.toHaveBeenCalled()

    answer(store, 'c1', false)
    expect(conceptOf(store, 'c1').due).toBe('2026-09-20')
  })
})

describe('when IndexedDB cannot be opened', () => {
  const failures: [reason: string, arrange: () => Promise<unknown>, open: () => Promise<StudyDb>][] = [
    ['the browser holds a newer version of the database', () => openDB('study', 2), openStudyDb],
    ['the open request fails', async () => {}, () => Promise.reject(new Error('blocked'))],
    [
      'opening throws',
      async () => {},
      () => {
        throw new DOMException('insecure', 'SecurityError')
      },
    ],
  ]

  test.each(failures)('the store keeps working in memory when %s', async (_reason, arrange, open) => {
    await arrange()
    const store = await openProgressStore(fakeClock(), open)

    expect(store.getSnapshot().persistent).toBe(false)
    expect(store.getSnapshot().concepts.size).toBe(0)

    answer(store, 'c1', false)
    answer(store, 'c2', true)
    store.markRead(BOOK, chapter, 's1')
    expect(conceptOf(store, 'c1').box).toBe(1)
    expect(sectionOf(store, 's1')).toMatchObject({ readAt: T1, completedAt: T1 })
    expect(isSectionUnlocked(BOOK, chapter, 1, store.getSnapshot())).toBe(true)

    await store.flush()
    await store.resetBook(BOOK)
    expect(store.getSnapshot().concepts.size).toBe(0)
  })

  test('there is no IndexedDB at all', async () => {
    vi.stubGlobal('indexedDB', undefined)
    const store = await openProgressStore(fakeClock())
    expect(store.getSnapshot().persistent).toBe(false)
    answer(store, 'c1', true)
    expect(conceptOf(store, 'c1').history).toHaveLength(1)
  })

  test('nothing is written to the newer database', async () => {
    const newer = await openDB('study', 2)
    const store = await openProgressStore(fakeClock())
    answer(store, 'c1', false)
    await store.flush()
    expect([...newer.objectStoreNames]).toEqual([])
    expect(newer.version).toBe(2)
  })

  test('export and import still work, so progress can be saved by hand', async () => {
    const store = await openProgressStore(fakeClock(), () => Promise.reject(new Error('blocked')))
    answer(store, 'c1', false)
    const file = JSON.stringify(store.exportData())

    const other = await openProgressStore(fakeClock(), () => Promise.reject(new Error('blocked')))
    expect(await other.importProgress(file)).toEqual({ ok: true, concepts: 1, sections: 0 })
    expect(held(other)).toEqual(held(store))
  })

  test('a database that opens but cannot be read is closed, and the store falls back to memory', async () => {
    const close = vi.fn()
    const unreadable = {
      transaction() {
        throw new Error('cannot read')
      },
      close,
    } as unknown as StudyDb
    const store = await openProgressStore(fakeClock(), () => Promise.resolve(unreadable))
    expect(close).toHaveBeenCalled()
    expect(store.getSnapshot().persistent).toBe(false)
  })

  test('the working database gives a store that is saving', async () => {
    const store = await openProgressStore(fakeClock())
    expect(store.getSnapshot().persistent).toBe(true)
    answer(store, 'c1', false)
    await store.flush()
    expect((await stored()).concepts).toHaveLength(1)
  })
})

describe('when a write fails', () => {
  test('memory stays right, the store says progress is no longer saved, and it keeps working', async () => {
    const { store, db } = await open()
    answer(store, 'c1', false)
    await store.flush()
    const { calls } = listener(store)

    db.close() // the browser dropped the connection
    answer(store, 'c2', true)
    expect(conceptOf(store, 'c2').history).toHaveLength(1)
    expect(store.getSnapshot().persistent).toBe(true)

    await store.flush()
    expect(store.getSnapshot().persistent).toBe(false)
    expect(calls).toHaveBeenCalledTimes(2) // the answer, then the change in `persistent`
    expect(conceptOf(store, 'c2').history).toHaveLength(1)

    answer(store, 'c1', true)
    expect(conceptOf(store, 'c1').history).toHaveLength(2)
    await expect(store.flush()).resolves.toBeUndefined()
  })

  test('what was saved before the failure is still in the database', async () => {
    const { store, db } = await open()
    answer(store, 'c1', false)
    await store.flush()
    db.close()
    answer(store, 'c2', true)
    await store.flush()
    expect((await stored()).concepts.map((r) => r.key)).toEqual(['b/c1'])
  })

  test('a failed import or reset leaves memory changed and reports that progress is not saved', async () => {
    const { store, db } = await open()
    answer(store, 'c1', false)
    await store.flush()
    const file = JSON.stringify(store.exportData())
    db.close()

    await store.resetBook(BOOK)
    expect(store.getSnapshot().concepts.size).toBe(0)
    expect(store.getSnapshot().persistent).toBe(false)

    expect(await store.importProgress(file)).toMatchObject({ ok: true })
    expect(store.getSnapshot().concepts.size).toBe(1)
  })
})

describe('flush', () => {
  test('resolves when there is nothing to write', async () => {
    const { store } = await open()
    await expect(store.flush()).resolves.toBeUndefined()
  })

  test('waits for every write, including writes started while it waits', async () => {
    const { store } = await open()
    for (let i = 0; i < 20; i++) answer(store, i % 2 ? 'c1' : 'c2', i % 3 === 0)
    const done = store.flush()
    answer(store, 'c3', true)
    await done
    await store.flush()
    expect(await stored()).toEqual(held(store))
  })
})
