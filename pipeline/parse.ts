import type { Variant } from '../src/types/content.ts'

export type VariantType = Variant['type']

/** Markdown source, and the 1-based file line its first line came from. */
export interface Text {
  md: string
  line: number
}

interface RawVariantBase {
  line: number
  prompt: Text
  explanation: Text
}

export type RawVariant =
  | (RawVariantBase & { type: 'mc' | 'multi'; correct: Text[]; wrong: Text[]; n: number })
  | (RawVariantBase & { type: 'tf'; answer: boolean })
  | (RawVariantBase & { type: 'short'; accepted: string[] })

export interface RawConcept {
  id: string
  line: number
  variants: RawVariant[]
}

export interface RawSection {
  id: string
  title: string
  line: number
  content: Text
  concepts: RawConcept[]
}

export interface RawChapter {
  id: string
  title: string
  line: number
  /** The file it was written in; a chapter never spans files, so renderers resolve images from here. */
  file: string
  sections: RawSection[]
}

/** One glossary entry: a term, the other names it goes by, its one-paragraph summary and the rest of it. */
export interface RawEntry {
  id: string
  term: string
  line: number
  /** The file it was written in, so renderers resolve its images from there. */
  file: string
  names: { text: string; line: number }[]
  see: { id: string; line: number }[]
  summary: Text
  /** Empty when the entry is only a summary. */
  body: Text
}

export interface RawFile {
  path: string
  book: { title: string; line: number } | null
  /** A file holds chapters or glossary entries, never both: `kind: glossary` decides which. */
  chapters: RawChapter[]
  entries: RawEntry[]
}

export interface ContentError {
  file: string
  line: number
  message: string
}

export interface ParseResult {
  file: RawFile
  errors: ContentError[]
}

export function formatError(error: ContentError): string {
  return `${error.file}:${error.line}: ${error.message}`
}

export function slug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type Report = (line: number, message: string) => void

const CHAPTER_LINE = /^#(?:[ \t]+(.*?))?[ \t]*$/
const SECTION_LINE = /^##(?:[ \t]+(.*?))?[ \t]*$/
const CONCEPT_LINE = /^\?\?(?:[ \t]+(.*))?$/
const VARIANT_LINE = /^\?\+(?:[ \t]+(.*))?$/
const OPTION_LINE = /^([*-])(?:[ \t]+(.*))?$/
const ACCEPT_LINE = /^=(?:[ \t]+(.*))?$/
const EXPLAIN_LINE = /^>(?:[ \t](.*))?$/
const SEE_LINE = /^->(?:[ \t](.*))?$/

/** The longest a summary may be, in Markdown characters, because a preview card shows it whole. */
export const SUMMARY_LIMIT = 400

function clip(text: string, max = 60): string {
  const trimmed = text.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

interface Fence {
  char: string
  len: number
}

function openFence(line: string | undefined): Fence | null {
  const match = line === undefined ? null : /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
  if (!match || (match[1][0] === '`' && match[2].includes('`'))) return null
  return { char: match[1][0], len: match[1].length }
}

/** Index of the line closing the fence opened at `from`, or -1 if it never closes. */
function findFenceEnd(lines: string[], from: number, fence: Fence): number {
  for (let i = from + 1; i < lines.length; i++) {
    const match = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(lines[i])
    if (match && match[1][0] === fence.char && match[1].length >= fence.len) return i
  }
  return -1
}

/** Consumes the fence opened at line index `from`, copying its lines to `sink`. `closed` is false when it never ends. */
function takeFence(lines: string[], from: number, fence: Fence, sink: string[] | null, err: Report): { next: number; closed: boolean } {
  const end = findFenceEnd(lines, from, fence)
  if (end < 0) {
    err(from + 1, `the code fence opened here is never closed: end it with a line containing only ${fence.char.repeat(fence.len)} (a longer run also works)`)
    sink?.push(...lines.slice(from))
    return { next: lines.length, closed: false }
  }
  sink?.push(...lines.slice(from, end + 1))
  return { next: end + 1, closed: true }
}

/** Joins lines into one Markdown chunk without blank lines at either end; `line` follows the first kept line. */
function block(lines: string[], firstLine: number): Text {
  let start = 0
  let end = lines.length
  while (start < end && lines[start].trim() === '') start++
  while (end > start && lines[end - 1].trim() === '') end--
  return { md: lines.slice(start, end).join('\n'), line: firstLine + start }
}

interface FrontMatter {
  book: { title: string; line: number } | null
  chapter: { title: string; line: number } | null
  /** `kind: glossary`: the file holds glossary entries instead of chapters. */
  glossary: boolean
  /** A `kind` that is not understood: what the body holds is anyone's guess, so it is not read. */
  unknownKind: boolean
  bodyStart: number
}

function parseFrontMatter(lines: string[], err: Report): FrontMatter {
  const result: FrontMatter = { book: null, chapter: null, glossary: false, unknownKind: false, bodyStart: 0 }
  if (lines[0].trim() !== '---') {
    err(1, 'front matter is required: the first line must be "---", then "book: <title>", then a closing "---"')
    return result
  }
  const close = lines.findIndex((text, i) => i > 0 && text.trim() === '---')
  if (close < 0) {
    err(1, 'front matter is not closed: add a line containing only "---" after the last key')
    result.bodyStart = lines.length
    return result
  }
  result.bodyStart = close + 1

  const seen = new Set<string>()
  for (let i = 1; i < close; i++) {
    const text = lines[i]
    if (text.trim() === '') continue
    const colon = text.indexOf(':')
    const key = colon < 0 ? '' : text.slice(0, colon).trim()
    if (!key) {
      err(i + 1, `expected "key: value" in the front matter, got "${clip(text)}"`)
      continue
    }
    if (key !== 'book' && key !== 'chapter' && key !== 'kind') {
      err(i + 1, `unknown front matter key "${key}": the only keys are "book" (required), "chapter" and "kind" (optional)`)
      continue
    }
    if (seen.has(key)) {
      err(i + 1, `front matter key "${key}" appears twice: keep one`)
      continue
    }
    seen.add(key)
    const value = text.slice(colon + 1).trim()
    if (!value) {
      err(i + 1, `front matter key "${key}" has no value: write "${key}: <title>"`)
    } else if (key === 'kind') {
      if (value === 'glossary') {
        result.glossary = true
      } else {
        result.unknownKind = true
        err(i + 1, `unknown kind "${value}": the only kind is "glossary", which makes the file a glossary; leave "kind" out for a file of chapters and sections`)
      }
    } else if (!slug(value)) {
      err(i + 1, `"${key}" needs at least one letter or digit (a-z, 0-9), because its id is made from it`)
    } else {
      result[key] = { title: value, line: i + 1 }
    }
  }
  if (!seen.has('book')) err(1, 'front matter is missing "book": add "book: <book title>"')
  if (result.glossary && result.chapter) {
    err(result.chapter.line, 'a glossary file has no chapters, so "chapter" cannot be set beside "kind: glossary": remove whichever of the two is wrong')
  }
  return result
}

interface Marker {
  id: string | null
  type: VariantType
  n: number
  prompt: string
}

function parseSettings(inner: string, line: number, err: Report): { type: VariantType; n: number | null } {
  const types: VariantType[] = []
  let n: number | null = null
  for (const token of inner.split(/[\s,]+/).filter(Boolean)) {
    if (token === 'multi' || token === 'tf' || token === 'short') {
      types.push(token)
    } else if (token.startsWith('n=')) {
      const value = /^n=([2-9])$/.exec(token)
      if (!value) err(line, `invalid setting "${token}": n must be a whole number from 2 to 9, e.g. "n=5"`)
      else if (n !== null) err(line, 'n is set twice: keep one "n=" setting')
      else n = Number(value[1])
    } else {
      err(
        line,
        `unknown setting "${token}": use multi, tf, short or n=<2-9> (a "[" right after the id, or after "?+", always starts settings; if it was meant as the prompt, start the prompt with a word)`,
      )
    }
  }
  if (types.length > 1) err(line, `more than one type in the settings (${types.join(', ')}): use at most one of multi, tf, short`)
  const type = types[0] ?? 'mc'
  if (n !== null && (type === 'tf' || type === 'short')) {
    err(line, `"n=" only applies to multiple choice and [multi], not [${type}]: remove it`)
  }
  return { type, n }
}

/** Reads what follows `??` or `?+` on a marker line: the concept id (`??` only), settings and prompt text. */
function parseMarker(kind: '??' | '?+', rest: string, line: number, err: Report): Marker {
  let id: string | null = null
  let text = rest.trim()
  if (kind === '??') {
    const [, token, after] = /^(\S*)\s*(.*)$/.exec(text)!
    if (!token || token.startsWith('[')) {
      err(line, 'the concept id is missing: write "?? <concept-id> [settings] <prompt>", e.g. "?? lru-evict Which entry is evicted first?"')
      text = token ? `${token} ${after}`.trim() : after
    } else if (!ID_PATTERN.test(token)) {
      err(line, `invalid concept id "${token}": use lowercase letters, digits and single hyphens, e.g. "${slug(token) || 'lru-evict'}"`)
      text = after
    } else {
      id = token
      text = after
    }
  }

  let type: VariantType = 'mc'
  let n: number | null = null
  if (text.startsWith('[')) {
    const close = text.indexOf(']')
    if (close < 0) {
      err(line, 'the settings bracket is not closed: write e.g. "[multi n=5]" directly before the prompt')
    } else {
      ;({ type, n } = parseSettings(text.slice(1, close), line, err))
      text = text.slice(close + 1).trim()
    }
  }
  if (!text) {
    err(line, `the prompt is empty: write the question after ${kind === '??' ? 'the id and settings' : '"?+" and its settings'}`)
  }
  return { id, type, n: n ?? 4, prompt: text }
}

/** What a `##` heading starts, so one parser can serve sections and glossary entries and name each in its messages. */
interface HeadingKind {
  noun: string
  form: string
  idName: string
}

const SECTION_HEADING: HeadingKind = { noun: 'section', form: '## Section title {#section-id}', idName: 'section-id' }
const ENTRY_HEADING: HeadingKind = { noun: 'glossary entry', form: '## Term {#term-id}', idName: 'term-id' }

function parseHeading(rest: string, line: number, err: Report, kind: HeadingKind): { id: string; title: string } | null {
  const match = /^(.*?)[ \t]*\{#([^{}]*)\}$/.exec(rest)
  const title = (match ? match[1] : rest).trim()
  if (!title) {
    err(line, `the ${kind.noun} heading ${match ? 'has no title' : 'is empty'}: write "${kind.form}"`)
    return null
  }
  const suggestion = (id: string) => `## ${title} {#${id || kind.idName}}`
  if (!match) {
    err(line, `the ${kind.noun} heading has no id: write "${suggestion(slug(title))}"`)
    return null
  }
  const id = match[2]
  if (!ID_PATTERN.test(id)) {
    err(line, `invalid ${kind.noun} id "${id}": use lowercase letters, digits and single hyphens; write "${suggestion(slug(id) || slug(title))}"`)
    return null
  }
  return { id, title }
}

const MARKER_LIST =
  '"?? <concept-id> [settings] <prompt>", "?+ [settings] <prompt>", "* correct option", "- wrong option", "= answer | another answer", "> explanation" and blank lines'

function unexpectedLineMessage(text: string): string {
  const stripped = text.trimStart()
  const isMarker = [CONCEPT_LINE, VARIANT_LINE, OPTION_LINE, ACCEPT_LINE, EXPLAIN_LINE].some((re) => re.test(stripped))
  if (stripped !== text && isMarker) {
    return `markers must start at the first column: remove the leading spaces from "${clip(text)}"`
  }
  return `unexpected line "${clip(text)}" in the question block: after the first "??" line only ${MARKER_LIST} are allowed; put text to read above the first "??" line`
}

interface Draft {
  concept: RawConcept
  line: number
  type: VariantType
  n: number
  prompt: Text
  correct: Text[]
  wrong: Text[]
  accepted: string[]
  answer: boolean | null
  stars: number
  explanation: { lines: string[]; first: number; last: number } | null
}

interface SectionState {
  node: RawSection
  phase: 'content' | 'questions'
  contentLines: string[]
  concept: RawConcept | null
}

interface ChapterState {
  node: RawChapter
  valid: boolean
  sawSection: boolean
}

interface EntryDraft {
  node: RawEntry
  phase: 'header' | 'summary' | 'body'
  summaryLines: string[]
  summaryFirst: number
  bodyLines: string[]
  bodyFirst: number
}

/**
 * Parses the body of a `kind: glossary` file: `## Term {#term-id}` headings, each with optional `=` and
 * `->` lines, then a summary paragraph and an optional body. The summary is the run of lines up to the
 * first blank line, so where the writer put that line decides what a preview card shows.
 */
function parseGlossaryBody(path: string, lines: string[], bodyStart: number, err: Report): RawEntry[] {
  const entries: RawEntry[] = []
  // `as` keeps TypeScript from narrowing this to `null`: the nested functions below reassign it.
  let draft = null as EntryDraft | null
  let gapReported = false
  // An unclosed fence swallows the rest of the file, so later checks would only echo that error.
  let truncated = false

  function eat(i: number, fence: Fence, sink: string[] | null): number {
    const taken = takeFence(lines, i, fence, sink, err)
    if (!taken.closed) truncated = true
    return taken.next
  }

  function finishEntry(): void {
    const d = draft
    draft = null
    if (!d) return
    d.node.summary = block(d.summaryLines, d.summaryFirst)
    d.node.body = block(d.bodyLines, d.bodyFirst)
    if (truncated) return
    if (!d.node.summary.md) {
      err(d.node.line, 'this entry has no summary: write one paragraph directly under the heading, because that paragraph is what a preview card shows')
    } else if (d.node.summary.md.length > SUMMARY_LIMIT) {
      err(
        d.node.summary.line,
        `the summary is ${d.node.summary.md.length} characters, over the limit of ${SUMMARY_LIMIT}: a preview card shows it whole, so shorten it and move the detail into the body, below a blank line`,
      )
    }
  }

  function startEntry(rest: string, line: number): void {
    finishEntry()
    const heading = parseHeading(rest, line, err, ENTRY_HEADING)
    const node: RawEntry = {
      id: heading?.id ?? '',
      term: heading?.title ?? '',
      line,
      file: path,
      names: [],
      see: [],
      summary: { md: '', line: line + 1 },
      body: { md: '', line: line + 1 },
    }
    if (heading) entries.push(node)
    draft = { node, phase: 'header', summaryLines: [], summaryFirst: line + 1, bodyLines: [], bodyFirst: line + 1 }
  }

  function addNames(d: EntryDraft, rest: string, line: number): void {
    const names = rest.split('|').map((name) => name.trim()).filter(Boolean)
    if (names.length === 0) err(line, 'the "=" line has no names: write "= other name | another name", or remove the line')
    for (const text of names) {
      if (slug(text)) d.node.names.push({ text, line })
      else err(line, `the name "${text}" needs at least one letter or digit (a-z, 0-9), because a "[[...]]" link finds a term by its letters`)
    }
  }

  function addSee(d: EntryDraft, rest: string, line: number): void {
    const ids = rest.split('|').map((id) => id.trim()).filter(Boolean)
    if (ids.length === 0) err(line, 'the "->" line has no entries: write "-> entry-id | another-id", or remove the line')
    for (const id of ids) {
      if (ID_PATTERN.test(id)) d.node.see.push({ id, line })
      else err(line, `invalid entry id "${id}" after "->": use the id from the other entry's heading, such as "${slug(id) || 'object-pool'}"`)
    }
  }

  /** Everything from here on belongs to the body, whatever ended the summary. */
  function toBody(d: EntryDraft, line: number): void {
    if (d.phase === 'body') return
    d.phase = 'body'
    d.bodyFirst = line
  }

  let i = bodyStart
  while (i < lines.length) {
    const text = lines[i]
    const line = i + 1

    if (CHAPTER_LINE.test(text)) {
      err(line, 'a glossary file has no chapters: every entry is a "## Term {#term-id}" heading, so remove this "#" line, or move the text to a file without "kind: glossary"')
      i++
      continue
    }
    const heading = SECTION_LINE.exec(text)
    if (heading) {
      startEntry(heading[1] ?? '', line)
      i++
      continue
    }
    if (CONCEPT_LINE.test(text) || VARIANT_LINE.test(text)) {
      err(line, 'a glossary entry has no questions: "??" and "?+" belong in a file of chapters and sections, not in one with "kind: glossary"')
      i++
      continue
    }

    const d = draft
    const fence = openFence(text)
    if (!d) {
      if (text.trim() !== '' && !gapReported) {
        gapReported = true
        err(line, 'text before the first entry is not allowed: start an entry with "## Term {#term-id}" and put the text under it')
      }
      i = fence ? eat(i, fence, null) : i + 1
      continue
    }
    if (fence) {
      toBody(d, line)
      i = eat(i, fence, d.bodyLines)
      continue
    }
    if (text.trim() === '') {
      if (d.phase === 'summary') toBody(d, line)
      if (d.phase === 'body') d.bodyLines.push(text)
      i++
      continue
    }
    if (d.phase === 'header') {
      const names = ACCEPT_LINE.exec(text)
      if (names) {
        addNames(d, names[1] ?? '', line)
        i++
        continue
      }
      const see = SEE_LINE.exec(text)
      if (see) {
        addSee(d, see[1] ?? '', line)
        i++
        continue
      }
      d.phase = 'summary'
      d.summaryFirst = line
    }
    if (d.phase === 'summary') d.summaryLines.push(text)
    else d.bodyLines.push(text)
    i++
  }
  finishEntry()
  return entries
}

/**
 * Parses one content file. Never throws on bad content: problems come back as errors, and the
 * returned model is best-effort, so callers must not use it when `errors` is not empty.
 */
export function parseContentFile(path: string, source: string): ParseResult {
  const errors: ContentError[] = []
  const err: Report = (line, message) => {
    errors.push({ file: path, line, message })
  }
  const lines = source.replace(/^﻿/, '').split(/\r?\n/)
  const front = parseFrontMatter(lines, err)

  // Reading the body would only pile guesses on top of the one real error, which names the key to fix.
  if (front.unknownKind) return { file: { path, book: front.book, chapters: [], entries: [] }, errors }

  if (front.glossary) {
    const entries = parseGlossaryBody(path, lines, front.bodyStart, err)
    if (entries.length === 0 && errors.length === 0) {
      err(1, 'this glossary file has no entries: add "## Term {#term-id}" headings, each with a summary paragraph under it')
    }
    errors.sort((a, b) => a.line - b.line)
    return { file: { path, book: front.book, chapters: [], entries }, errors }
  }

  const chapters: RawChapter[] = []
  // `as` keeps TypeScript from narrowing these to `null`: the nested functions below reassign them.
  let chapter = null as ChapterState | null
  let section = null as SectionState | null
  let draft = null as Draft | null
  let gapReported = false
  let orphanReported = false
  // An unclosed fence swallows the rest of the file, so end-of-file checks would only echo that error.
  let truncated = false

  /** Consumes the fence opened at line index `i`, copying its lines to `sink`; returns the next index. */
  function consumeFence(i: number, fence: Fence, sink: string[] | null): number {
    const taken = takeFence(lines, i, fence, sink, err)
    if (!taken.closed) truncated = true
    return taken.next
  }

  function gapError(line: number): void {
    if (gapReported) return
    gapReported = true
    if (chapter) {
      const name = chapter.valid ? `chapter "${chapter.node.title}"` : 'the chapter heading'
      err(line, `text between ${name} and its first section is not allowed: only blank lines may appear there; start a section with "## Title {#section-id}" and put the text inside it`)
    } else {
      err(line, 'text before the first chapter is not allowed: start with "# Chapter title" (or set "chapter:" in the front matter), then "## Title {#section-id}"')
    }
  }

  function startChapter(title: string, line: number): void {
    gapReported = false
    orphanReported = false
    let valid = true
    if (!title) {
      err(line, 'the chapter heading has no title: write "# Chapter title"')
      valid = false
    } else if (!slug(title)) {
      err(line, `chapter title "${title}" needs at least one letter or digit (a-z, 0-9), because the chapter id is made from it`)
      valid = false
    }
    const node: RawChapter = { id: valid ? slug(title) : '', title: valid ? title : '', line, file: path, sections: [] }
    if (valid) chapters.push(node)
    chapter = { node, valid, sawSection: false }
  }

  function endChapter(): void {
    const current = chapter
    chapter = null
    if (current?.valid && !current.sawSection && !truncated) {
      err(current.node.line, `chapter "${current.node.title}" has no sections: add "## Title {#section-id}" sections under it, or remove the chapter`)
    }
  }

  function startSection(rest: string, line: number): void {
    gapReported = false
    const heading = parseHeading(rest, line, err, SECTION_HEADING)
    const node: RawSection = {
      id: heading?.id ?? '',
      title: heading?.title ?? '',
      line,
      content: { md: '', line: line + 1 },
      concepts: [],
    }
    if (!chapter) {
      if (!orphanReported) {
        orphanReported = true
        err(line, 'this section is not inside a chapter: add "# Chapter title" above it, or set "chapter: <title>" in the front matter')
      }
    } else {
      chapter.sawSection = true
      if (heading) chapter.node.sections.push(node)
    }
    section = { node, phase: 'content', contentLines: [], concept: null }
  }

  function endContent(s: SectionState): void {
    s.phase = 'questions'
    s.node.content = block(s.contentLines, s.node.line + 1)
    if (!s.node.content.md && !truncated) {
      err(s.node.line, 'this section has no content: write the text to read between the heading and the first "??" line')
    }
  }

  function endSection(): void {
    const s = section
    if (!s) return
    section = null
    finishVariant()
    if (s.phase === 'content') {
      endContent(s)
      if (!truncated) err(s.node.line, 'this section has no questions: add at least one "?? <concept-id> <prompt>" line after the content')
    }
  }

  function startVariant(s: SectionState, i: number, kind: '??' | '?+', rest: string): number {
    const line = i + 1
    finishVariant()
    if (s.phase === 'content') endContent(s)
    const marker = parseMarker(kind, rest, line, err)
    if (kind === '??') {
      s.concept = { id: marker.id ?? '', line, variants: [] }
      if (marker.id !== null) s.node.concepts.push(s.concept)
    } else if (!s.concept) {
      err(line, '"?+" adds a variant to the concept above it, but no "??" line comes before it in this section: start the concept with "?? <concept-id> [settings] <prompt>"')
      s.concept = { id: '', line, variants: [] }
    }
    const promptLines = [marker.prompt]
    let next = i + 1
    const fence = openFence(lines[next])
    if (fence) next = consumeFence(next, fence, promptLines)
    draft = {
      concept: s.concept,
      line,
      type: marker.type,
      n: marker.n,
      prompt: { md: promptLines.join('\n'), line },
      correct: [],
      wrong: [],
      accepted: [],
      answer: null,
      stars: 0,
      explanation: null,
    }
    return next
  }

  function finishVariant(): void {
    const d = draft
    draft = null
    if (!d) return
    const explanation = d.explanation ? block(d.explanation.lines, d.explanation.first) : { md: '', line: d.line }
    if (!truncated) {
      if (!explanation.md) err(d.line, 'this variant has no explanation: add a "> text" line after the options')
      if (d.type === 'mc' && !d.correct.length) err(d.line, 'a multiple-choice variant needs at least one "* correct option" line')
      if (d.type === 'mc' && !d.wrong.length) err(d.line, 'a multiple-choice variant needs at least one "- wrong option" line')
      if (d.type === 'multi' && !d.correct.length) err(d.line, 'a [multi] variant needs at least one "* correct option" line')
      if (d.type === 'tf' && d.stars === 0) err(d.line, 'a [tf] variant needs one line, "* true" or "* false"')
      if (d.type === 'short' && !d.accepted.length) err(d.line, 'a [short] variant needs at least one accepted answer: "= answer | another answer"')
    }
    const base = { line: d.line, prompt: d.prompt, explanation }
    if (d.type === 'tf') d.concept.variants.push({ ...base, type: 'tf', answer: d.answer ?? false })
    else if (d.type === 'short') d.concept.variants.push({ ...base, type: 'short', accepted: d.accepted })
    else d.concept.variants.push({ ...base, type: d.type, correct: d.correct, wrong: d.wrong, n: d.n })
  }

  function addOption(d: Draft, correct: boolean, value: string, line: number): void {
    if (d.type === 'short') {
      err(line, `a [short] variant takes "= answer | another answer" lines, not "${correct ? '*' : '-'}" options: replace this line with an "=" line`)
    } else if (d.type === 'tf') {
      if (!correct) {
        err(line, 'a [tf] variant takes one "* true" or "* false" line and no "-" lines: remove this line')
      } else if (d.stars > 0) {
        err(line, 'a [tf] variant takes exactly one "*" line: remove this extra one')
      } else {
        d.stars++
        const answer = value.toLowerCase()
        if (answer === 'true' || answer === 'false') d.answer = answer === 'true'
        else err(line, `a [tf] answer must be "* true" or "* false", got "* ${clip(value)}"`)
      }
    } else {
      ;(correct ? d.correct : d.wrong).push({ md: value, line })
    }
  }

  /** Handles one non-blank line of a question block that is not a `??` or `?+` marker. */
  function readQuestionLine(text: string, line: number): void {
    const d = draft
    if (!d) return

    const option = OPTION_LINE.exec(text)
    if (option) {
      const value = (option[2] ?? '').trim()
      if (value) addOption(d, option[1] === '*', value, line)
      else err(line, `the option has no text: write "${option[1]} text"`)
      return
    }
    const accept = ACCEPT_LINE.exec(text)
    if (accept) {
      if (d.type === 'short') {
        d.accepted.push(...(accept[1] ?? '').split('|').map((answer) => answer.trim()).filter(Boolean))
      } else {
        err(line, '"=" answers only apply to [short] variants: remove this line, or add "short" to the settings and drop the "*" and "-" lines')
      }
      return
    }
    const explain = EXPLAIN_LINE.exec(text)
    if (explain) {
      const part = explain[1] ?? ''
      if (!d.explanation) {
        d.explanation = { lines: [part], first: line, last: line }
      } else if (d.explanation.last === line - 1) {
        d.explanation.lines.push(part)
        d.explanation.last = line
      } else {
        err(line, `this variant already has an explanation (line ${d.explanation.first}): keep all its "> " lines together, and write a lone ">" for a paragraph break`)
      }
      return
    }
    err(line, unexpectedLineMessage(text))
  }

  if (front.chapter) startChapter(front.chapter.title, front.chapter.line)

  let i = front.bodyStart
  while (i < lines.length) {
    const text = lines[i]
    const line = i + 1

    const chapterHeading = CHAPTER_LINE.exec(text)
    if (chapterHeading) {
      endSection()
      endChapter()
      startChapter(chapterHeading[1] ?? '', line)
      i++
      continue
    }
    const sectionHeading = SECTION_LINE.exec(text)
    if (sectionHeading) {
      endSection()
      startSection(sectionHeading[1] ?? '', line)
      i++
      continue
    }

    const s = section
    const fence = openFence(text)
    if (!s) {
      if (text.trim() !== '') gapError(line)
      i = fence ? consumeFence(i, fence, null) : i + 1
      continue
    }
    if (fence) {
      if (s.phase === 'content') {
        i = consumeFence(i, fence, s.contentLines)
      } else {
        err(line, 'a code block is only allowed directly after a "??" or "?+" line, where it becomes part of the prompt: move it there, or move it above the first "??" line')
        i = consumeFence(i, fence, null)
      }
      continue
    }

    const concept = CONCEPT_LINE.exec(text)
    const variant = concept ? null : VARIANT_LINE.exec(text)
    const marker = concept ?? variant
    if (marker) {
      i = startVariant(s, i, concept ? '??' : '?+', marker[1] ?? '')
      continue
    }
    if (s.phase === 'content') s.contentLines.push(text)
    else if (text.trim() !== '') readQuestionLine(text, line)
    i++
  }
  endSection()
  endChapter()

  if (chapters.length === 0 && errors.length === 0) {
    err(1, 'the file has no sections: add "# Chapter title" and "## Title {#section-id}" after the front matter')
  }
  errors.sort((a, b) => a.line - b.line)
  return { file: { path, book: front.book, chapters, entries: [] }, errors }
}
