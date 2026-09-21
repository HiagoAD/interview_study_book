import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { expect, test, vi } from 'vitest'
import type { Book } from '../src/types/content.ts'
import { tempRepo } from './test-helpers.ts'
import { content, formatErrors, keepWoff2Only, katexWoff2Only, serialize } from './vite-plugin.ts'

const RESOLVED = '\0virtual:content'

type Hook<F> = { handler: F; filter?: { id?: RegExp } }
type Context = { error: (message: string) => never }

const validFile = (chapter: string, id = 's') =>
  ['---', 'book: T', `chapter: ${chapter}`, '---', `## ${id} {#${id}}`, 'Content.', `?? ${id}-q Question?`, '* right', '- wrong', '> because'].join('\n')
const throwing: Context = {
  error: (message) => {
    throw new Error(message)
  },
}

function pluginFor(root: string) {
  const plugin = content()
  ;(plugin.configResolved as (config: { root: string }) => void)({ root })
  return plugin
}

test('resolveId and load only answer for the virtual module', () => {
  const plugin = content()
  const resolve = plugin.resolveId as unknown as Hook<() => string>
  const load = plugin.load as unknown as Hook<unknown>

  expect(resolve.filter!.id!.test('virtual:content')).toBe(true)
  for (const other of ['virtual:contents', 'xvirtual:content', RESOLVED, './content', 'content']) {
    expect(resolve.filter!.id!.test(other), other).toBe(false)
  }
  expect(resolve.handler()).toBe(RESOLVED)

  expect(load.filter!.id!.test(RESOLVED)).toBe(true)
  for (const other of ['virtual:content', `${RESOLVED}x`, '/src/main.tsx']) {
    expect(load.filter!.id!.test(other), other).toBe(false)
  }
})

test('load returns the books as a module', async () => {
  const root = tempRepo({ 'content/a.md': validFile('One', 'a'), 'content/sub/b.md': validFile('Two', 'b') })
  const load = pluginFor(root).load as unknown as Hook<(this: Context, id: string) => Promise<string>>
  const source = await load.handler.call(throwing, RESOLVED)

  expect(source.startsWith('export const books = JSON.parse(')).toBe(true)
  const books = new Function(source.replace(/^export const /, 'const ') + '\nreturn books')() as Book[]
  expect(books.map((book) => book.id)).toEqual(['t'])
  expect(books[0].chapters.map((chapter) => chapter.title)).toEqual(['One', 'Two'])
})

test('load fails with every error listed, one file:line per line, so a build or the overlay shows them all', async () => {
  const root = tempRepo({
    'content/a.md': validFile('One', 'a').replace('Content.', 'Math $\\nope$.'),
    'content/b.md': validFile('Two', 'b').replace('## b {#b}', '## No id'),
    'content/c.md': validFile('Three', 'c').replace('Content.', '![x](images/gone.png)'),
  })
  const load = pluginFor(root).load as unknown as Hook<(this: Context, id: string) => Promise<string>>
  const error = await load.handler.call(throwing, RESOLVED).catch((caught: Error) => caught)

  expect(error).toBeInstanceOf(Error)
  const lines = (error as Error).message.split('\n')
  expect(lines[0]).toBe('3 content errors:')
  expect(lines.slice(1).map((line) => line.split(': ')[0])).toEqual(['content/a.md:6', 'content/b.md:5', 'content/c.md:6'])
})

test('formatErrors counts them', () => {
  expect(formatErrors([{ file: 'content/a.md', line: 3, message: 'bad' }])).toBe('1 content error:\ncontent/a.md:3: bad')
})

test('serialize leaves nothing that could end or confuse an inline script, and the data comes back unchanged', () => {
  const books: Book[] = [
    {
      id: 'b',
      title: 'A <b> book </script>',
      glossary: [],
      chapters: [
        {
          id: 'c',
          title: 'C',
          sections: [
            {
              id: 's',
              title: 'S',
              html: '<p>a <!-- b --> &#x3C;/script></p>',
              concepts: [{ id: 'q', variants: [{ type: 'short', prompt: '<p>Q</p>', explanation: '<p>E</p>', accepted: ['</script>', '</SCRIPT >', '<script>', '<!-- x -->', 'a\u2028b'] }] }],
            },
          ],
        },
      ],
    },
  ]
  const source = serialize(books)
  expect(source).not.toMatch(/<\/?script|<!--/i)
  expect(source).toContain('<p>Q</p>')
  const back = new Function(source.replace(/^export const /, 'const ') + '\nreturn books')()
  expect(back).toEqual(books)
})

function fakeServerEnvironment(name = 'client', known = true) {
  const module = { id: RESOLVED }
  const environment = {
    name,
    moduleGraph: { getModuleById: vi.fn((id: string) => (known && id === RESOLVED ? module : undefined)), invalidateModule: vi.fn() },
    hot: { send: vi.fn() },
    logger: { info: vi.fn() },
  }
  return { environment, module }
}

const ROOT = '/work/site'

function hotUpdate(file: string, environment = fakeServerEnvironment()) {
  const plugin = pluginFor(ROOT)
  const result = (plugin.hotUpdate as unknown as (this: unknown, options: { file: string }) => unknown).call(environment, { file })
  return { ...environment, result }
}

test.each([
  ['a Markdown file', `${ROOT}/content/sample/01-caching.md`],
  ['an SVG image', `${ROOT}/content/sample/images/lru.svg`],
  ['a PNG image with a capital extension', `${ROOT}/content/a/b/c/PIC.PNG`],
  ['a JPEG, GIF or WebP image', `${ROOT}/content/x.jpeg`],
])('a change to %s invalidates the module and reloads the page, and stops the default HMR', (_name, file) => {
  const { environment, module, result } = hotUpdate(file)
  expect(environment.moduleGraph.invalidateModule).toHaveBeenCalledExactlyOnceWith(module)
  expect(environment.hot.send).toHaveBeenCalledExactlyOnceWith({ type: 'full-reload' })
  expect(result).toEqual([])
})

test('a reload happens even when the module has not been loaded yet', () => {
  const { environment } = hotUpdate(`${ROOT}/content/new.md`, fakeServerEnvironment('client', false))
  expect(environment.moduleGraph.invalidateModule).not.toHaveBeenCalled()
  expect(environment.hot.send).toHaveBeenCalledOnce()
})

test.each([
  ['a source file', `${ROOT}/src/App.tsx`],
  ['a non-content file inside content/', `${ROOT}/content/sample/notes.txt`],
  ['a hidden file inside content/', `${ROOT}/content/.DS_Store`],
  ['a Markdown file outside content/', `${ROOT}/docs/PLAN.md`],
  ['a folder that only starts with "content"', `${ROOT}/content-notes/a.md`],
])('a change to %s is left to Vite', (_name, file) => {
  const { environment, result } = hotUpdate(file)
  expect(environment.moduleGraph.invalidateModule).not.toHaveBeenCalled()
  expect(environment.hot.send).not.toHaveBeenCalled()
  expect(result).toBeUndefined()
})

test('only the client environment is reloaded', () => {
  const { environment, result } = hotUpdate(`${ROOT}/content/a.md`, fakeServerEnvironment('ssr'))
  expect(environment.hot.send).not.toHaveBeenCalled()
  expect(result).toBeUndefined()
})

test('the dev server watches the content folder', () => {
  const add = vi.fn()
  const plugin = pluginFor(ROOT)
  ;(plugin.configureServer as unknown as (server: { watcher: { add: typeof add } }) => void)({ watcher: { add } })
  expect(add).toHaveBeenCalledExactlyOnceWith(path.resolve(ROOT, 'content'))
})

const katexCss = () => readFileSync(createRequire(import.meta.url).resolve('katex/dist/katex.min.css'), 'utf8')

test("keepWoff2Only keeps every font face and its woff2 source, and drops woff and ttf from KaTeX's real CSS", () => {
  const before = katexCss()
  const after = keepWoff2Only(before)

  const faces = (css: string) => css.match(/@font-face/g)?.length ?? 0
  expect(faces(after)).toBe(faces(before))
  expect(faces(after)).toBeGreaterThan(10)
  expect(after.match(/url\([^)]*\.woff2\) format\("woff2"\)/g)).toHaveLength(faces(before))
  expect(after).not.toMatch(/\.woff\)|\.ttf\)|format\("woff"\)|format\("truetype"\)/)
  expect(after.length).toBeLessThan(before.length)
  // Nothing else in the stylesheet was touched.
  expect(after.replace(/@font-face\{[^}]*\}/g, '')).toBe(before.replace(/@font-face\{[^}]*\}/g, ''))
})

test('keepWoff2Only also handles the spaced-out form of the stylesheet', () => {
  const css = `@font-face {
  font-family: KaTeX_Main;
  src: url(fonts/KaTeX_Main-Regular.woff2) format("woff2"),
       url(fonts/KaTeX_Main-Regular.woff) format("woff"),
       url(fonts/KaTeX_Main-Regular.ttf) format("truetype");
}`
  expect(keepWoff2Only(css)).toBe(`@font-face {
  font-family: KaTeX_Main;
  src: url(fonts/KaTeX_Main-Regular.woff2) format("woff2");
}`)
})

test('the KaTeX plugin runs before Vite reads the CSS, and only for KaTeX stylesheets', () => {
  const plugin = katexWoff2Only()
  const transform = plugin.transform as unknown as Hook<(css: string) => string>
  expect(plugin.enforce).toBe('pre')
  expect(transform.filter!.id!.test('/repo/node_modules/katex/dist/katex.min.css')).toBe(true)
  expect(transform.filter!.id!.test('C:\\repo\\node_modules\\katex\\dist\\katex.css')).toBe(true)
  for (const other of ['/repo/src/styles.css', '/repo/node_modules/katex/dist/contrib/copy-tex.js', '/repo/node_modules/other/katex.min.css']) {
    expect(transform.filter!.id!.test(other), other).toBe(false)
  }
})
