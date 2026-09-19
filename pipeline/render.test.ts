import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test, vi } from 'vitest'
import { renderMarkdown, renderOption } from './render.ts'
import { tempRepo } from './test-helpers.ts'

// Both call through to the real thing, so rendering works as usual; they only count the calls.
vi.mock('shiki', async (importOriginal) => {
  const actual = await importOriginal<typeof import('shiki')>()
  return { ...actual, createHighlighter: vi.fn(actual.createHighlighter) }
})
vi.mock('unified', async (importOriginal) => {
  const actual = await importOriginal<typeof import('unified')>()
  // `unified` is a callable object, not a function, so vi.fn cannot wrap it directly.
  return { ...actual, unified: vi.fn(() => actual.unified()) }
})

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><circle cx="1" cy="1" r="1"/></svg>'
const BYTES = Uint8Array.from([1, 2, 3, 250, 251, 252])

const root = () =>
  tempRepo({
    'content/book/images/dot.svg': SVG,
    'content/book/images/photo.PNG': BYTES,
    'content/book/images/photo.jpg': BYTES,
    'content/book/images/anim.gif': BYTES,
    'content/book/images/wide.webp': BYTES,
    'content/book/images/notes.txt': 'not an image',
    'content/book/deep/images/inner.png': BYTES,
    'content/shared/logo.png': BYTES,
    'outside.png': BYTES,
  })

const context = (repo: string, file = 'content/book/a.md') => ({ root: repo, dir: 'content', file })
const chunk = (md: string, line = 1) => ({ md, line })

function dataUriBytes(html: string, prefix: string): Buffer {
  const start = html.indexOf(`src="${prefix}`)
  expect(start, `an <img> with a ${prefix} URI in ${html}`).toBeGreaterThanOrEqual(0)
  const from = start + `src="${prefix}`.length
  return Buffer.from(html.slice(from, html.indexOf('"', from)), 'base64')
}

test('inline and display math render with KaTeX', async () => {
  const { html, errors } = await renderMarkdown(chunk('Inline $x^2$ here.\n\n$$\ny = \\frac{a}{b}\n$$\n'), context(root()))
  expect(errors).toEqual([])
  expect(html).toContain('<span class="katex">')
  expect(html).toContain('class="katex-display"')
  expect(html).toContain('katex-mathml')
})

test('math opened with $$ is display math on one line too, as PROJECT.md writes it', async () => {
  const repo = root()
  for (const md of ['$$ a = b $$', 'so $$a$$ here', '$$\na = b\n$$']) {
    const { html, errors } = await renderMarkdown(chunk(md), context(repo))
    expect(errors, md).toEqual([])
    expect(html, md).toContain('class="katex-display"')
  }
  const inline = await renderMarkdown(chunk('so $a$ here'), context(repo))
  expect(inline.html).not.toContain('katex-display')
})

test('an escaped dollar sign stays text', async () => {
  const { html, errors } = await renderMarkdown(chunk('It costs \\$5 and \\$6.'), context(root()))
  expect(errors).toEqual([])
  expect(html).toBe('<p>It costs $5 and $6.</p>')
})

test('fenced code in two languages is highlighted with both themes as CSS variables', async () => {
  const md = '```python\nx = 1\nprint(x)\n```\n\n```ts\nconst y: number = 2\n```\n'
  const { html, errors } = await renderMarkdown(chunk(md), context(root()))
  expect(errors).toEqual([])
  expect(html.match(/<pre class="shiki shiki-themes github-light github-dark"/g)).toHaveLength(2)
  expect(html).toContain('--shiki-light:')
  expect(html).toContain('--shiki-dark:')
  expect(html).toContain('--shiki-light-bg:')
  expect(html).toContain('--shiki-dark-bg:')
  // Two lines in the first fence and one in the second: no phantom empty line from the trailing newline.
  expect(html.match(/class="line"/g)).toHaveLength(3)
})

test('a fence with no language is a plain pre and code, and text and txt are known languages', async () => {
  const plain = await renderMarkdown(chunk('```\nplain <b>\n```\n'), context(root()))
  expect(plain.errors).toEqual([])
  expect(plain.html).toBe('<pre><code>plain &#x3C;b>\n</code></pre>')

  const text = await renderMarkdown(chunk('```text\na\n```\n\n```txt\nb\n```\n'), context(root()))
  expect(text.errors).toEqual([])
  expect(text.html.match(/class="shiki /g)).toHaveLength(2)
})

test('local images are inlined as base64 data URIs, by type', async () => {
  const repo = root()
  const cases: [string, string][] = [
    ['images/dot.svg', 'data:image/svg+xml;base64,'],
    ['images/photo.PNG', 'data:image/png;base64,'],
    ['images/photo.jpg', 'data:image/jpeg;base64,'],
    ['images/anim.gif', 'data:image/gif;base64,'],
    ['images/wide.webp', 'data:image/webp;base64,'],
  ]
  for (const [url, prefix] of cases) {
    const { html, errors } = await renderMarkdown(chunk(`![alt text](${url})`), context(repo))
    expect(errors).toEqual([])
    expect(html).toContain('alt="alt text"')
    expect(dataUriBytes(html, prefix)).toEqual(readFileSync(path.join(repo, 'content/book', url)))
  }
})

test('image paths start at the folder of the Markdown file, and may climb within content/', async () => {
  const repo = root()
  const deep = await renderMarkdown(chunk('![](images/inner.png)'), context(repo, 'content/book/deep/b.md'))
  expect(deep.errors).toEqual([])
  expect(dataUriBytes(deep.html, 'data:image/png;base64,')).toEqual(Buffer.from(BYTES))

  const up = await renderMarkdown(chunk('![](../shared/logo.png)'), context(repo))
  expect(up.errors).toEqual([])
  expect(up.html).toContain('data:image/png;base64,')
})

test('a reference-style image is inlined too', async () => {
  const { html, errors } = await renderMarkdown(chunk('![a dot][dot]\n\n[dot]: images/dot.svg'), context(root()))
  expect(errors).toEqual([])
  expect(html).toContain('alt="a dot"')
  expect(dataUriBytes(html, 'data:image/svg+xml;base64,').toString()).toBe(SVG)
})

test('a reference with no definition stays literal text', async () => {
  const { html, errors } = await renderMarkdown(chunk('![a dot][nowhere]'), context(root()))
  expect(errors).toEqual([])
  expect(html).toBe('<p>![a dot][nowhere]</p>')
})

test('bad LaTeX reports the file line of the formula, whatever the chunk offset', async () => {
  // The chunk starts at file line 20; the formula is on its 3rd line.
  const { html, errors } = await renderMarkdown(chunk('First line.\n\nSecond $\\notacommand$ here.', 20), context(root()))
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ file: 'content/book/a.md', line: 22 })
  expect(errors[0].message).toContain('invalid LaTeX: KaTeX parse error: Undefined control sequence: \\notacommand')
  expect(html).toBe('')
})

test('bad display math reports the line of its opening $$, though rehype-katex gives that node no position', async () => {
  // Chunk line 7 is the opening $$ of the formula, so file line 30 + 7 - 1.
  const md = 'a\n\nb\n\nc\n\n$$\nx = \\frac{1}{\n$$\n'
  const { errors } = await renderMarkdown(chunk(md, 30), context(root()))
  expect(errors).toHaveLength(1)
  expect(errors[0].line).toBe(36)
  expect(errors[0].message).toContain('invalid LaTeX')
})

test('bad one-line display math reports its own line', async () => {
  const { errors } = await renderMarkdown(chunk('a\n\n$$ \\bad $$', 8), context(root()))
  expect(errors.map((e) => e.line)).toEqual([10])
})

test('math KaTeX would paint red without failing is an error too', async () => {
  for (const math of ['\\href{https://example.com}{x}', '\\url{https://example.com}', '\\includegraphics{a.png}', '\\htmlClass{x}{y}']) {
    const { html, errors } = await renderMarkdown(chunk(`Text $${math}$.`, 5), context(root()))
    expect(errors, math).toHaveLength(1)
    expect(errors[0].line).toBe(5)
    expect(errors[0].message).toContain('is not allowed in math')
    expect(html).toBe('')
  }
})

test('an unknown code language reports the line of its opening fence', async () => {
  const { html, errors } = await renderMarkdown(chunk('Intro.\n\n```klingon\nqapla\n```\n', 10), context(root()))
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ file: 'content/book/a.md', line: 12 })
  expect(errors[0].message).toContain('unknown code language "klingon"')
  expect(html).toBe('')
})

test('names inherited from Object.prototype are not languages', async () => {
  for (const lang of ['constructor', 'toString', '__proto__']) {
    const { errors } = await renderMarkdown(chunk(`\`\`\`${lang}\nx\n\`\`\``), context(root()))
    expect(errors, lang).toHaveLength(1)
  }
})

test('a missing image reports the line of the image', async () => {
  const { html, errors } = await renderMarkdown(chunk('Text.\n\n![lost](images/missing.png)\n', 40), context(root()))
  expect(errors).toEqual([
    { file: 'content/book/a.md', line: 42, message: 'image file not found: "images/missing.png" (looked for content/book/images/missing.png)' },
  ])
  expect(html).toBe('')
})

test.each([
  ['a web address', '![x](https://example.com/a.png)', 'is a web address'],
  ['an http address', '![x](HTTP://example.com/a.png)', 'is a web address'],
  ['a protocol-relative address', '![x](//example.com/a.png)', 'must be relative'],
  ['an absolute path', '![x](/images/dot.svg)', 'must be relative'],
  ['a data URI', '![x](data:image/png;base64,AAAA)', 'must be relative'],
  ['a file URL', '![x](file:///etc/a.png)', 'must be relative'],
  ['no path at all', '![x]()', 'has no path'],
  ['an unsupported type', '![x](images/notes.txt)', 'unsupported image type ".txt"'],
  ['no extension', '![x](images/dot)', 'unsupported image type'],
  ['a path outside content/', '![x](../../outside.png)', 'outside the content folder'],
])('an image given as %s is an error at its line', async (_name, md, expected) => {
  const { html, errors } = await renderMarkdown(chunk(`One.\n${md}`, 3), context(root()))
  expect(errors).toHaveLength(1)
  expect(errors[0].line).toBe(4)
  expect(errors[0].message).toContain(expected)
  expect(html).toBe('')
})

test('raw HTML is an error instead of being dropped, but code may show it', async () => {
  const bad = await renderMarkdown(chunk('Fine.\n\nUse <b>bold</b> <br> here.\n\n<div>block</div>', 1), context(root()))
  // One error per line, though the line holds three tags.
  expect(bad.errors.map((e) => e.line)).toEqual([3, 5])
  expect(bad.errors[0].message).toContain('raw HTML is not supported')

  const good = await renderMarkdown(chunk('Write `<b>bold</b>`.\n\n```html\n<div>block</div>\n```\n'), context(root()))
  expect(good.errors).toEqual([])
})

test('every problem in a chunk is reported, in line order', async () => {
  const md = '```nope\nx\n```\n\n$\\bad$\n\n![](images/none.png)\n'
  const { errors } = await renderMarkdown(chunk(md, 100), context(root()))
  expect(errors.map((e) => e.line)).toEqual([100, 104, 106])
})

test('a chunk with an error never yields HTML, so KaTeX error markup cannot reach a build', async () => {
  const bad = ['$\\foo$', '$\\frac{1}{$', '$$\n\\begin{nope}\n$$', '$\\href{a}{b}$', '$\\htmlId{a}{b}$', '```klingon\nx\n```', '![](nope.png)']
  for (const md of bad) {
    const { html, errors } = await renderMarkdown(chunk(`Before.\n\n${md}\n\nAfter.`), context(root()))
    expect(errors.length, md).toBeGreaterThan(0)
    expect(html, md).toBe('')
  }
})

test('a chunk that renders cleanly has no KaTeX error markup', async () => {
  const md = 'Inline $\\alpha + \\beta$, and\n\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$\n\nwith a $\\text{unicode é}$ note.'
  const { html, errors } = await renderMarkdown(chunk(md), context(root()))
  expect(errors).toEqual([])
  expect(html).not.toMatch(/katex-error|#cc0000/)
})

test('renderOption removes a single wrapping paragraph and nothing else', async () => {
  const repo = root()
  const option = await renderOption(chunk('The `Map` type, $O(1)$'), context(repo))
  expect(option.errors).toEqual([])
  expect(option.html).toMatch(/^The <code>Map<\/code> type, <span class="katex">/)
  expect(option.html).not.toContain('<p>')

  const block = await renderMarkdown(chunk('The `Map` type'), context(repo))
  expect(block.html).toBe('<p>The <code>Map</code> type</p>')

  // Not a paragraph, so there is nothing to unwrap.
  const list = await renderOption(chunk('- an item'), context(repo))
  expect(list.html).toContain('<ul>')
})

test('option errors are reported at the option line too', async () => {
  const { html, errors } = await renderOption(chunk('bad $\\oops$', 17), context(root()))
  expect(errors.map((e) => e.line)).toEqual([17])
  expect(html).toBe('')
})

test('one highlighter and one processor serve every render, even concurrent ones', async () => {
  // Vitest clears mock calls before each test, and the renderer is created by whichever test renders
  // first, so load a fresh copy of the module (and of the mocks it imports) to watch it happen here.
  vi.resetModules()
  const { createHighlighter } = await import('shiki')
  const { unified } = await import('unified')
  const fresh = await import('./render.ts')

  const repo = root()
  await Promise.all([
    fresh.renderMarkdown(chunk('```python\nx = 1\n```'), context(repo)),
    fresh.renderMarkdown(chunk('$x$'), context(repo)),
    fresh.renderOption(chunk('a'), context(repo)),
    fresh.getRenderer(),
  ])
  await fresh.renderMarkdown(chunk('```ts\nconst a = 1\n```'), context(repo))

  expect(createHighlighter).toHaveBeenCalledTimes(1)
  expect(unified).toHaveBeenCalledTimes(1)
  expect(await fresh.getRenderer()).toBe(await fresh.getRenderer())
})
