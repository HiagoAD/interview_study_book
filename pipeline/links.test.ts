import { afterEach, expect, test, vi } from 'vitest'
import { checkUrls, fetchAnswer, findLinks, newLinks } from './links.ts'
import type { Answer } from './links.ts'
import type { Source } from './load.ts'

const CHAPTER: Source = {
  path: 'content/a.md',
  text: [
    '---', // 1
    'book: test', // 2
    'chapter: One', // 3
    '---', // 4
    '## One {#one}', // 5
    'See the [manual](https://example.com/manual) and [[a term]].', // 6
    'A code span `https://example.com/in-code` is no link, and neither is an [in-page link](#one).', // 7
    '', // 8
    '```bash', // 9
    'curl https://example.com/in-fence', // 10
    '```', // 11
    '', // 12
    'Math $x$ and a [second link](https://example.com/second "Title").', // 13
    '', // 14
    'Exercise: read them.', // 15
    '', // 16
    '?? c1 Which one? See [the reference](https://example.com/prompt).', // 17
    '* the [right one](https://example.com/option)', // 18
    '- a wrong one', // 19
    '> Because of [this](https://example.com/explanation).', // 20
  ].join('\n'),
}

const GLOSSARY: Source = {
  path: 'content/glossary.md',
  text: [
    '---', // 1
    'book: test', // 2
    'kind: glossary', // 3
    '---', // 4
    '## Term {#term}', // 5
    'A summary with a [link](https://example.com/summary).', // 6
    '', // 7
    'A body with a [link](https://example.com/body).', // 8
  ].join('\n'),
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('links are found wherever the site renders Markdown, at their lines, and never in code', () => {
  const { links, errors } = findLinks([CHAPTER, GLOSSARY])
  expect(errors).toEqual([])
  expect(links.map((link) => [link.file, link.line, link.url.replace('https://example.com/', '')])).toEqual([
    ['content/a.md', 6, 'manual'],
    ['content/a.md', 13, 'second'],
    ['content/a.md', 17, 'prompt'],
    ['content/a.md', 18, 'option'],
    ['content/a.md', 20, 'explanation'],
    ['content/glossary.md', 6, 'summary'],
    ['content/glossary.md', 8, 'body'],
  ])
})

test('a link is new when its URL appears nowhere in the base', () => {
  const { links } = findLinks([CHAPTER])
  const base: Source[] = [{ path: 'content/old.md', text: 'Once linked: https://example.com/manual and https://example.com/option' }]
  expect(newLinks(links, base).map((link) => link.url.replace('https://example.com/', ''))).toEqual(['second', 'prompt', 'explanation'])
})

test('each URL is fetched once; a redirect, an error status and a dead host fail, and a failed request is tried again', async () => {
  const flaky = { failed: false }
  const calls: string[] = []
  const answers: Record<string, () => Answer> = {
    'https://ok.test/': () => ({ status: 200, location: null }),
    'https://moved.test/a': () => ({ status: 301, location: '/b' }),
    'https://gone.test/': () => ({ status: 404, location: null }),
    'https://flaky.test/': () => {
      if (!flaky.failed) {
        flaky.failed = true
        throw new Error('socket hang up')
      }
      return { status: 200, location: null }
    },
    'https://down.test/': () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })
    },
  }
  const fetcher = async (url: string) => {
    calls.push(url)
    return answers[url]()
  }
  const urls = ['https://ok.test/', 'https://moved.test/a', 'https://ok.test/', 'https://gone.test/', 'https://flaky.test/', 'https://down.test/']
  const results = await checkUrls(urls, fetcher, 2)
  expect(Object.fromEntries(results)).toEqual({
    'https://ok.test/': null,
    'https://moved.test/a': 'redirects (HTTP 301) to https://moved.test/b',
    'https://gone.test/': 'returns HTTP 404',
    'https://flaky.test/': null,
    'https://down.test/': 'could not be fetched: ENOTFOUND',
  })
  expect(calls.filter((url) => url === 'https://ok.test/')).toHaveLength(1)
  expect(calls.filter((url) => url === 'https://flaky.test/')).toHaveLength(2)
  expect(calls.filter((url) => url === 'https://down.test/')).toHaveLength(2)
})

test('a request asks for English and does not follow redirects', async () => {
  const seen: RequestInit[] = []
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    seen.push(init)
    return new Response(null, { status: 302, headers: { location: '/elsewhere' } })
  })
  expect(await fetchAnswer('https://a.test/')).toEqual({ status: 302, location: '/elsewhere' })
  expect(seen[0].redirect).toBe('manual')
  expect((seen[0].headers as Record<string, string>)['accept-language']).toMatch(/^en/)
})
