import { expect, test } from 'vitest'
import { parseContentFile } from './parse.ts'

const FM = ['---', 'book: test', 'chapter: Intro', '---'] // lines 1-4
const SEC = ['## Sec {#sec}', 'Some content.'] // lines 5-6
const MC = ['?? q1 Question?', '* right', '- wrong', '> because']
const ROOF = ['---', 'book: test', '---'] // front matter with no chapter, lines 1-3
/** A valid file whose question block starts on line 7. */
const q = (...body: string[]) => [...FM, ...SEC, ...body]

type Case = [name: string, lines: string[], expected: [line: number, fragment: string][]]

const cases: Case[] = [
  // Front matter
  ['front matter missing', ['# Ch', ...SEC, ...MC], [[1, 'front matter is required']]],
  ['front matter not closed', ['---', 'book: test', '# Ch', ...SEC, ...MC], [[1, 'front matter is not closed']]],
  ['front matter line without a colon', [...ROOF.slice(0, 2), 'chapter Intro', '---', '# Ch', ...SEC, ...MC], [[3, 'expected "key: value"']]],
  ['unknown front matter key', [...ROOF.slice(0, 2), 'author: Me', '---', '# Ch', ...SEC, ...MC], [[3, 'unknown front matter key "author"']]],
  ['front matter key twice', ['---', 'book: a', 'book: b', '---', '# Ch', ...SEC, ...MC], [[3, 'appears twice']]],
  ['front matter key without a value', [...ROOF.slice(0, 2), 'chapter:', '---', '# Ch', ...SEC, ...MC], [[3, 'write "chapter: <title>"']]],
  ['front matter without a book', ['---', 'chapter: Intro', '---', ...SEC, ...MC], [[1, 'add "book: <book-id>"']]],
  [
    'book title where the book id goes',
    ['---', 'book: System Design', 'chapter: Intro', '---', ...SEC, ...MC],
    [[2, 'invalid book id "System Design": use lowercase letters, digits and single hyphens; write "book: system-design", and give the name the site shows as "title: <book title>"']],
  ],
  ['book id without letters or digits', ['---', 'book: !!!', 'chapter: Intro', '---', ...SEC, ...MC], [[2, 'write "book: <book-id>"']]],
  ['chapter title without letters or digits', [...ROOF.slice(0, 2), 'chapter: !!!', '---', '# Ch', ...SEC, ...MC], [[3, '"chapter" needs at least one letter or digit']]],
  ['file with only front matter', ROOF, [[1, 'the file has no sections']]],

  // Chapters and sections
  ['section before any chapter', [...ROOF, ...SEC, ...MC], [[4, 'not inside a chapter']]],
  ['text before the first section', [...FM, 'Some text.', ...SEC, ...MC], [[5, 'text between chapter "Intro" and its first section']]],
  ['text before the first chapter', [...ROOF, 'Some text.', '# Ch', ...SEC, ...MC], [[4, 'text before the first chapter']]],
  ['code fence before the first section', [...FM, '```', 'x', '```', ...SEC, ...MC], [[5, 'text between chapter']]],
  ['chapter heading without a title', [...ROOF, '#', ...SEC, ...MC], [[4, 'the chapter heading has no title']]],
  ['chapter title without letters or digits', [...ROOF, '# !!!', ...SEC, ...MC], [[4, 'at least one letter or digit']]],
  ['chapter without sections', [...ROOF, '# One', '# Two', ...SEC, ...MC], [[4, 'chapter "One" has no sections']]],
  ['front matter chapter without sections', [...FM, '# Two', ...SEC, ...MC], [[3, 'chapter "Intro" has no sections']]],
  ['section heading without an id', [...FM, '## Sec', 'Some content.', ...MC], [[5, 'write "## Sec {#sec}"']]],
  ['section id with bad characters', [...FM, '## Sec {#Bad_Id}', 'Some content.', ...MC], [[5, 'write "## Sec {#bad-id}"']]],
  ['section id empty', [...FM, '## Sec {#}', 'Some content.', ...MC], [[5, 'invalid section id ""']]],
  ['section heading without a title', [...FM, '## {#sec}', 'Some content.', ...MC], [[5, 'the section heading has no title']]],
  ['section heading empty', [...FM, '##', 'Some content.', ...MC], [[5, 'the section heading is empty']]],
  ['section without content', [...FM, '## Sec {#sec}', ...MC], [[5, 'this section has no content']]],
  ['section without questions', [...FM, ...SEC], [[5, 'this section has no questions']]],

  // Question block structure
  ['?+ before any ??', q('?+ Another?', '* a', '- b', '> c'), [[7, '"?+" adds a variant to the concept above it']]],
  ['?+ in a later section', [...FM, ...SEC, ...MC, '## Two {#two}', 'More.', '?+ Another?', '* a', '- b', '> c'], [[13, '"?+" adds a variant to the concept above it']]],
  ['stray text after a variant', q(...MC, 'stray text'), [[11, 'unexpected line "stray text"']]],
  ['### heading in the question block', q(...MC, '### Deep'), [[11, 'unexpected line "### Deep"']]],
  ['marker without a space', q('?? q1 Question?', '*right', '- wrong', '> because'), [[7, '"* correct option"'], [8, 'unexpected line "*right"']]],
  ['indented marker', q('?? q1 Question?', '  * right', '- wrong', '> because'), [[7, '"* correct option"'], [8, 'markers must start at the first column']]],
  ['unclosed fence in the content', [...FM, '## Sec {#sec}', '```python', 'x = 1'], [[6, 'never closed']]],
  ['unclosed fence in a prompt', q('?? q1 Question?', '```py', 'x'), [[8, 'never closed']]],
  ['unclosed tilde fence', [...FM, '## Sec {#sec}', '~~~~', 'x'], [[6, 'containing only ~~~~']]],
  ['fence not directly after a prompt', q('?? q1 Question?', '* right', '```', 'code', '```', '- wrong', '> because'), [[9, 'only allowed directly after a "??" or "?+" line']]],
  ['blank line between a prompt and its fence', q('?? q1 Question?', '', '```', 'code', '```', '* right', '- wrong', '> because'), [[9, 'only allowed directly after']]],

  // Marker lines
  ['?? without a concept id', q('?? [tf] Is it?', '* true', '> because'), [[7, 'the concept id is missing']]],
  ['bare ??', q('??', '* right', '- wrong', '> because'), [[7, 'the concept id is missing'], [7, 'the prompt is empty']]],
  ['concept id with bad characters', q('?? Bad_ID Question?', '* right', '- wrong', '> because'), [[7, 'invalid concept id "Bad_ID": use lowercase letters, digits and single hyphens, e.g. "bad-id"']]],
  ['?? without a prompt', q('?? q1', '* right', '- wrong', '> because'), [[7, 'the prompt is empty']]],
  ['?+ without a prompt', q(...MC, '?+ [tf]', '* true', '> because'), [[11, 'the prompt is empty']]],
  ['unknown setting', q('?? q1 [fast] Question?', '* right', '- wrong', '> because'), [[7, 'unknown setting "fast"']]],
  ['settings bracket not closed', q('?? q1 [multi Question?', '* right', '- wrong', '> because'), [[7, 'settings bracket is not closed']]],
  ['two types in the settings', q('?? q1 [tf short] Question?', '* true', '> because'), [[7, 'more than one type']]],
  ['n below the range', q('?? q1 [n=1] Question?', ...MC.slice(1)), [[7, 'invalid setting "n=1"']]],
  ['n above the range', q('?? q1 [n=10] Question?', ...MC.slice(1)), [[7, 'invalid setting "n=10"']]],
  ['n not a number', q('?? q1 [n=abc] Question?', ...MC.slice(1)), [[7, 'invalid setting "n=abc"']]],
  ['n set twice', q('?? q1 [n=3 n=4] Question?', ...MC.slice(1)), [[7, 'n is set twice']]],
  ['n on a tf variant', q('?? q1 [tf n=3] Question?', '* true', '> because'), [[7, '"n=" only applies to multiple choice and [multi], not [tf]']]],
  ['n on a short variant', q('?? q1 [short n=3] Question?', '= a', '> because'), [[7, 'not [short]']]],

  // Variant contents
  ['variant without an explanation', q('?? q1 Question?', '* right', '- wrong'), [[7, 'no explanation']]],
  ['explanation that is only a bare >', q('?? q1 Question?', '* right', '- wrong', '>'), [[7, 'no explanation']]],
  ['second explanation block', q(...MC, '', '> again'), [[12, 'already has an explanation (line 10)']]],
  ['empty correct option', q('?? q1 Question?', '*', '- wrong', '> because'), [[7, '"* correct option"'], [8, 'write "* text"']]],
  ['empty wrong option', q('?? q1 Question?', '* right', '- ', '> because'), [[7, '"- wrong option"'], [9, 'write "- text"']]],
  ['mc without a correct option', q('?? q1 Question?', '- wrong', '> because'), [[7, 'needs at least one "* correct option"']]],
  ['mc without a wrong option', q('?? q1 Question?', '* right', '> because'), [[7, 'needs at least one "- wrong option"']]],
  ['mc with an = line', q(...MC, '= x'), [[11, '"=" answers only apply to [short]']]],
  ['multi without a correct option', q('?? q1 [multi] Question?', '- wrong', '> because'), [[7, 'a [multi] variant needs at least one "* correct option"']]],
  ['multi with an = line', q('?? q1 [multi] Question?', '* right', '= x', '> because'), [[9, '"=" answers only apply to [short]']]],
  ['tf without an answer', q('?? q1 [tf] Question?', '> because'), [[7, 'needs one line, "* true" or "* false"']]],
  ['tf with two * lines', q('?? q1 [tf] Question?', '* true', '* false', '> because'), [[9, 'exactly one "*" line']]],
  ['tf answer that is not true or false', q('?? q1 [tf] Question?', '* yes', '> because'), [[8, 'must be "* true" or "* false", got "* yes"']]],
  ['tf with a - line', q('?? q1 [tf] Question?', '* true', '- false', '> because'), [[9, 'no "-" lines']]],
  ['tf with an = line', q('?? q1 [tf] Question?', '* true', '= true', '> because'), [[9, '"=" answers only apply to [short]']]],
  ['short without an accepted answer', q('?? q1 [short] Question?', '> because'), [[7, 'at least one accepted answer']]],
  ['short whose = line has only separators', q('?? q1 [short] Question?', '=  | ', '> because'), [[7, 'at least one accepted answer']]],
  ['short with a * line', q('?? q1 [short] Question?', '= a', '* b', '> because'), [[9, 'not "*" options']]],
  ['short with a - line', q('?? q1 [short] Question?', '= a', '- b', '> because'), [[9, 'not "-" options']]],
]

test.each(cases)('%s', (_name, lines, expected) => {
  const { errors } = parseContentFile('content/t.md', lines.join('\n'))
  const report = errors.map((e) => `${e.file}:${e.line}: ${e.message}`).join('\n')

  expect(errors.map((e) => e.line), report).toEqual(expected.map(([line]) => line))
  errors.forEach((error, i) => {
    expect(error.file).toBe('content/t.md')
    expect(error.message, report).toContain(expected[i][1])
  })
})

test('an unexpected line lists every valid marker', () => {
  const { errors } = parseContentFile('content/t.md', q(...MC, 'stray text').join('\n'))
  for (const marker of ['?? <concept-id> [settings] <prompt>', '?+ [settings] <prompt>', '* correct option', '- wrong option', '= answer | another answer', '> explanation']) {
    expect(errors[0].message).toContain(marker)
  }
})

test('every problem in a file is reported, in line order', () => {
  const { errors } = parseContentFile(
    'content/t.md',
    [...FM, '## Bad {#Bad}', 'Text.', '?? q1 [fast] Question?', '* right', '## Empty {#empty}', ...MC, '= x', 'stray'].join('\n'),
  )
  // 5: bad section id; 7 (x3): unknown setting, no explanation, no wrong option; 9: no content; 14: "=" in mc; 15: stray line
  expect(errors.map((e) => e.line)).toEqual([5, 7, 7, 7, 9, 14, 15])
})
