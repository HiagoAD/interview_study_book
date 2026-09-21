import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach } from 'vitest'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A throwaway repo root holding `files` (path to text or bytes), removed after the test. */
export function tempRepo(files: Record<string, string | Uint8Array>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'content-test-'))
  roots.push(root)
  for (const [name, data] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), data)
  }
  return root
}

/**
 * The first ````markdown block below `heading` in a repo file. The docs hold several examples, so a test
 * names the one it means rather than taking whichever comes first.
 */
export function docExample(file: string, heading: string): string {
  const doc = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  const start = doc.indexOf(`\n${heading}\n`)
  if (start < 0) throw new Error(`${file} has no heading "${heading}"`)
  const example = /````markdown\n([\s\S]*?)\n````/.exec(doc.slice(start))
  if (!example) throw new Error(`${file} has no example below "${heading}"`)
  return example[1]
}
