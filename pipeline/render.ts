import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Element, ElementContent, Root as HastRoot } from 'hast'
import rehypeKatex from 'rehype-katex'
import type { Options as KatexOptions } from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { bundledLanguages, createHighlighter, isSpecialLang } from 'shiki'
import type { BundledLanguage, Highlighter } from 'shiki'
import { unified } from 'unified'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'
import { VFile } from 'vfile'
import type { Definition, Image, Root as MdastRoot } from 'mdast'
import type { ContentError, Text } from './parse.ts'

/** Image types that can be inlined, by file extension. */
export const IMAGE_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

const THEMES = { light: 'github-light', dark: 'github-dark' } as const

export interface RenderContext {
  /** Absolute path of the repo root. */
  root: string
  /** The content folder, relative to `root`. Images must stay inside it. */
  dir: string
  /** The Markdown file the text came from, relative to `root`. */
  file: string
}

export interface Rendered {
  html: string
  errors: ContentError[]
}

/** What the plugins need to know about the chunk being rendered. The processor is shared, so it travels on the VFile. */
interface ChunkContext {
  root: string
  /** Absolute folder of the Markdown file, where relative image paths start. */
  fileDir: string
  /** Absolute content folder. */
  contentDir: string
  /** Remove the single wrapping `<p>`, for options. */
  unwrap: boolean
}

declare module 'vfile' {
  interface DataMap {
    chunk: ChunkContext
  }
}

function chunkOf(file: VFile): ChunkContext {
  const chunk = file.data.chunk
  if (!chunk) throw new Error('render: the chunk context is missing from the file')
  return chunk
}

/**
 * remark-math reads `$$ ... $$` on one line, or inside a paragraph, as inline math. PROJECT.md writes
 * display math that way, so math opened with two dollars is turned into display math.
 */
const remarkDoubleDollarDisplay: Plugin<[], MdastRoot> = () => (tree, file) => {
  const source = String(file.value)
  visit(tree, 'inlineMath', (node) => {
    const start = node.position?.start.offset
    if (start === undefined || !source.startsWith('$$', start)) return
    node.data = { ...node.data, hProperties: { className: ['language-math', 'math-display'] } }
  })
}

/**
 * Raw HTML is dropped by remark-rehype, which would lose text silently. It could also load
 * things from the network, so it is an error instead.
 */
const remarkRejectHtml: Plugin<[], MdastRoot> = () => (tree, file) => {
  visit(tree, 'html', (node) => {
    file.message('raw HTML is not supported: write Markdown, and put any HTML you want to show in a code span or a code fence', {
      place: node.position,
      source: 'html',
    })
  })
}

/** Rewrites each local image to a base64 `data:` URI. Anything that cannot be inlined is an error at the image's line. */
const remarkInlineImages: Plugin<[], MdastRoot> = () => (tree, file) => {
  const chunk = chunkOf(file)

  function inline(image: Image): void {
    const fail = (reason: string) => {
      file.message(reason, { place: image.position, source: 'images' })
    }
    const url = image.url
    if (!url) return fail('the image has no path: write ![alt](images/name.png)')
    if (/^https?:/i.test(url)) {
      return fail(`"${url}" is a web address: images must be local files, so save it under content/ and use a relative path such as images/name.png`)
    }
    if (/^[a-z][a-z0-9+.-]*:|^[\\/]/i.test(url)) {
      return fail(`image path "${url}" must be relative to the Markdown file, such as images/name.png`)
    }
    const extension = path.extname(url).toLowerCase()
    const type = IMAGE_TYPES[extension]
    if (!type) return fail(`unsupported image type "${extension || url}": use png, jpg, jpeg, gif, webp or svg`)

    const absolute = path.resolve(chunk.fileDir, url)
    const inside = path.relative(chunk.contentDir, absolute)
    if (inside === '..' || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) {
      return fail(`image "${url}" is outside the content folder: move the file under ${path.relative(chunk.root, chunk.contentDir)}/`)
    }
    let bytes: Buffer
    try {
      bytes = readFileSync(absolute)
    } catch {
      return fail(`image file not found: "${url}" (looked for ${path.relative(chunk.root, absolute)})`)
    }
    image.url = `data:${type};base64,${bytes.toString('base64')}`
  }

  const definitions = new Map<string, Definition>()
  visit(tree, 'definition', (node) => {
    definitions.set(node.identifier, node)
  })
  visit(tree, 'image', inline)
  visit(tree, 'imageReference', (node, index, parent) => {
    // A reference with no definition stays literal text, as in CommonMark.
    const definition = definitions.get(node.identifier)
    if (!definition || !parent || index === undefined) return
    const image: Image = { type: 'image', url: definition.url, title: definition.title, alt: node.alt, position: node.position }
    parent.children[index] = image
    inline(image)
  })
}

type Message = VFile['messages'][number]

function textOf(element: Element): string {
  return element.children.map((child) => (child.type === 'text' ? child.value : child.type === 'element' ? textOf(child) : '')).join('')
}

function languageOf(code: Element): string | undefined {
  const classes = code.properties.className
  const found = Array.isArray(classes) ? classes.find((name) => typeof name === 'string' && name.startsWith('language-')) : undefined
  return typeof found === 'string' ? found.slice('language-'.length) : undefined
}

function isBundledLanguage(lang: string): lang is BundledLanguage {
  // hasOwn, because `lang in bundledLanguages` would accept "constructor" and "toString".
  return Object.hasOwn(bundledLanguages, lang)
}

/** Highlights each fence that names a language. A fence with no language stays a plain `<pre><code>`. */
const rehypeHighlight: Plugin<[Highlighter], HastRoot> = (highlighter) => async (tree, file) => {
  const fences: { pre: Element; parent: { children: ElementContent[] }; index: number; lang: string; code: string }[] = []
  visit(tree, 'element', (pre, index, parent) => {
    if (pre.tagName !== 'pre' || !parent || index === undefined) return
    const code = pre.children.find((child): child is Element => child.type === 'element' && child.tagName === 'code')
    const lang = code && languageOf(code)
    if (!code || !lang) return
    // remark-rehype ends the code text with a newline that is not part of the code.
    fences.push({ pre, parent: parent as { children: ElementContent[] }, index, lang, code: textOf(code).replace(/\n$/, '') })
  })

  for (const { pre, parent, index, lang, code } of fences) {
    if (isBundledLanguage(lang)) await highlighter.loadLanguage(lang)
    else if (!isSpecialLang(lang)) {
      file.message(`unknown code language "${lang}": use a language the highlighter knows (python, ts, sql, bash, json, ...), or leave the language out for plain text`, {
        place: pre.position,
        source: 'shiki',
      })
      continue
    }
    const highlighted = highlighter.codeToHast(code, { lang, themes: THEMES, defaultColor: false })
    parent.children[index] = highlighted.children[0] as Element
  }
}

/** For options: `<p>text</p>` becomes `text`. Anything else (a heading, a list) is kept as it is. */
const rehypeUnwrapParagraph: Plugin<[], HastRoot> = () => (tree, file) => {
  if (!chunkOf(file).unwrap) return
  const blocks = tree.children.filter((child) => !(child.type === 'text' && child.value.trim() === ''))
  const [only] = blocks
  if (blocks.length === 1 && only.type === 'element' && only.tagName === 'p') tree.children = only.children
}

const KATEX_OPTIONS = {
  // KaTeX paints \href, \url, \includegraphics and \html* in the error colour without failing, so a
  // `trust` that throws is the only way to make them fail. The failure becomes a message like any other.
  trust: (context) => {
    throw new Error(`${context.command} is not allowed in math: links, images and HTML attributes are disabled`)
  },
  // Strict-mode notes (Unicode in math mode, "\\" in display mode) have no line and nowhere to be shown.
  strict: 'ignore',
} satisfies KatexOptions

function createProcessor(highlighter: Highlighter) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDoubleDollarDisplay)
    .use(remarkRejectHtml)
    .use(remarkInlineImages)
    .use(remarkRehype)
    .use(rehypeKatex, KATEX_OPTIONS)
    .use(rehypeHighlight, highlighter)
    .use(rehypeUnwrapParagraph)
    .use(rehypeStringify)
    .freeze()
}

export interface Renderer {
  highlighter: Highlighter
  processor: ReturnType<typeof createProcessor>
}

async function createRenderer(): Promise<Renderer> {
  // No languages up front: rehypeHighlight loads each one the first time a fence uses it.
  const highlighter = await createHighlighter({ themes: [THEMES.light, THEMES.dark], langs: [] })
  return { highlighter, processor: createProcessor(highlighter) }
}

let renderer: Promise<Renderer> | undefined

/** The one highlighter and processor for the whole run. Creating a highlighter is slow, so nothing else may make one. */
export function getRenderer(): Promise<Renderer> {
  renderer ??= createRenderer()
  return renderer
}

/** The nearest ancestor with a position. rehype-katex reports display math on its position-less `<code>`, inside a `<pre>` that has one. */
function lineFromAncestors(ancestors: Message['ancestors']): number | undefined {
  for (const ancestor of ancestors?.toReversed() ?? []) {
    if (ancestor.position) return ancestor.position.start.line
  }
  return undefined
}

function describe(message: Message): string {
  // rehype-katex's own reason is always "Could not render math with KaTeX"; the cause says what is wrong.
  if (message.source === 'rehype-katex') return `invalid LaTeX: ${message.cause instanceof Error ? message.cause.message : message.reason}`
  return message.reason
}

async function render(text: Text, context: RenderContext, unwrap: boolean): Promise<Rendered> {
  const { processor } = await getRenderer()
  const contentDir = path.resolve(context.root, context.dir)
  const file = new VFile({ path: context.file, value: text.md })
  file.data.chunk = { root: context.root, fileDir: path.dirname(path.resolve(context.root, context.file)), contentDir, unwrap }

  const errors: ContentError[] = []
  const report = (chunkLine: number, message: string) => {
    // Line k of a chunk is file line `text.line + k - 1`.
    const error = { file: context.file, line: text.line + chunkLine - 1, message }
    if (!errors.some((seen) => seen.line === error.line && seen.message === error.message)) errors.push(error)
  }
  try {
    await processor.process(file)
  } catch (error) {
    report(1, `could not render this text: ${error instanceof Error ? error.message : String(error)}`)
  }
  // Every message is an error. rehype-katex only records a message when a formula fails, and then
  // renders KaTeX's red error markup anyway, so the HTML of a chunk with any error is never returned.
  for (const message of file.messages) report(message.line ?? lineFromAncestors(message.ancestors) ?? 1, describe(message))

  return { html: errors.length > 0 ? '' : String(file), errors: errors.sort((a, b) => a.line - b.line) }
}

/** Renders a section's content, a prompt or an explanation: block Markdown to HTML. */
export function renderMarkdown(text: Text, context: RenderContext): Promise<Rendered> {
  return render(text, context, false)
}

/** Renders an option: the same, without the single wrapping `<p>`. */
export function renderOption(text: Text, context: RenderContext): Promise<Rendered> {
  return render(text, context, true)
}
