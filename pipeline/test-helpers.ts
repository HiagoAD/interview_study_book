import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
