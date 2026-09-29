import type { Definition, Link } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import type { Source } from './load.ts'
import { parseContentFile } from './parse.ts'
import type { ContentError, Text } from './parse.ts'

/** An external link, at the file line it is written on. */
export interface LinkAt {
  url: string
  file: string
  line: number
}

/** The same syntax the renderer reads, so a URL in a code span, a fence or math is never a link. */
const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkMath)

function linksIn(file: string, text: Text): LinkAt[] {
  const found: LinkAt[] = []
  visit(markdown.parse(text.md), ['link', 'definition'], (node) => {
    const { url, position } = node as Link | Definition
    if (/^https?:\/\//i.test(url)) found.push({ url, file, line: text.line + (position?.start.line ?? 1) - 1 })
  })
  return found
}

/**
 * Every external link in the Markdown the site renders: section content, prompts, options and
 * explanations, and glossary summaries and bodies. Titles, names and accepted answers are plain text.
 */
export function findLinks(sources: Source[]): { links: LinkAt[]; errors: ContentError[] } {
  const links: LinkAt[] = []
  const errors: ContentError[] = []
  for (const source of sources) {
    const { file, errors: parseErrors } = parseContentFile(source.path, source.text)
    if (parseErrors.length > 0) {
      errors.push(...parseErrors)
      continue
    }
    const chunks: Text[] = file.entries.flatMap((entry) => [entry.summary, entry.body])
    for (const section of file.chapters.flatMap((chapter) => chapter.sections)) {
      chunks.push(section.content)
      for (const variant of section.concepts.flatMap((concept) => concept.variants)) {
        chunks.push(variant.prompt)
        if (variant.type === 'mc' || variant.type === 'multi') chunks.push(...variant.correct, ...variant.wrong)
        chunks.push(variant.explanation)
      }
    }
    for (const chunk of chunks) links.push(...linksIn(source.path, chunk))
  }
  return { links, errors }
}

/** The links whose URL appears nowhere in `base`, the content files at an earlier revision. */
export function newLinks(links: LinkAt[], base: Source[]): LinkAt[] {
  return links.filter((link) => !base.some((source) => source.text.includes(link.url)))
}

export interface Answer {
  status: number
  location: string | null
}

export type Fetcher = (url: string) => Promise<Answer>

/**
 * Asks for a URL without following redirects. The English language header matters: Node's default
 * `Accept-Language: *` makes Google's documentation sites redirect to a locale picked at random.
 */
export const fetchAnswer: Fetcher = async (url) => {
  const response = await fetch(url, {
    redirect: 'manual',
    headers: { 'accept-language': 'en-US,en;q=0.9' },
    signal: AbortSignal.timeout(20_000),
  })
  await response.body?.cancel()
  return { status: response.status, location: response.headers.get('location') }
}

/** What is wrong with an answer, or null when it is a 200 with no redirect. */
export function judge(url: string, answer: Answer): string | null {
  if (answer.status === 200) return null
  if (answer.status >= 300 && answer.status < 400) {
    const target = answer.location ? new URL(answer.location, url).href : 'nowhere it names'
    return `redirects (HTTP ${answer.status}) to ${target}`
  }
  return `returns HTTP ${answer.status}`
}

/**
 * Checks each distinct URL once, a few at a time, and returns the problem found for each (null when it
 * passes). A request that fails outright is tried a second time before it counts.
 */
export async function checkUrls(urls: string[], fetcher: Fetcher = fetchAnswer, concurrency = 4): Promise<Map<string, string | null>> {
  const distinct = [...new Set(urls)]
  const results = new Map<string, string | null>()
  let next = 0
  const worker = async () => {
    while (next < distinct.length) {
      const url = distinct[next++]
      let problem: string | null = null
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          problem = judge(url, await fetcher(url))
          break
        } catch (error) {
          const cause = (error as { cause?: { code?: string } }).cause?.code
          problem = `could not be fetched: ${cause ?? (error as Error).message}`
        }
      }
      results.set(url, problem)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, distinct.length) }, worker))
  return results
}
