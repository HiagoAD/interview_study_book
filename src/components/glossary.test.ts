import { expect, test } from 'vitest'
import { appearances, matchesTerm, normalizeTerm } from './glossary'
import type { GlossaryEntry } from '../types/content'
import { book, chapter, entry, section, records, sectionRecord } from '../test-helpers'

const pool = (over: Partial<GlossaryEntry> = {}) => entry('object-pool', { term: 'Object pool', names: ['pool', 'pooling'], ...over })

test('an empty query matches every term', () => {
  expect(matchesTerm(pool(), '')).toBe(true)
  expect(matchesTerm(pool(), '   ')).toBe(true)
})

test('a term matches part of its own name, ignoring case', () => {
  expect(matchesTerm(pool(), 'OBJECT')).toBe(true)
  expect(matchesTerm(pool(), 'ct po')).toBe(true)
  expect(matchesTerm(pool(), 'mutex')).toBe(false)
})

test('a term matches part of any of its other names', () => {
  expect(matchesTerm(pool(), 'pooling')).toBe(true)
  expect(matchesTerm(pool({ names: [] }), 'pooling')).toBe(false)
})

test('spaces and hyphens are the same to the filter, so "object-pool" finds "Object pool"', () => {
  expect(matchesTerm(pool(), 'object-pool')).toBe(true)
  expect(matchesTerm(pool({ term: 'Write-through cache' }), 'write through')).toBe(true)
  expect(normalizeTerm('  Write--through   cache ')).toBe('write through cache')
})

const library = book('b', [
  chapter('one', [section('s1', ['c1']), section('s2', ['c2'])]),
  chapter('two', [section('s3', ['c3'])]),
])

test('appearances resolve to their chapter and section, in the order the entry lists them', () => {
  const term = entry('t', { uses: [{ chapter: 'two', section: 's3' }, { chapter: 'one', section: 's1' }] })
  expect(appearances(library, term, records()).map((place) => [place.chapter.id, place.section.id])).toEqual([
    ['two', 's3'],
    ['one', 's1'],
  ])
})

test('the first section of a chapter is unlocked and has no section before it', () => {
  const term = entry('t', { uses: [{ chapter: 'one', section: 's1' }] })
  const [place] = appearances(library, term, records())
  expect(place).toMatchObject({ unlocked: true, previous: null })
})

test('a later section is locked until the one before it is done, and names it', () => {
  const term = entry('t', { uses: [{ chapter: 'one', section: 's2' }] })
  const [locked] = appearances(library, term, records())
  expect(locked.unlocked).toBe(false)
  expect(locked.previous?.id).toBe('s1')

  const read = records([], [sectionRecord('b', 's2', { readAt: '2026-01-01T00:00:00.000Z' })])
  expect(appearances(library, term, read)[0].unlocked).toBe(true)
})

test('a section the book no longer has is left out rather than breaking the list', () => {
  const term = entry('t', { uses: [{ chapter: 'one', section: 'gone' }, { chapter: 'nowhere', section: 's1' }, { chapter: 'one', section: 's1' }] })
  expect(appearances(library, term, records()).map((place) => place.section.id)).toEqual(['s1'])
})
