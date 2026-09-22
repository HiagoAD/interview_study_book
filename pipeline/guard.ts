import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { assembleBooks, findContentFiles } from './load.ts'
import type { RawBook, Source } from './load.ts'
import { findFenceEnd, formatError, openFence, parseContentFile } from './parse.ts'
import type { ContentError, RawConcept, RawSection, RawVariant, Text } from './parse.ts'

/** What `questions` accepts besides moved lines: nothing, or wrong options changed, added and removed. */
export type Allow = 'distractors' | null

export interface QuestionReport {
  errors: ContentError[]
  sections: number
  concepts: number
  variants: number
  /** Wrong options that `--allow distractors` let through, counted as texts that appeared and disappeared. */
  distractors: { added: number; removed: number }
}

interface SectionAt {
  id: string
  file: string
  line: number
  /** Concept ids in file order. */
  concepts: string[]
}

interface ConceptAt {
  section: string
  file: string
  concept: RawConcept
}

interface Index {
  /** Keyed `book/section`, in the order the site shows them. */
  sections: Map<string, SectionAt>
  /** Keyed `book/concept`: concept ids are unique within a book, so a concept is found wherever it moved. */
  concepts: Map<string, ConceptAt>
}

function index(books: RawBook[]): Index {
  const sections = new Map<string, SectionAt>()
  const concepts = new Map<string, ConceptAt>()
  for (const book of books) {
    for (const chapter of book.chapters) {
      for (const section of chapter.sections) {
        sections.set(`${book.id}/${section.id}`, { id: section.id, file: chapter.file, line: section.line, concepts: section.concepts.map((c) => c.id) })
        for (const concept of section.concepts) concepts.set(`${book.id}/${concept.id}`, { section: section.id, file: chapter.file, concept })
      }
    }
  }
  return { sections, concepts }
}

function clip(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

const TYPE_NAMES: Record<RawVariant['type'], string> = { mc: 'multiple choice', multi: '[multi]', tf: '[tf]', short: '[short]' }

/**
 * The keys of `after` whose predecessor among the keys both lists share is not the one it had in
 * `before`, each with the predecessor it had and the one it has now (`null` for first).
 */
function moved(before: string[], after: string[]): { key: string; was: string | null; now: string | null }[] {
  const shared = new Set(before.filter((key) => after.includes(key)))
  const oldOrder = before.filter((key) => shared.has(key))
  const newOrder = after.filter((key) => shared.has(key))
  const previous = new Map(oldOrder.map((key, i) => [key, oldOrder[i - 1] ?? null]))
  return newOrder.flatMap((key, i) => {
    const now = newOrder[i - 1] ?? null
    const was = previous.get(key) ?? null
    return was === now ? [] : [{ key, was, now }]
  })
}

/**
 * Compares the question blocks of two versions of the content, `base` at revision `rev` and `work`
 * now, ignoring line numbers. Sections are matched by id and concepts by id within their book, so
 * prose added above a question block moves nothing. With `allow: 'distractors'`, `-` options may
 * change, appear or disappear; everything else, and every section id and its place, must be the same.
 */
export function compareQuestions(base: Source[], work: Source[], { rev, allow }: { rev: string; allow: Allow }): QuestionReport {
  const report: QuestionReport = { errors: [], sections: 0, concepts: 0, variants: 0, distractors: { added: 0, removed: 0 } }
  const note = (file: string, line: number, message: string) => report.errors.push({ file, line, message })
  const before = assembleBooks(base)
  const after = assembleBooks(work)
  for (const error of before.errors) note(error.file, error.line, `at ${rev}: ${error.message}`)
  report.errors.push(...after.errors)
  // Both models are best-effort when the content has errors, so a comparison would only add noise.
  if (report.errors.length > 0) return report

  const old = index(before.books)
  const now = index(after.books)
  const gone = `(this line is at ${rev})`

  for (const [key, section] of old.sections) {
    if (!now.sections.has(key)) note(section.file, section.line, `section "${section.id}" is gone ${gone}: section ids may not change, so restore it or its id`)
  }
  for (const [key, section] of now.sections) {
    if (!old.sections.has(key)) note(section.file, section.line, `section "${section.id}" is new: section ids may not change, and it is not at ${rev}`)
  }
  const placed = (key: string | null) => (key ? `after "${key.slice(key.indexOf('/') + 1)}"` : 'first in its book')
  for (const move of moved([...old.sections.keys()], [...now.sections.keys()])) {
    const section = now.sections.get(move.key)!
    note(section.file, section.line, `section "${section.id}" has moved: at ${rev} it came ${placed(move.was)}, and now it comes ${placed(move.now)}`)
  }

  for (const [key, was] of old.concepts) {
    const is = now.concepts.get(key)
    if (!is) {
      note(was.file, was.concept.line, `concept "${was.concept.id}" is gone ${gone}: concept ids are progress, so restore it or its id`)
      continue
    }
    if (is.section !== was.section) {
      note(is.file, is.concept.line, `concept "${is.concept.id}" has moved from section "${was.section}" to section "${is.section}"`)
    }
    compareConcept(was.concept, is, rev, allow, report)
  }
  for (const [key, is] of now.concepts) {
    if (!old.concepts.has(key)) note(is.file, is.concept.line, `concept "${is.concept.id}" is new: it is not at ${rev}`)
  }
  for (const [key, section] of now.sections) {
    const was = old.sections.get(key)
    if (!was) continue
    for (const move of moved(was.concepts, section.concepts)) {
      const concept = now.concepts.get(`${key.slice(0, key.indexOf('/'))}/${move.key}`)!
      const where = (id: string | null) => (id ? `after "${id}"` : 'first')
      note(concept.file, concept.concept.line, `concept "${move.key}" has moved within section "${section.id}": at ${rev} it came ${where(move.was)}, and now it comes ${where(move.now)}`)
    }
  }

  report.sections = now.sections.size
  report.concepts = now.concepts.size
  report.variants = [...now.concepts.values()].reduce((sum, c) => sum + c.concept.variants.length, 0)
  report.errors.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line))
  return report
}

function compareConcept(before: RawConcept, after: ConceptAt, rev: string, allow: Allow, report: QuestionReport): void {
  const { file, concept } = after
  const count = Math.max(before.variants.length, concept.variants.length)
  for (let i = 0; i < count; i++) {
    const was = before.variants[i]
    const is = concept.variants[i]
    const label = `concept "${concept.id}", variant ${i + 1}`
    if (!is) report.errors.push({ file, line: concept.line, message: `${label} is gone: at ${rev} it asked "${clip(was.prompt.md)}"` })
    else if (!was) report.errors.push({ file, line: is.line, message: `${label} is new: it is not at ${rev}` })
    else compareVariant(was, is, file, label, rev, allow, report)
  }
}

function compareVariant(was: RawVariant, is: RawVariant, file: string, label: string, rev: string, allow: Allow, report: QuestionReport): void {
  const differ = (line: number, message: string) => report.errors.push({ file, line, message: `${label}: ${message}` })
  if (was.type !== is.type) differ(is.line, `the type changed from ${TYPE_NAMES[was.type]} to ${TYPE_NAMES[is.type]}`)
  if (was.prompt.md !== is.prompt.md) differ(is.prompt.line, `the prompt changed; at ${rev} it was "${clip(was.prompt.md)}"`)
  if (was.explanation.md !== is.explanation.md) differ(is.explanation.line, `the explanation changed; at ${rev} it was "${clip(was.explanation.md)}"`)

  if (was.type === 'tf' && is.type === 'tf') {
    if (was.answer !== is.answer) differ(is.line, `the answer changed from ${was.answer} to ${is.answer}`)
  } else if (was.type === 'short' && is.type === 'short') {
    const list = (accepted: string[]) => accepted.join(' | ')
    if (list(was.accepted) !== list(is.accepted)) differ(is.line, `the accepted answers changed from "${list(was.accepted)}" to "${list(is.accepted)}"`)
  } else if ((was.type === 'mc' || was.type === 'multi') && (is.type === 'mc' || is.type === 'multi')) {
    if (was.n !== is.n) differ(is.line, `the option count changed from n=${was.n} to n=${is.n}`)
    compareOptions(was.correct, is.correct, is.line, 'correct option', differ)
    if (allow === 'distractors') {
      const { added, removed } = compareOptions(was.wrong, is.wrong, is.line, 'wrong option', null)
      report.distractors.added += added
      report.distractors.removed += removed
    } else {
      compareOptions(was.wrong, is.wrong, is.line, 'wrong option', differ)
    }
  }
}

/**
 * Compares two lists of options as texts that appeared and disappeared, so an edited option reads as
 * one gone and one new, then as an order. `differ` is null when the caller only wants the counts.
 */
function compareOptions(
  was: Text[],
  is: Text[],
  variantLine: number,
  noun: string,
  differ: ((line: number, message: string) => void) | null,
): { added: number; removed: number } {
  const remaining = was.map((option) => option.md)
  const added = is.filter((option) => {
    const i = remaining.indexOf(option.md)
    if (i < 0) return true
    remaining.splice(i, 1)
    return false
  })
  if (differ) {
    for (const option of added) differ(option.line, `this ${noun} is new or changed: "${clip(option.md)}"`)
    for (const text of remaining) differ(variantLine, `the ${noun} "${clip(text)}" is gone or changed`)
    const order = (options: Text[]) => options.map((option) => option.md).join('\n')
    if (added.length === 0 && remaining.length === 0 && order(was) !== order(is)) differ(is[0].line, `the ${noun}s are in a different order`)
  }
  return { added: added.length, removed: remaining.length }
}

const CLOSING = /^(?:Exercise|[A-Z][a-z]+ exercise):/
const CONTRACTION = /\b[A-Za-z]*n['’]t\b|\b[A-Za-z]+['’](?:re|ve|ll|d|m)\b|\b(?:it|that|there|here|what|let|he|she|who|where|how|when|why)['’]s\b/gi

const blank = (text: string) => text.replace(/[^\n]/g, ' ')

/** Blanks out a code span wherever a run of backticks is closed by a run of the same length. */
function maskCodeSpans(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    if (text[i] !== '`') {
      out += text[i++]
      continue
    }
    let run = 1
    while (text[i + run] === '`') run++
    let close = -1
    for (let j = text.indexOf('`', i + run); j >= 0; j = text.indexOf('`', j)) {
      let end = j
      while (text[end] === '`') end++
      if (end - j === run) {
        close = j
        break
      }
      j = end
    }
    if (close < 0) {
      out += text.slice(i, i + run)
      i += run
    } else {
      out += blank(text.slice(i, close + run))
      i = close + run
    }
  }
  return out
}

/**
 * The prose of a chunk, with everything that is not prose blanked out: code fences, code spans, math,
 * link targets, URLs and “quotations”, whose punctuation is someone else's. Lengths and line breaks
 * are kept, so an index into the result is an index into the chunk.
 */
export function maskNonProse(md: string): string {
  const lines = md.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const fence = openFence(lines[i])
    if (!fence) continue
    const close = findFenceEnd(lines, i, fence)
    const end = close < 0 ? lines.length - 1 : close
    for (let j = i; j <= end; j++) lines[j] = blank(lines[j])
    i = end
  }
  return maskCodeSpans(lines.join('\n'))
    .replace(/\$\$[\s\S]*?\$\$/g, blank)
    .replace(/(?<!\\)\$[^$\n]*?(?<!\\)\$/g, blank)
    .replace(/\]\([^)]*\)/g, blank)
    .replace(/<https?:[^>\n]*>|https?:\/\/\S+/g, blank)
    .replace(/“[^”]*”/g, blank)
}

function proseFindings(file: string, text: Text): ContentError[] {
  const original = text.md.split('\n')
  const findings: ContentError[] = []
  maskNonProse(text.md)
    .split('\n')
    .forEach((line, i) => {
      const near = (at: number) => clip(original[i].slice(Math.max(0, at - 30), at + 30), 70)
      const found = (at: number, message: string) => findings.push({ file, line: text.line + i, message: `${message}, near "${near(at)}"` })
      for (const match of line.matchAll(/—/g)) found(match.index, 'em dash in prose: use a comma, a semicolon, parentheses or two sentences')
      for (const match of line.matchAll(CONTRACTION)) found(match.index, `contraction "${match[0]}" in prose: write the words out`)
      for (const match of line.matchAll(/"/g)) found(match.index, 'straight double quote in prose: use curly quotes, or a code span for code')
    })
  return findings
}

/** A chunk's blocks, each named by its first line: blank lines separate them, and a fence is one block. */
function blocks(text: Text): { first: string; line: number }[] {
  const lines = text.md.split('\n')
  const found: { first: string; line: number }[] = []
  let open = false
  for (let i = 0; i < lines.length; i++) {
    const fence = openFence(lines[i])
    if (fence) {
      found.push({ first: lines[i], line: text.line + i })
      const close = findFenceEnd(lines, i, fence)
      i = close < 0 ? lines.length : close
      open = false
    } else if (lines[i].trim() === '') {
      open = false
    } else if (!open || /^#{1,6}\s/.test(lines[i])) {
      found.push({ first: lines[i], line: text.line + i })
      open = true
    }
  }
  return found
}

function closingProblem(file: string, section: RawSection): ContentError | null {
  const found = blocks(section.content)
  const last = found[found.length - 1]
  if (!last || CLOSING.test(last.first)) return null
  const exercise = found.findLast((block) => CLOSING.test(block.first))
  if (!exercise) {
    return { file, line: section.line, message: `section "${section.id}" has no closing exercise: end its content with a paragraph that starts "Exercise:"` }
  }
  return {
    file,
    line: exercise.line,
    message: `section "${section.id}" goes on after its closing exercise: move the exercise to the end of the content, after the block at line ${last.line}`,
  }
}

/**
 * Checks the book's prose conventions in every chapter and glossary file: no em dashes, no
 * contractions and no straight double quotes outside code, math, link targets and quotations, and
 * every chapter section closing with its exercise.
 */
export function checkStyle(sources: Source[]): ContentError[] {
  const errors: ContentError[] = []
  for (const source of sources) {
    const { file, errors: parseErrors } = parseContentFile(source.path, source.text)
    if (parseErrors.length > 0) {
      errors.push(...parseErrors)
      continue
    }
    const prose = (text: Text) => errors.push(...proseFindings(source.path, text))
    for (const entry of file.entries) {
      prose({ md: entry.term, line: entry.line })
      for (const name of entry.names) prose({ md: name.text, line: name.line })
      prose(entry.summary)
      prose(entry.body)
    }
    for (const chapter of file.chapters) {
      prose({ md: chapter.title, line: chapter.line })
      for (const section of chapter.sections) {
        prose({ md: section.title, line: section.line })
        prose(section.content)
        const closing = closingProblem(source.path, section)
        if (closing) errors.push(closing)
        for (const variant of section.concepts.flatMap((concept) => concept.variants)) {
          prose(variant.prompt)
          if (variant.type === 'mc' || variant.type === 'multi') for (const option of [...variant.correct, ...variant.wrong]) prose(option)
          prose(variant.explanation)
        }
      }
    }
  }
  return errors.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line))
}

const USAGE = `usage: npm run guard -- questions [--base <rev>] [--allow distractors]
       npm run guard -- style

questions  compares every question block with the one at <rev> (default HEAD), ignoring line numbers
style      checks the prose conventions of every chapter and glossary file`

function readWorkingTree(root: string): Source[] {
  return findContentFiles(root).map((file) => ({ path: file, text: readFileSync(path.join(root, file), 'utf8') }))
}

function readRevision(root: string, rev: string): Source[] {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  const files = git('ls-tree', '-r', '-z', '--name-only', rev, '--', 'content')
    .split('\0')
    .filter((file) => file.endsWith('.md'))
  return files.map((file) => ({ path: file, text: git('show', `${rev}:${file}`) }))
}

function usage(problem: string): number {
  console.error(`${problem}\n\n${USAGE}`)
  return 2
}

function runQuestions(root: string, args: string[]): number {
  let rev = 'HEAD'
  let allow: Allow = null
  for (let i = 0; i < args.length; i++) {
    const value = args[i + 1]
    if (args[i] === '--base' && value) rev = value
    else if (args[i] === '--allow' && value === 'distractors') allow = value
    else return usage(`unknown or incomplete option "${args.slice(i).join(' ')}"`)
    i++
  }
  let base: Source[]
  try {
    base = readRevision(root, rev)
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim()
    return usage(`cannot read content/ at "${rev}": ${stderr || (error as Error).message}`)
  }
  const report = compareQuestions(base, readWorkingTree(root), { rev, allow })
  if (report.errors.length > 0) {
    for (const error of report.errors) console.error(formatError(error))
    console.error(`\nquestions differ from ${rev}: ${report.errors.length} ${report.errors.length === 1 ? 'difference' : 'differences'}`)
    return 1
  }
  const counts = `${report.sections} sections, ${report.concepts} concepts, ${report.variants} variants`
  const { added, removed } = report.distractors
  console.log(`questions match ${rev}: ${counts}${allow ? `; wrong options allowed to differ: ${added} new, ${removed} gone` : ''}`)
  return 0
}

function runStyle(root: string, args: string[]): number {
  if (args.length > 0) return usage(`style takes no options, got "${args.join(' ')}"`)
  const sources = readWorkingTree(root)
  const errors = checkStyle(sources)
  if (errors.length > 0) {
    for (const error of errors) console.error(formatError(error))
    console.error(`\nstyle check failed: ${errors.length} ${errors.length === 1 ? 'problem' : 'problems'}`)
    return 1
  }
  console.log(`style OK: ${sources.length} files`)
  return 0
}

function main(args: string[]): number {
  const root = path.resolve(import.meta.dirname, '..')
  const [command, ...rest] = args
  if (command === 'questions') return runQuestions(root, rest)
  if (command === 'style') return runStyle(root, rest)
  return usage(command ? `unknown command "${command}"` : 'no command given')
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) process.exitCode = main(process.argv.slice(2))
