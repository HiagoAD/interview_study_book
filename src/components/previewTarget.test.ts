import { expect, test } from 'vitest'
import { previewTarget, sectionLead } from './previewTarget'
import { book, chapter, entry, section } from '../test-helpers'

const library = [
  book('unity', [chapter('one', [section('s1', ['c1']), section('s2', ['c2'])])], [entry('strategy', { term: 'Strategy' })]),
  book('other', [chapter('two', [section('s3', ['c3'])])]),
]

test('a term link resolves to its book and entry', () => {
  const target = previewTarget('#/g/unity/strategy', library)
  expect(target).toMatchObject({ kind: 'term' })
  expect(target?.kind === 'term' && target.entry.term).toBe('Strategy')
})

test('a section link resolves to its chapter, section and place in the chapter', () => {
  const target = previewTarget('#/b/unity/one/s2', library)
  expect(target).toMatchObject({ kind: 'section', index: 1 })
  expect(target?.kind === 'section' && [target.chapter.id, target.section.id]).toEqual(['one', 's2'])
})

test('a link to something the book does not have previews nothing', () => {
  expect(previewTarget('#/g/unity/missing', library)).toBeNull()
  expect(previewTarget('#/g/missing/strategy', library)).toBeNull()
  expect(previewTarget('#/b/unity/one/missing', library)).toBeNull()
  expect(previewTarget('#/b/unity/missing/s1', library)).toBeNull()
  // The glossary belongs to one book, so another book's term is not reachable from here.
  expect(previewTarget('#/g/other/strategy', library)).toBeNull()
})

test('an ordinary route, a footnote link and no href preview nothing', () => {
  expect(previewTarget('#/b/unity', library)).toBeNull()
  expect(previewTarget('#/b/unity/one', library)).toBeNull()
  expect(previewTarget('#/review', library)).toBeNull()
  expect(previewTarget('#user-content-fn-1', library)).toBeNull()
  expect(previewTarget(null, library)).toBeNull()
})

test('the lead is the inside of the opening paragraph, with its inline markup kept', () => {
  expect(sectionLead('<p>A <code>Wallet</code> keeps its own rules.</p>\n<p>Second.</p>')).toBe(
    'A <code>Wallet</code> keeps its own rules.',
  )
})

test('a section that does not open with a paragraph has no lead', () => {
  expect(sectionLead('<h3>Heading</h3>\n<p>Text.</p>')).toBe('')
  expect(sectionLead('<ul>\n<li>One</li>\n</ul>')).toBe('')
  expect(sectionLead('')).toBe('')
})

test('a paragraph split over lines is still one lead', () => {
  expect(sectionLead('<p>One line,\nand its second.</p>')).toBe('One line,\nand its second.')
})
