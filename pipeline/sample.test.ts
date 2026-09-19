import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from 'vitest'
import { findContentFiles, loadContent, summarize } from './load.ts'

const root = path.resolve(import.meta.dirname, '..')
const SAMPLE = 'content/sample'

// The sample book is the fixture for the manual checks in Phases 5 and 6. It is scaffolding, so
// deleting it is fine; these tests only guard it while it exists.
test.skipIf(!existsSync(path.join(root, SAMPLE)))('the sample book renders cleanly and shows every feature the later phases test by hand', async () => {
  const { books, errors } = await loadContent(root, SAMPLE)
  expect(errors).toEqual([])
  expect(summarize(books)).toMatchObject({ books: 1, chapters: 2, sections: 5 })

  const [book] = books
  const sections = book.chapters.flatMap((chapter) => chapter.sections)
  const variants = sections.flatMap((section) => section.concepts.flatMap((concept) => concept.variants))

  expect(new Set(variants.map((variant) => variant.type))).toEqual(new Set(['mc', 'multi', 'tf', 'short']))
  expect(variants.some((variant) => variant.type === 'mc' && variant.n === 5)).toBe(true)
  expect(sections.some((section) => section.concepts.some((concept) => concept.variants.length > 1))).toBe(true)
  expect(variants.some((variant) => variant.prompt.includes('<pre class="shiki'))).toBe(true)

  const html = sections.map((section) => section.html).join('\n')
  expect(html).toContain('class="katex-display"')
  expect(html).toContain('<span class="katex">')
  expect(html).toContain('<img src="data:image/svg+xml;base64,')
  expect(html.match(/<pre class="shiki /g)!.length).toBeGreaterThanOrEqual(2)

  // One chapter comes from front matter and the other from a "# Title" line, and both must stay.
  const files = findContentFiles(root, SAMPLE).map((file) => readFileSync(path.join(root, file), 'utf8'))
  expect(files.filter((text) => /^chapter: /m.test(text))).toHaveLength(1)
  expect(files.filter((text) => /^# /m.test(text))).toHaveLength(1)
  const languages = new Set(files.flatMap((text) => [...text.matchAll(/^```(\w+)/gm)].map((match) => match[1])))
  expect(languages.size).toBeGreaterThanOrEqual(2)
})
