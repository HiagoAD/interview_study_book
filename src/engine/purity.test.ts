import { expect, test } from 'vitest'

// The engine is given today, now and an rng. This keeps it from reaching for them itself.
const sources = import.meta.glob<string>('./*.ts', { query: '?raw', import: 'default', eager: true })
const engineFiles = Object.entries(sources).filter(([file]) => !file.endsWith('.test.ts'))

const FORBIDDEN = [
  { name: 'Date.now()', pattern: /\bDate\.now\s*\(/, example: 'const t = Date.now()' },
  { name: 'new Date() with no arguments', pattern: /(?<![\w.$])Date\s*\(\s*\)/, example: 'const d = new Date()' },
  { name: 'Math.random()', pattern: /\bMath\.random\s*\(/, example: 'const r = Math.random()' },
  {
    name: 'toISOString() (build local dates from local date parts)',
    pattern: /\.toISOString\s*\(/,
    example: 'date.toISOString().slice(0, 10)',
  },
]

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

test('the check sees the engine files', () => {
  const names = engineFiles.map(([file]) => file)
  for (const expected of ['./dates.ts', './scheduling.ts', './sampling.ts', './grading.ts', './sections.ts', './due.ts']) {
    expect(names).toContain(expected)
  }
})

test('engine code never reads the clock, the time zone date or Math.random', () => {
  const found: string[] = []
  for (const [file, source] of engineFiles) {
    const code = withoutComments(source)
    for (const { name, pattern } of FORBIDDEN) if (pattern.test(code)) found.push(`${file} uses ${name}`)
  }
  expect(found).toEqual([])
})

test('the check itself flags each forbidden call, and lets a date built from arguments through', () => {
  for (const { pattern, example } of FORBIDDEN) expect(pattern.test(example)).toBe(true)
  expect(FORBIDDEN[1].pattern.test('new Date(2026, 0, 1)')).toBe(false)
})
