import { describe, expect, test } from 'vitest'
import { answeredRecord, book, chapter, conceptRecord, records, section } from '../test-helpers'
import { dueConcepts } from './due'
import type { Box, ConceptRecord } from './records'

const TODAY = '2026-09-19'

function queued(bookId: string, conceptId: string, due: string, box: Box = 1): ConceptRecord {
  return conceptRecord(bookId, conceptId, { box, due })
}

function ids(items: ReturnType<typeof dueConcepts>): string[] {
  return items.map((item) => `${item.book.id}/${item.concept.id}`)
}

// Two books. Concept ids inside a book are deliberately not in alphabetical order.
const books = [
  book('alpha', [
    chapter('ch1', [section('s1', ['zeta', 'beta']), section('s2', ['mu'])]),
    chapter('ch2', [section('s3', ['aa'])]),
  ]),
  book('beta', [chapter('ch1', [section('s1', ['zeta', 'kappa'])])]),
]

describe('dueConcepts', () => {
  test('lists the concepts whose due date is today or earlier', () => {
    const list = dueConcepts(
      books,
      records([queued('alpha', 'zeta', '2026-09-18'), queued('alpha', 'beta', '2026-09-19'), queued('alpha', 'mu', '2026-09-20')]),
      TODAY,
    )
    expect(ids(list)).toEqual(['alpha/zeta', 'alpha/beta'])
  })

  test('leaves out concepts that are not in the queue or were never answered', () => {
    const list = dueConcepts(
      books,
      records([conceptRecord('alpha', 'zeta', { box: null, due: null }), answeredRecord('alpha', 'beta'), queued('alpha', 'mu', '2026-09-01')]),
      TODAY,
    )
    expect(ids(list)).toEqual(['alpha/mu'])
  })

  test('gives each entry its book, chapter, section, concept and record', () => {
    const record = queued('alpha', 'aa', '2026-09-01', 3)
    const [item] = dueConcepts(books, records([record]), TODAY)
    expect(item.book).toBe(books[0])
    expect(item.chapter).toBe(books[0].chapters[1])
    expect(item.section).toBe(books[0].chapters[1].sections[0])
    expect(item.concept).toBe(books[0].chapters[1].sections[0].concepts[0])
    expect(item.record).toBe(record)
  })

  test('puts the earliest due date first, across books', () => {
    const list = dueConcepts(
      books,
      records([queued('alpha', 'zeta', '2026-09-15'), queued('beta', 'kappa', '2026-09-10'), queued('alpha', 'mu', '2026-09-12')]),
      TODAY,
    )
    expect(ids(list)).toEqual(['beta/kappa', 'alpha/mu', 'alpha/zeta'])
  })

  test('orders dates as dates, not by their day of the month', () => {
    const list = dueConcepts(
      books,
      records([queued('alpha', 'zeta', '2026-09-05'), queued('alpha', 'beta', '2026-08-28'), queued('alpha', 'mu', '2025-12-31')]),
      TODAY,
    )
    expect(ids(list)).toEqual(['alpha/mu', 'alpha/beta', 'alpha/zeta'])
  })

  test('breaks ties in content order: book, chapter, section, then concept order in the file', () => {
    const due = '2026-09-10'
    const all = [
      queued('beta', 'kappa', due),
      queued('alpha', 'aa', due),
      queued('beta', 'zeta', due),
      queued('alpha', 'mu', due),
      queued('alpha', 'beta', due),
      queued('alpha', 'zeta', due),
    ]
    const expected = ['alpha/zeta', 'alpha/beta', 'alpha/mu', 'alpha/aa', 'beta/zeta', 'beta/kappa']
    expect(ids(dueConcepts(books, records(all), TODAY))).toEqual(expected)
    // The order the records were stored in doesn't matter.
    expect(ids(dueConcepts(books, records([...all].reverse()), TODAY))).toEqual(expected)
  })

  test('a due date beats content order, and content order only decides among equal dates', () => {
    const list = dueConcepts(
      books,
      records([queued('alpha', 'zeta', '2026-09-12'), queued('beta', 'zeta', '2026-09-11'), queued('alpha', 'aa', '2026-09-12')]),
      TODAY,
    )
    expect(ids(list)).toEqual(['beta/zeta', 'alpha/zeta', 'alpha/aa'])
  })

  test('the same concept id in two books is two concepts', () => {
    const list = dueConcepts(books, records([queued('beta', 'zeta', '2026-09-01')]), TODAY)
    expect(ids(list)).toEqual(['beta/zeta'])
  })

  test('never lists records of concepts or books that are no longer in the content', () => {
    const list = dueConcepts(
      books,
      records([queued('alpha', 'removed', '2026-09-01'), queued('deleted-book', 'zeta', '2026-09-01'), queued('alpha', 'mu', '2026-09-02')]),
      TODAY,
    )
    expect(ids(list)).toEqual(['alpha/mu'])
  })

  test('depends on the date it is given, so a simulated day changes what is due', () => {
    const progress = records([queued('alpha', 'zeta', '2026-09-20'), queued('alpha', 'mu', '2026-10-01')])
    expect(dueConcepts(books, progress, '2026-09-19')).toEqual([])
    expect(ids(dueConcepts(books, progress, '2026-09-20'))).toEqual(['alpha/zeta'])
    expect(ids(dueConcepts(books, progress, '2026-10-05'))).toEqual(['alpha/zeta', 'alpha/mu'])
  })

  test('is empty when there is no progress or no content', () => {
    expect(dueConcepts(books, records(), TODAY)).toEqual([])
    expect(dueConcepts([], records([queued('alpha', 'zeta', '2026-09-01')]), TODAY)).toEqual([])
  })
})
