import { isLocalDate } from '../engine/dates'
import { conceptKey, sectionKey } from '../engine/records'
import type { Box, ConceptRecord, HistoryEntry, SectionRecord, VariantRecord } from '../engine/records'

// The backup file. `readProgressExport` checks all of it before anything is used, and copies out only the
// fields it knows, so a file that passes can't carry anything else into the records.

export const EXPORT_FORMAT = 'study-progress'
export const EXPORT_VERSION = 1

export interface ProgressExport {
  format: typeof EXPORT_FORMAT
  version: typeof EXPORT_VERSION
  exportedAt: string
  concepts: ConceptRecord[]
  sections: SectionRecord[]
}

export type ReadResult = { ok: true; data: ProgressExport } | { ok: false; error: string }

export function exportFileName(date: string): string {
  return `study-progress-${date}.json`
}

function byKey(a: { key: string }, b: { key: string }): number {
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
}

/** The file contents, with the records in key order so that two exports of the same progress match. */
export function buildExport(
  concepts: Iterable<ConceptRecord>,
  sections: Iterable<SectionRecord>,
  exportedAt: string,
): ProgressExport {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt,
    concepts: [...concepts].sort(byKey),
    sections: [...sections].sort(byKey),
  }
}

class InvalidExport extends Error {}

function fail(path: string, expected: string): never {
  throw new InvalidExport(`${path}: expected ${expected}`)
}

type Fields = Record<string, unknown>

function isObject(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

// Exactly what `toISOString` writes. Timestamps of one shape sort as text in time order, which is how
// `pickVariant` compares them.
const TIMESTAMP_EXAMPLE = '2026-01-31T09:30:00.000Z'

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  const time = Date.parse(value)
  return !Number.isNaN(time) && new Date(time).toISOString() === value
}

function readTimestamp(value: unknown, path: string): string {
  return isTimestamp(value) ? value : fail(path, `an ISO timestamp such as ${TIMESTAMP_EXAMPLE}`)
}

function readNullableTimestamp(value: unknown, path: string): string | null {
  return value === null ? null : readTimestamp(value, path)
}

function readText(value: unknown, path: string): string {
  return typeof value === 'string' && value !== '' ? value : fail(path, 'a non-empty string')
}

function readBox(value: unknown, path: string): Box | null {
  return value === null || value === 1 || value === 2 || value === 3 || value === 4 || value === 5
    ? value
    : fail(path, 'a box from 1 to 5, or null')
}

function readHistory(value: unknown, path: string): HistoryEntry[] {
  if (!Array.isArray(value)) fail(path, 'an array')
  return value.map((entry: unknown, i): HistoryEntry => {
    const at = `${path}[${i}]`
    if (!isObject(entry)) return fail(at, 'an object')
    if (!isIndex(entry.v)) fail(`${at}.v`, 'a whole number, 0 or more')
    if (typeof entry.ok !== 'boolean') fail(`${at}.ok`, 'true or false')
    if (entry.mode !== 'study' && entry.mode !== 'review') fail(`${at}.mode`, '"study" or "review"')
    return { at: readTimestamp(entry.at, `${at}.at`), v: entry.v, ok: entry.ok, mode: entry.mode }
  })
}

function readVariants(value: unknown, path: string): Record<number, VariantRecord> {
  if (!isObject(value)) fail(path, 'an object')
  const variants: Record<number, VariantRecord> = {}
  for (const [name, entry] of Object.entries(value)) {
    const at = `${path}.${name}`
    if (!/^(0|[1-9]\d*)$/.test(name)) fail(at, 'a variant index: a whole number, 0 or more')
    if (!isObject(entry)) fail(at, 'an object')
    if (typeof entry.lastOk !== 'boolean') fail(`${at}.lastOk`, 'true or false')
    const lastShownAt = readTimestamp(entry.lastShownAt, `${at}.lastShownAt`)
    variants[Number(name)] = { lastShownAt, lastOk: entry.lastOk }
  }
  return variants
}

function readConcept(value: unknown, path: string): ConceptRecord {
  if (!isObject(value)) fail(path, 'an object')
  const bookId = readText(value.bookId, `${path}.bookId`)
  const conceptId = readText(value.conceptId, `${path}.conceptId`)
  const key = conceptKey(bookId, conceptId)
  if (value.key !== key) fail(`${path}.key`, `"${key}" (bookId/conceptId)`)

  const box = readBox(value.box, `${path}.box`)
  const due =
    value.due === null ? null : isLocalDate(value.due) ? value.due : fail(`${path}.due`, 'a date like 2026-01-31, or null')
  if ((box === null) !== (due === null)) {
    fail(`${path}.due`, box === null ? 'null, because box is null' : 'a date, because box is set')
  }

  return {
    key,
    bookId,
    conceptId,
    box,
    due,
    history: readHistory(value.history, `${path}.history`),
    variants: readVariants(value.variants, `${path}.variants`),
  }
}

function readSection(value: unknown, path: string): SectionRecord {
  if (!isObject(value)) fail(path, 'an object')
  const bookId = readText(value.bookId, `${path}.bookId`)
  const sectionId = readText(value.sectionId, `${path}.sectionId`)
  const key = sectionKey(bookId, sectionId)
  if (value.key !== key) fail(`${path}.key`, `"${key}" (bookId/sectionId)`)
  return {
    key,
    bookId,
    sectionId,
    readAt: readNullableTimestamp(value.readAt, `${path}.readAt`),
    completedAt: readNullableTimestamp(value.completedAt, `${path}.completedAt`),
  }
}

function readRecords<T extends { key: string }>(
  value: unknown,
  path: string,
  readRecord: (item: unknown, path: string) => T,
): T[] {
  if (!Array.isArray(value)) fail(path, 'an array')
  const seen = new Set<string>()
  return value.map((item: unknown, i) => {
    const record = readRecord(item, `${path}[${i}]`)
    if (seen.has(record.key)) fail(`${path}[${i}].key`, `a key used once, but "${record.key}" appears twice`)
    seen.add(record.key)
    return record
  })
}

/** Checks the text of a backup file: its format, its version and the shape of every record. */
export function readProgressExport(text: string): ReadResult {
  try {
    let file: unknown
    try {
      file = JSON.parse(text)
    } catch {
      return { ok: false, error: 'the file is not valid JSON' }
    }
    if (!isObject(file) || file.format !== EXPORT_FORMAT) fail('format', `"${EXPORT_FORMAT}"`)
    if (file.version !== EXPORT_VERSION) fail('version', `${EXPORT_VERSION}, but found ${JSON.stringify(file.version)}`)
    return {
      ok: true,
      data: {
        format: EXPORT_FORMAT,
        version: EXPORT_VERSION,
        exportedAt: readTimestamp(file.exportedAt, 'exportedAt'),
        concepts: readRecords(file.concepts, 'concepts', readConcept),
        sections: readRecords(file.sections, 'sections', readSection),
      },
    }
  } catch (error) {
    if (error instanceof InvalidExport) return { ok: false, error: error.message }
    throw error
  }
}
