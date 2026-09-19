import { describe, expect, test } from 'vitest'
import { answeredRecord, conceptRecord, records, section, sectionRecord } from '../test-helpers'
import { allConceptsAnswered, countCompleteSections, countInReview, isSectionComplete, isSectionUnlocked } from './sections'

const B = 'book'

// One chapter with three sections: s1 has two concepts, s2 and s3 one each.
const s1 = section('s1', ['c1', 'c2'])
const s2 = section('s2', ['c3'])
const s3 = section('s3', ['c4'])
const chapter = { sections: [s1, s2, s3] }

const none = records()
const answeredS1 = [answeredRecord(B, 'c1'), answeredRecord(B, 'c2')]

describe('section completion', () => {
  test('a section with no answers is not complete', () => {
    expect(isSectionComplete(B, s1, none)).toBe(false)
  })

  test('a section is not complete until every one of its concepts has an answer', () => {
    expect(isSectionComplete(B, s1, records([answeredRecord(B, 'c1')]))).toBe(false)
    expect(isSectionComplete(B, s1, records([answeredRecord(B, 'c2')]))).toBe(false)
    expect(isSectionComplete(B, s1, records(answeredS1))).toBe(true)
  })

  test('wrong answers count: an answered concept is answered', () => {
    expect(isSectionComplete(B, s1, records([answeredRecord(B, 'c1', false), answeredRecord(B, 'c2', false)]))).toBe(true)
  })

  test('a concept record with no history is not an answer', () => {
    expect(isSectionComplete(B, s1, records([answeredRecord(B, 'c1'), conceptRecord(B, 'c2')]))).toBe(false)
  })

  test('answers in another book do not count', () => {
    expect(isSectionComplete(B, s1, records([answeredRecord('other', 'c1'), answeredRecord('other', 'c2')]))).toBe(false)
  })

  test('a section is complete once completedAt is set, without any answers', () => {
    const completed = records([], [sectionRecord(B, 's1', { completedAt: '2026-09-01T10:00:00.000Z' })])
    expect(isSectionComplete(B, s1, completed)).toBe(true)
  })

  test('readAt alone does not complete a section', () => {
    const read = records([], [sectionRecord(B, 's1', { readAt: '2026-09-01T10:00:00.000Z' })])
    expect(isSectionComplete(B, s1, read)).toBe(false)
  })

  test('allConceptsAnswered is true only when every concept has an answer', () => {
    expect(allConceptsAnswered(B, s1, new Map())).toBe(false)
    expect(allConceptsAnswered(B, s1, records([answeredRecord(B, 'c1')]).concepts)).toBe(false)
    expect(allConceptsAnswered(B, s1, records(answeredS1).concepts)).toBe(true)
  })
})

describe('section unlocking', () => {
  test('the first section of a chapter is always open', () => {
    expect(isSectionUnlocked(B, chapter, 0, none)).toBe(true)
  })

  test('a later section is locked until something opens it', () => {
    expect(isSectionUnlocked(B, chapter, 1, none)).toBe(false)
    expect(isSectionUnlocked(B, chapter, 2, none)).toBe(false)
  })

  test('opens when every concept of the section before it has been answered', () => {
    expect(isSectionUnlocked(B, chapter, 1, records([answeredRecord(B, 'c1')]))).toBe(false)
    expect(isSectionUnlocked(B, chapter, 1, records(answeredS1))).toBe(true)
  })

  test('opens on wrong answers too: they go to review instead of blocking', () => {
    const wrong = [answeredRecord(B, 'c1', false), answeredRecord(B, 'c2', false)]
    expect(isSectionUnlocked(B, chapter, 1, records(wrong))).toBe(true)
  })

  test('opens when the section before it has completedAt', () => {
    const completed = records([], [sectionRecord(B, 's1', { completedAt: '2026-09-01T10:00:00.000Z' })])
    expect(isSectionUnlocked(B, chapter, 1, completed)).toBe(true)
  })

  test('a section that has been read stays open, whatever the section before it says', () => {
    const read = records([], [sectionRecord(B, 's2', { readAt: '2026-09-01T10:00:00.000Z' })])
    expect(isSectionUnlocked(B, chapter, 1, read)).toBe(true)
  })

  test('only the next section opens: completing one does not open the one after', () => {
    expect(isSectionUnlocked(B, chapter, 2, records(answeredS1))).toBe(false)
    expect(isSectionUnlocked(B, chapter, 2, records([...answeredS1, answeredRecord(B, 'c3')]))).toBe(true)
  })

  test('chapters are independent: the first section of every chapter is open', () => {
    const other = { sections: [section('t1', ['d1']), section('t2', ['d2'])] }
    expect(isSectionUnlocked(B, other, 0, none)).toBe(true)
    expect(isSectionUnlocked(B, other, 1, none)).toBe(false)
    expect(isSectionUnlocked(B, other, 1, records(answeredS1))).toBe(false)
  })

  test('progress in another book does not open a section', () => {
    expect(isSectionUnlocked('other', chapter, 1, records(answeredS1))).toBe(false)
  })
})

describe('unlock state after the content changes', () => {
  const completedS1 = [sectionRecord(B, 's1', { completedAt: '2026-09-01T10:00:00.000Z' })]

  test('a completed section stays completed when a concept is added to it', () => {
    const grown = section('s1', ['c1', 'c2', 'c-new'])
    const progress = records(answeredS1, completedS1)
    expect(isSectionComplete(B, grown, progress)).toBe(true)
    expect(isSectionUnlocked(B, { sections: [grown, s2, s3] }, 1, progress)).toBe(true)
  })

  test('without completedAt the same edit would undo the completion, so completedAt is what keeps it', () => {
    const grown = section('s1', ['c1', 'c2', 'c-new'])
    const progress = records(answeredS1)
    expect(isSectionComplete(B, grown, progress)).toBe(false)
    expect(isSectionUnlocked(B, { sections: [grown, s2, s3] }, 1, progress)).toBe(false)
  })

  test('a section that was read stays open when a section is inserted before it', () => {
    const inserted = section('new', ['n1'])
    const progress = records(answeredS1, [sectionRecord(B, 's2', { readAt: '2026-09-01T10:00:00.000Z' })])
    const edited = { sections: [s1, inserted, s2, s3] }
    expect(isSectionUnlocked(B, edited, 2, progress)).toBe(true)
    expect(isSectionUnlocked(B, edited, 1, progress)).toBe(true)
    expect(isSectionUnlocked(B, edited, 3, progress)).toBe(false)
  })

  test('a section that was read stays open when the sections are reordered', () => {
    const progress = records([], [sectionRecord(B, 's3', { readAt: '2026-09-01T10:00:00.000Z' })])
    expect(isSectionUnlocked(B, { sections: [s3, s2, s1] }, 0, progress)).toBe(true)
    expect(isSectionUnlocked(B, { sections: [s1, s2, s3] }, 2, progress)).toBe(true)
    expect(isSectionUnlocked(B, { sections: [s1, s3, s2] }, 1, progress)).toBe(true)
  })

  test('removing a concept leaves the section complete when the rest are answered', () => {
    const shrunk = section('s1', ['c1'])
    expect(isSectionComplete(B, shrunk, records([answeredRecord(B, 'c1')]))).toBe(true)
  })

  test('records of sections and concepts that left the content change nothing', () => {
    const stale = records(
      [answeredRecord(B, 'gone-concept')],
      [sectionRecord(B, 'gone-section', { readAt: '2026-09-01T10:00:00.000Z', completedAt: '2026-09-01T10:00:00.000Z' })],
    )
    expect(isSectionComplete(B, s1, stale)).toBe(false)
    expect(isSectionUnlocked(B, chapter, 1, stale)).toBe(false)
  })
})

describe('section counts', () => {
  test('countCompleteSections counts the sections that are complete', () => {
    expect(countCompleteSections(B, chapter.sections, none)).toBe(0)
    expect(countCompleteSections(B, chapter.sections, records(answeredS1))).toBe(1)
    expect(countCompleteSections(B, chapter.sections, records([...answeredS1, answeredRecord(B, 'c3'), answeredRecord(B, 'c4')]))).toBe(3)
  })

  test('countCompleteSections counts a section with completedAt, and ignores other books', () => {
    const completed = records([answeredRecord('other', 'c3')], [sectionRecord(B, 's2', { completedAt: '2026-09-01T10:00:00.000Z' })])
    expect(countCompleteSections(B, chapter.sections, completed)).toBe(1)
  })

  test('countCompleteSections of no sections is 0', () => {
    expect(countCompleteSections(B, [], none)).toBe(0)
  })

  test('countInReview counts concepts in any box, due or not', () => {
    const queued = records([
      conceptRecord(B, 'c1', { box: 1, due: '2026-09-20' }),
      conceptRecord(B, 'c2', { box: 5, due: '2030-01-01' }),
    ])
    expect(countInReview(B, s1, queued.concepts)).toBe(2)
  })

  test('countInReview skips concepts that never entered the queue or graduated out of it', () => {
    const progress = records([conceptRecord(B, 'c1', { box: 3, due: '2026-09-20' }), answeredRecord(B, 'c2'), conceptRecord(B, 'c3', { box: 2, due: '2026-09-20' })])
    expect(countInReview(B, s1, progress.concepts)).toBe(1)
    expect(countInReview(B, s1, none.concepts)).toBe(0)
  })

  test('countInReview ignores the same concept id in another book', () => {
    expect(countInReview(B, s1, records([conceptRecord('other', 'c1', { box: 1, due: '2026-09-20' })]).concepts)).toBe(0)
  })
})
