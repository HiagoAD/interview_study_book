import { expect, test } from 'vitest'
import { totalsLines } from './check.ts'
import { assembleBooks } from './load.ts'

const chapter = (book: string, title: string, ...sections: string[]) => ({
  path: `content/${book.toLowerCase()}/${title.toLowerCase()}.md`,
  text: ['---', `book: ${book}`, `chapter: ${title}`, '---', ...sections].join('\n'),
})

const section = (id: string, ...concepts: string[]) => [`## ${id} {#${id}}`, 'Text.', '', ...concepts].join('\n')

const concept = (id: string, variants = 1) =>
  [`?? ${id} Which?`, '* yes', '- no', '> Yes.', ...Array.from({ length: variants - 1 }, () => ['?+ [tf] True?', '* true', '> Yes.'].join('\n'))].join('\n')

test('check prints the sums, then each book on its own line in book order, singular where a count is one', () => {
  const { books, errors } = assembleBooks([
    chapter('Second Book', 'Only', section('s1', concept('c1', 3))),
    chapter('First Book', 'Opening', section('a', concept('a1'), concept('a2', 2)), section('b', concept('b1'))),
    chapter('First Book', 'Closing', section('c', concept('c1'))),
  ])
  expect(errors).toEqual([])
  expect(totalsLines(books)).toEqual([
    '  books     2',
    '  chapters  3',
    '  sections  4',
    '  concepts  5',
    '  variants  8',
    '  terms     0',
    '  links     0',
    '',
    '  first-book   2 chapters, 3 sections, 4 concepts, 5 variants, 0 terms, 0 links',
    '  second-book  1 chapter, 1 section, 1 concept, 3 variants, 0 terms, 0 links',
  ])
})

test('with no books, check prints only the sums', () => {
  expect(totalsLines([])).toEqual(['  books     0', '  chapters  0', '  sections  0', '  concepts  0', '  variants  0', '  terms     0', '  links     0'])
})
