import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { assembleBooks, findContentFiles } from './load.ts'
import type { RawBook, Source } from './load.ts'
import { ID_PATTERN, findFenceEnd, formatError, openFence, parseContentFile, slug } from './parse.ts'
import type { ContentError, RawConcept, RawSection, RawVariant, Text } from './parse.ts'

/**
 * What `questions` accepts besides moved lines: nothing; wrong options changed, added and removed; or
 * whole chapters none of whose sections is at the base revision.
 */
export type Allow = 'distractors' | 'new-chapters' | null

/** A chapter that `--allow new-chapters` let through, and what it holds. */
export interface NewChapter {
  book: string
  title: string
  file: string
  sections: number
  concepts: number
  variants: number
}

export interface QuestionReport {
  errors: ContentError[]
  sections: number
  concepts: number
  variants: number
  /** Wrong options that `--allow distractors` let through, counted as texts that appeared and disappeared. */
  distractors: { added: number; removed: number }
  /** In the order the site shows them. */
  newChapters: NewChapter[]
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

interface ChapterAt {
  book: string
  title: string
  file: string
  /** Keyed `book/section`. */
  sections: string[]
}

interface Index {
  /** Keyed `book/section`, in the order the site shows them. */
  sections: Map<string, SectionAt>
  /** Keyed `book/concept`: concept ids are unique within a book, so a concept is found wherever it moved. */
  concepts: Map<string, ConceptAt>
  /** In the order the site shows them. */
  chapters: ChapterAt[]
}

const bookOf = (key: string) => key.slice(0, key.indexOf('/'))
const idOf = (key: string) => key.slice(key.indexOf('/') + 1)

function index(books: RawBook[]): Index {
  const sections = new Map<string, SectionAt>()
  const concepts = new Map<string, ConceptAt>()
  const chapters: ChapterAt[] = []
  for (const book of books) {
    for (const chapter of book.chapters) {
      const keys: string[] = []
      for (const section of chapter.sections) {
        keys.push(`${book.id}/${section.id}`)
        sections.set(`${book.id}/${section.id}`, { id: section.id, file: chapter.file, line: section.line, concepts: section.concepts.map((c) => c.id) })
        for (const concept of section.concepts) concepts.set(`${book.id}/${concept.id}`, { section: section.id, file: chapter.file, concept })
      }
      chapters.push({ book: book.id, title: chapter.title, file: chapter.file, sections: keys })
    }
  }
  return { sections, concepts, chapters }
}

/**
 * The chapters of `now` none of whose sections is in `old`, and the keys of their sections. A chapter is
 * recognized by its sections rather than its title, because a title may change and a section id may not.
 */
function findNewChapters(old: Index, now: Index): { sections: Set<string>; chapters: NewChapter[] } {
  const sections = new Set<string>()
  const chapters: NewChapter[] = []
  for (const chapter of now.chapters) {
    if (chapter.sections.some((key) => old.sections.has(key))) continue
    const concepts = chapter.sections.flatMap((key) => now.sections.get(key)!.concepts)
    const variants = concepts.reduce((sum, id) => sum + now.concepts.get(`${chapter.book}/${id}`)!.concept.variants.length, 0)
    for (const key of chapter.sections) sections.add(key)
    chapters.push({ book: chapter.book, title: chapter.title, file: chapter.file, sections: chapter.sections.length, concepts: concepts.length, variants })
  }
  return { sections, chapters }
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
 * change, appear or disappear. With `allow: 'new-chapters'`, a chapter none of whose sections is at
 * `rev` may be new, sections, concepts and all. Everything else, and every section id and its place,
 * must be the same.
 */
export function compareQuestions(base: Source[], work: Source[], { rev, allow }: { rev: string; allow: Allow }): QuestionReport {
  const report = emptyReport()
  const loaded = loadBoth(base, work, rev, report)
  if (!loaded) return report
  const { old, now } = loaded
  const note = noter(report)
  const gone = `(this line is at ${rev})`
  const accepted = allow === 'new-chapters' ? findNewChapters(old, now) : { sections: new Set<string>(), chapters: [] }
  report.newChapters = accepted.chapters

  compareSections(old, now, rev, note, accepted.sections)
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
    if (old.concepts.has(key) || accepted.sections.has(`${bookOf(key)}/${is.section}`)) continue
    note(is.file, is.concept.line, `concept "${is.concept.id}" is new: it is not at ${rev}`)
  }
  compareConceptOrder(old, now, rev, note)
  return finish(report, now)
}

function emptyReport(): QuestionReport {
  return { errors: [], sections: 0, concepts: 0, variants: 0, distractors: { added: 0, removed: 0 }, newChapters: [] }
}

function noter(report: QuestionReport): (file: string, line: number, message: string) => void {
  return (file, line, message) => report.errors.push({ file, line, message })
}

/**
 * Before books had ids, `book:` gave the title and the id was its slug. Reads such a line as that id,
 * in place so every line number stays put, and leaves the title out, since no comparison uses it.
 */
function withBookId(source: Source): Source {
  const lines = source.text.split('\n')
  if (lines[0].trim() !== '---') return source
  for (let i = 1; i < lines.length && lines[i].trim() !== '---'; i++) {
    const match = /^(\s*book\s*:\s*)(.*?)(\s*)$/.exec(lines[i])
    if (!match) continue
    const id = slug(match[2])
    if (!id || ID_PATTERN.test(match[2])) return source
    lines[i] = match[1] + id + match[3]
    return { ...source, text: lines.join('\n') }
  }
  return source
}

/**
 * Both versions indexed, or null after reporting their content errors: a best-effort model would only
 * add noise. The base may be older than book ids.
 */
function loadBoth(base: Source[], work: Source[], rev: string, report: QuestionReport): { old: Index; now: Index } | null {
  const before = assembleBooks(base.map(withBookId))
  const after = assembleBooks(work)
  for (const error of before.errors) report.errors.push({ ...error, message: `at ${rev}: ${error.message}` })
  report.errors.push(...after.errors)
  return report.errors.length > 0 ? null : { old: index(before.books), now: index(after.books) }
}

/** Section ids and their order may never change, whatever else is allowed, except that the sections in `accepted` may be new. */
function compareSections(old: Index, now: Index, rev: string, note: ReturnType<typeof noter>, accepted: ReadonlySet<string> = new Set()): void {
  const gone = `(this line is at ${rev})`
  for (const [key, section] of old.sections) {
    if (!now.sections.has(key)) note(section.file, section.line, `section "${section.id}" is gone ${gone}: section ids may not change, so restore it or its id`)
  }
  for (const [key, section] of now.sections) {
    if (!old.sections.has(key) && !accepted.has(key)) note(section.file, section.line, `section "${section.id}" is new: section ids may not change, and it is not at ${rev}`)
  }
  const placed = (key: string | null) => (key ? `after "${idOf(key)}"` : 'first in its book')
  for (const move of moved([...old.sections.keys()], [...now.sections.keys()])) {
    const section = now.sections.get(move.key)!
    note(section.file, section.line, `section "${section.id}" has moved: at ${rev} it came ${placed(move.was)}, and now it comes ${placed(move.now)}`)
  }
}

/** The concepts each section shares with the other version must keep their order. */
function compareConceptOrder(old: Index, now: Index, rev: string, note: ReturnType<typeof noter>): void {
  for (const [key, section] of now.sections) {
    const was = old.sections.get(key)
    if (!was) continue
    for (const move of moved(was.concepts, section.concepts)) {
      const concept = now.concepts.get(`${bookOf(key)}/${move.key}`)!
      const where = (id: string | null) => (id ? `after "${id}"` : 'first')
      note(concept.file, concept.concept.line, `concept "${move.key}" has moved within section "${section.id}": at ${rev} it came ${where(move.was)}, and now it comes ${where(move.now)}`)
    }
  }
}

function finish(report: QuestionReport, now: Index): QuestionReport {
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

/** A variant named by its concept and its number from 1, the way the guard's messages number them. */
export interface VariantRef {
  from: string
  variant: number
}

/**
 * The question-structure changes `questions --allow structure` accepts, read from a JSON file. A source
 * variant is numbered as it stands at the base revision, an added variant as it stands after the change.
 */
export interface StructureChanges {
  about?: string
  newConcepts: { id: string; section: string; variants: VariantRef[] }[]
  movedVariants: (VariantRef & { to: string })[]
  addedVariants: { concept: string; variant: number }[]
  addedAnswers: { concept: string; variant: number; answers: string[] }[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

type Field = 'string' | 'number' | 'strings' | 'list'

const FIELD_NAMES: Record<Field, string> = {
  string: 'a non-empty string',
  number: 'a whole number from 1',
  strings: 'a non-empty list of non-empty strings',
  list: 'a non-empty list',
}

/** Reads a changes file and checks its shape; whether what it names exists is checked against the content. */
export function readStructureChanges(text: string, file: string): { changes: StructureChanges | null; errors: ContentError[] } {
  const errors: ContentError[] = []
  const fail = (message: string) => errors.push({ file, line: 1, message })
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (error) {
    fail(`not valid JSON: ${(error as Error).message}`)
    return { changes: null, errors }
  }
  const keys = ['about', 'newConcepts', 'movedVariants', 'addedVariants', 'addedAnswers']
  if (!isRecord(data)) {
    fail(`the file must hold one object, with the keys ${keys.map((key) => `"${key}"`).join(', ')}`)
    return { changes: null, errors }
  }
  for (const key of Object.keys(data)) if (!keys.includes(key)) fail(`unknown key "${key}": the keys are ${keys.map((k) => `"${k}"`).join(', ')}`)
  if (data.about !== undefined && typeof data.about !== 'string') fail('"about" must be a string')

  const list = (key: string): unknown[] => {
    const value = data[key]
    if (value === undefined) return []
    if (Array.isArray(value)) return value
    fail(`"${key}" must be a list`)
    return []
  }
  const entry = (where: string, value: unknown, fields: Record<string, Field>): Record<string, unknown> | null => {
    if (!isRecord(value)) {
      fail(`${where} must be an object with ${Object.keys(fields).map((key) => `"${key}"`).join(', ')}`)
      return null
    }
    let ok = true
    for (const key of Object.keys(value)) {
      if (!(key in fields)) {
        fail(`${where} has an unknown key "${key}"`)
        ok = false
      }
    }
    for (const [key, kind] of Object.entries(fields)) {
      const v = value[key]
      const good =
        kind === 'string' ? typeof v === 'string' && v.trim() !== ''
        : kind === 'number' ? Number.isInteger(v) && (v as number) >= 1
        : kind === 'strings' ? Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === 'string' && s.trim() !== '')
        : Array.isArray(v) && v.length > 0
      if (!good) {
        fail(`${where}: "${key}" must be ${FIELD_NAMES[kind]}`)
        ok = false
      }
    }
    return ok ? value : null
  }

  const changes: StructureChanges = { newConcepts: [], movedVariants: [], addedVariants: [], addedAnswers: [] }
  if (typeof data.about === 'string') changes.about = data.about
  list('newConcepts').forEach((raw, i) => {
    const e = entry(`newConcepts[${i}]`, raw, { id: 'string', section: 'string', variants: 'list' })
    if (!e) return
    const variants = (e.variants as unknown[]).flatMap((ref, j) => {
      const r = entry(`newConcepts[${i}].variants[${j}]`, ref, { from: 'string', variant: 'number' })
      return r ? [{ from: r.from as string, variant: r.variant as number }] : []
    })
    changes.newConcepts.push({ id: e.id as string, section: e.section as string, variants })
  })
  list('movedVariants').forEach((raw, i) => {
    const e = entry(`movedVariants[${i}]`, raw, { from: 'string', variant: 'number', to: 'string' })
    if (e) changes.movedVariants.push({ from: e.from as string, variant: e.variant as number, to: e.to as string })
  })
  list('addedVariants').forEach((raw, i) => {
    const e = entry(`addedVariants[${i}]`, raw, { concept: 'string', variant: 'number' })
    if (e) changes.addedVariants.push({ concept: e.concept as string, variant: e.variant as number })
  })
  list('addedAnswers').forEach((raw, i) => {
    const e = entry(`addedAnswers[${i}]`, raw, { concept: 'string', variant: 'number', answers: 'strings' })
    if (e) changes.addedAnswers.push({ concept: e.concept as string, variant: e.variant as number, answers: (e.answers as string[]).map((a) => a.trim()) })
  })
  return { changes: errors.length > 0 ? null : changes, errors }
}

/** What one position of a concept should hold after the change: a variant from the base, or null for an added one. */
type Slot = { variant: RawVariant; origin: string | null } | null

/**
 * Compares question blocks like `compareQuestions`, except that the structure changes the file lists are
 * expected: a new concept holding the variants it takes, a variant moved to the end of another concept, an
 * added variant, and added accepted answers. Every base concept must survive, and a concept may give up
 * only its last variants, because progress records name variants by position.
 */
export function compareStructure(base: Source[], work: Source[], { rev, changes, file }: { rev: string; changes: StructureChanges; file: string }): QuestionReport {
  const report = emptyReport()
  const loaded = loadBoth(base, work, rev, report)
  if (!loaded) return report
  const { old, now } = loaded
  const note = noter(report)
  const changeError = (message: string) => note(file, 1, message)

  // Ids in the changes file carry no book, so each must name exactly one concept at the base.
  const oldKey = (id: string, role: string): string | null => {
    const keys = [...old.concepts.keys()].filter((key) => idOf(key) === id)
    if (keys.length === 1) return keys[0]
    changeError(keys.length === 0 ? `${role} "${id}" is not a concept at ${rev}` : `${role} "${id}" names a concept in more than one book`)
    return null
  }
  const leaving = new Map<string, Set<number>>()
  const take = (ref: VariantRef, role: string): { key: string; variant: RawVariant; origin: string } | null => {
    const key = oldKey(ref.from, role)
    if (!key) return null
    const variants = old.concepts.get(key)!.concept.variants
    if (ref.variant > variants.length) {
      changeError(`${role} names variant ${ref.variant} of "${ref.from}", which has ${variants.length} at ${rev}`)
      return null
    }
    const taken = leaving.get(key) ?? new Set<number>()
    if (taken.has(ref.variant - 1)) {
      changeError(`variant ${ref.variant} of "${ref.from}" is taken twice`)
      return null
    }
    leaving.set(key, taken.add(ref.variant - 1))
    return { key, variant: variants[ref.variant - 1], origin: `variant ${ref.variant} of "${ref.from}" at ${rev}` }
  }

  const expected = new Map<string, Slot[]>()
  const newSections = new Map<string, string>()
  for (const concept of changes.newConcepts) {
    const role = `new concept "${concept.id}"`
    const sources = concept.variants.map((ref) => take(ref, role))
    if (!ID_PATTERN.test(concept.id)) {
      changeError(`${role} is not a valid id: use lowercase letters, digits and single hyphens`)
      continue
    }
    const first = sources.find((source) => source !== null)
    if (!first) continue
    const key = `${bookOf(first.key)}/${concept.id}`
    if (old.concepts.has(key) || newSections.has(key)) {
      changeError(`${role} is ${old.concepts.has(key) ? `already a concept at ${rev}` : 'listed twice'}`)
      continue
    }
    for (const source of sources) {
      const section = source && old.concepts.get(source.key)!.section
      if (section && section !== concept.section) {
        changeError(`${role} is placed in section "${concept.section}", but its variant from "${idOf(source.key)}" is in section "${section}": a concept split off another stays in its section`)
      }
    }
    newSections.set(key, concept.section)
    expected.set(key, sources.flatMap((source) => (source ? [{ variant: source.variant, origin: source.origin }] : [])))
  }
  const moves = changes.movedVariants.flatMap((move) => {
    const source = take(move, 'moved variant')
    const to = oldKey(move.to, 'destination')
    if (source && to === source.key) changeError(`variant ${move.variant} of "${move.from}" is moved to the concept it is already in`)
    return source && to && to !== source.key ? [{ to, slot: { variant: source.variant, origin: source.origin } }] : []
  })

  for (const [key, at] of old.concepts) {
    const count = at.concept.variants.length
    const taken = leaving.get(key) ?? new Set<number>()
    const early = [...taken].filter((i) => i < count - taken.size).map((i) => i + 1)
    if (early.length > 0) {
      changeError(`"${at.concept.id}" would give up variant ${early.join(', ')} while a later one stays: take its last variants only, so the ones that stay keep their numbers, which progress records store`)
    }
    if (taken.size === count) changeError(`"${at.concept.id}" would be left with no variants, and every concept id has to survive`)
    expected.set(key, at.concept.variants.flatMap((variant, i) => (taken.has(i) ? [] : [{ variant, origin: null }])))
  }
  for (const move of moves) expected.get(move.to)!.push(move.slot)
  for (const added of changes.addedVariants) {
    const key = oldKey(added.concept, 'added variant')
    if (!key) continue
    const slots = expected.get(key)!
    if (added.variant !== slots.length + 1) {
      changeError(`the added variant of "${added.concept}" is listed as variant ${added.variant}, but added variants follow the others, so it is variant ${slots.length + 1}`)
      continue
    }
    slots.push(null)
  }
  for (const added of changes.addedAnswers) {
    const key = oldKey(added.concept, 'added answers')
    if (!key) continue
    const slot = expected.get(key)![added.variant - 1]
    if (!slot || slot.origin !== null || slot.variant.type !== 'short') {
      changeError(`added answers name variant ${added.variant} of "${added.concept}", which has to be a short-answer variant that stays in place`)
      continue
    }
    const repeated = added.answers.filter((answer) => slot.variant.type === 'short' && slot.variant.accepted.includes(answer))
    if (repeated.length > 0) changeError(`added answers for "${added.concept}" repeat ${repeated.map((a) => `"${a}"`).join(', ')}, which it already accepts`)
    expected.get(key)![added.variant - 1] = { variant: { ...slot.variant, accepted: [...slot.variant.accepted, ...added.answers] }, origin: null }
  }

  compareSections(old, now, rev, note)
  for (const [key, was] of old.concepts) {
    const is = now.concepts.get(key)
    if (!is) note(was.file, was.concept.line, `concept "${was.concept.id}" is gone (this line is at ${rev}): every concept id has to survive a structure change`)
    else if (is.section !== was.section) note(is.file, is.concept.line, `concept "${is.concept.id}" has moved from section "${was.section}" to section "${is.section}"`)
  }
  for (const [key, section] of newSections) {
    const is = now.concepts.get(key)
    if (!is) changeError(`the changes file lists new concept "${idOf(key)}", but the book has no such concept`)
    else if (is.section !== section) note(is.file, is.concept.line, `concept "${idOf(key)}" is in section "${is.section}", but the changes file places it in "${section}"`)
  }
  for (const [key, is] of now.concepts) {
    if (!old.concepts.has(key) && !newSections.has(key)) note(is.file, is.concept.line, `concept "${is.concept.id}" is new, and the changes file does not list it`)
  }
  compareConceptOrder(old, now, rev, note)
  for (const [key, slots] of expected) {
    const is = now.concepts.get(key)
    if (is) compareSlots(slots, is, rev, report)
  }
  return finish(report, now)
}

function compareSlots(slots: Slot[], actual: ConceptAt, rev: string, report: QuestionReport): void {
  const { file, concept } = actual
  if (concept.variants.length !== slots.length) {
    report.errors.push({ file, line: concept.line, message: `concept "${concept.id}" has ${concept.variants.length} variants, where the changes file leads to ${slots.length}` })
  }
  for (let i = 0; i < Math.min(slots.length, concept.variants.length); i++) {
    const slot = slots[i]
    if (!slot) continue
    const label = `concept "${concept.id}", variant ${i + 1}${slot.origin ? `, which was ${slot.origin}` : ''}`
    compareVariant(slot.variant, concept.variants[i], file, label, rev, null, report)
  }
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

const USAGE = `usage: npm run guard -- questions [--base <rev>] [--allow distractors | --allow new-chapters]
       npm run guard -- questions [--base <rev>] --allow structure --changes <file>
       npm run guard -- style

questions  compares every question block with the one at <rev> (default HEAD), ignoring line numbers;
           --allow distractors accepts changed "-" options, --allow new-chapters accepts every chapter
           none of whose sections is at <rev>, and --allow structure accepts the new concepts, moved
           and added variants, and added answers that the JSON changes file lists
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

const many = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

function usage(problem: string): number {
  console.error(`${problem}\n\n${USAGE}`)
  return 2
}

function runQuestions(root: string, args: string[]): number {
  let rev = 'HEAD'
  let allow: Allow | 'structure' = null
  let changesFile: string | null = null
  for (let i = 0; i < args.length; i++) {
    const value = args[i + 1]
    if (args[i] === '--base' && value) rev = value
    else if (args[i] === '--allow' && (value === 'distractors' || value === 'new-chapters' || value === 'structure')) allow = value
    else if (args[i] === '--changes' && value) changesFile = value
    else return usage(`unknown or incomplete option "${args.slice(i).join(' ')}"`)
    i++
  }
  if ((allow === 'structure') !== (changesFile !== null)) return usage('--allow structure and --changes <file> go together')
  let base: Source[]
  try {
    base = readRevision(root, rev)
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim()
    return usage(`cannot read content/ at "${rev}": ${stderr || (error as Error).message}`)
  }
  let report: QuestionReport
  if (allow === 'structure' && changesFile !== null) {
    let text: string
    try {
      text = readFileSync(path.resolve(changesFile), 'utf8')
    } catch (error) {
      return usage(`cannot read the changes file "${changesFile}": ${(error as Error).message}`)
    }
    const { changes, errors } = readStructureChanges(text, changesFile)
    if (!changes) {
      for (const error of errors) console.error(formatError(error))
      return 1
    }
    report = compareStructure(base, readWorkingTree(root), { rev, changes, file: changesFile })
    if (report.errors.length === 0) {
      const counts = [many(changes.newConcepts.length, 'new concept'), many(changes.movedVariants.length, 'moved variant'), many(changes.addedVariants.length, 'added variant'), many(changes.addedAnswers.length, 'added answer')].join(', ')
      console.log(`questions match ${rev} with the listed structure changes (${counts}): ${report.sections} sections, ${report.concepts} concepts, ${report.variants} variants`)
      return 0
    }
  } else {
    report = compareQuestions(base, readWorkingTree(root), { rev, allow: allow === 'structure' ? null : allow })
  }
  if (report.errors.length > 0) {
    for (const error of report.errors) console.error(formatError(error))
    console.error(`\nquestions differ from ${rev}: ${report.errors.length} ${report.errors.length === 1 ? 'difference' : 'differences'}`)
    return 1
  }
  const counts = `${report.sections} sections, ${report.concepts} concepts, ${report.variants} variants`
  const { added, removed } = report.distractors
  if (allow === 'distractors') console.log(`questions match ${rev}: ${counts}; wrong options allowed to differ: ${added} new, ${removed} gone`)
  else if (allow === 'new-chapters') {
    console.log(`questions match ${rev}: ${counts}; new chapters accepted: ${report.newChapters.length}`)
    for (const c of report.newChapters) {
      console.log(`  ${c.book}: ${c.title}, ${many(c.sections, 'section')}, ${many(c.concepts, 'concept')}, ${many(c.variants, 'variant')} (${c.file})`)
    }
  } else console.log(`questions match ${rev}: ${counts}`)
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
