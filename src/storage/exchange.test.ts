import { describe, expect, test } from 'vitest'
import { answeredRecord, conceptRecord, sectionRecord } from '../test-helpers'
import { buildExport, exportFileName, readProgressExport } from './exchange'

const AT = '2026-09-19T10:00:00.000Z'

/** A valid backup file as a plain object, ready to be broken one field at a time. */
function validFile() {
  return {
    format: 'study-progress',
    version: 1,
    exportedAt: AT,
    concepts: [
      {
        key: 'sys/lru',
        bookId: 'sys',
        conceptId: 'lru',
        box: 2,
        due: '2026-09-22',
        history: [{ at: AT, v: 0, ok: true, mode: 'review' }],
        variants: { '0': { lastShownAt: AT, lastOk: true } },
      },
      { key: 'sys/ttl', bookId: 'sys', conceptId: 'ttl', box: null, due: null, history: [], variants: {} },
    ],
    sections: [{ key: 'sys/cache', bookId: 'sys', sectionId: 'cache', readAt: AT, completedAt: null }],
  }
}

type Edit = (file: any) => void

function text(edit: Edit = () => {}): string {
  const file = validFile()
  edit(file)
  return JSON.stringify(file)
}

function rejection(input: string): string {
  const result = readProgressExport(input)
  if (result.ok) throw new Error('expected the file to be rejected')
  return result.error
}

describe('readProgressExport: a valid file', () => {
  test('is accepted and read back as it was written', () => {
    const result = readProgressExport(text())
    if (!result.ok) throw new Error(result.error)
    expect(result.data).toEqual(validFile())
  })

  test('may have no records', () => {
    const result = readProgressExport(text((f) => Object.assign(f, { concepts: [], sections: [] })))
    expect(result.ok).toBe(true)
  })

  test('is read into the same records that were exported', () => {
    const concepts = [answeredRecord('sys', 'lru', false), conceptRecord('sys', 'ttl', { box: 1, due: '2026-09-20' })]
    const sections = [sectionRecord('sys', 'cache', { readAt: AT, completedAt: AT })]
    const result = readProgressExport(JSON.stringify(buildExport(concepts, sections, AT)))
    if (!result.ok) throw new Error(result.error)
    expect(result.data).toEqual(buildExport(concepts, sections, AT))
  })

  test('drops fields it does not know instead of storing them', () => {
    const result = readProgressExport(
      text((f) => {
        f.extra = 1
        f.concepts[0].extra = 2
        f.concepts[0].history[0].extra = 3
        f.concepts[0].variants['0'].extra = 4
        f.sections[0].extra = 5
      }),
    )
    if (!result.ok) throw new Error(result.error)
    expect(result.data).toEqual(validFile())
  })
})

describe('readProgressExport: a file that is not a backup', () => {
  test('text that is not JSON', () => {
    for (const input of ['', 'not json {', '{"format": ']) expect(rejection(input)).toContain('JSON')
  })

  test.each(['null', '[]', '42', '"study-progress"', 'true'])('JSON that is not an object: %s', (input) => {
    expect(rejection(input)).toContain('format')
  })

  test('the wrong format, or none', () => {
    expect(rejection(text((f) => (f.format = 'other')))).toBe('format: expected "study-progress"')
    expect(rejection(text((f) => delete f.format))).toContain('format')
  })

  test('another version, or none', () => {
    expect(rejection(text((f) => (f.version = 2)))).toBe('version: expected 1, but found 2')
    expect(rejection(text((f) => (f.version = '1')))).toContain('version')
    expect(rejection(text((f) => delete f.version))).toContain('version')
  })
})

// Each case breaks one thing in an otherwise valid file. The error must name where.
const BROKEN: [description: string, edit: Edit, where: string][] = [
  ['no exportedAt', (f) => delete f.exportedAt, 'exportedAt'],
  ['an exportedAt that is not a timestamp', (f) => (f.exportedAt = 'yesterday'), 'exportedAt'],
  ['an exportedAt without milliseconds', (f) => (f.exportedAt = '2026-09-19T10:00:00Z'), 'exportedAt'],
  ['an exportedAt with an offset', (f) => (f.exportedAt = '2026-09-19T10:00:00.000+02:00'), 'exportedAt'],
  ['an exportedAt on a day that does not exist', (f) => (f.exportedAt = '2026-02-30T10:00:00.000Z'), 'exportedAt'],
  ['an exportedAt with hour 25', (f) => (f.exportedAt = '2026-09-19T25:00:00.000Z'), 'exportedAt'],

  ['no concepts', (f) => delete f.concepts, 'concepts'],
  ['concepts that are not a list', (f) => (f.concepts = { a: 1 }), 'concepts'],
  ['a concept that is not an object', (f) => (f.concepts[1] = 5), 'concepts[1]'],
  ['a concept that is null', (f) => (f.concepts[0] = null), 'concepts[0]'],
  ['a concept without bookId', (f) => delete f.concepts[0].bookId, 'concepts[0].bookId'],
  ['a concept with an empty conceptId', (f) => (f.concepts[0].conceptId = ''), 'concepts[0].conceptId'],
  ['a concept whose key is not bookId/conceptId', (f) => (f.concepts[1].key = 'sys/other'), 'concepts[1].key'],
  ['a concept without a key', (f) => delete f.concepts[0].key, 'concepts[0].key'],
  ['box 6', (f) => (f.concepts[0].box = 6), 'concepts[0].box'],
  ['box 0', (f) => (f.concepts[0].box = 0), 'concepts[0].box'],
  ['box as text', (f) => (f.concepts[0].box = '2'), 'concepts[0].box'],
  ['a fractional box', (f) => (f.concepts[0].box = 1.5), 'concepts[0].box'],
  ['no box', (f) => delete f.concepts[0].box, 'concepts[0].box'],
  ['a due date that does not exist', (f) => (f.concepts[0].due = '2026-02-30'), 'concepts[0].due'],
  ['a due date in another format', (f) => (f.concepts[0].due = '19/09/2026'), 'concepts[0].due'],
  ['a due timestamp instead of a date', (f) => (f.concepts[0].due = AT), 'concepts[0].due'],
  ['no due', (f) => delete f.concepts[0].due, 'concepts[0].due'],
  ['a box with no due date', (f) => (f.concepts[0].due = null), 'concepts[0].due'],
  ['a due date with no box', (f) => (f.concepts[1].due = '2026-09-22'), 'concepts[1].due'],
  ['history that is not a list', (f) => (f.concepts[0].history = {}), 'concepts[0].history'],
  ['no history', (f) => delete f.concepts[0].history, 'concepts[0].history'],
  ['a history entry that is not an object', (f) => (f.concepts[0].history[0] = 'x'), 'concepts[0].history[0]'],
  ['a history entry with a bad timestamp', (f) => (f.concepts[0].history[0].at = '2026-09-19'), 'concepts[0].history[0].at'],
  ['a negative variant index in history', (f) => (f.concepts[0].history[0].v = -1), 'concepts[0].history[0].v'],
  ['a fractional variant index in history', (f) => (f.concepts[0].history[0].v = 0.5), 'concepts[0].history[0].v'],
  ['a variant index as text in history', (f) => (f.concepts[0].history[0].v = '0'), 'concepts[0].history[0].v'],
  ['ok as text', (f) => (f.concepts[0].history[0].ok = 'true'), 'concepts[0].history[0].ok'],
  ['a mode other than study or review', (f) => (f.concepts[0].history[0].mode = 'exam'), 'concepts[0].history[0].mode'],
  ['variants that are a list', (f) => (f.concepts[0].variants = []), 'concepts[0].variants'],
  ['no variants', (f) => delete f.concepts[0].variants, 'concepts[0].variants'],
  ['a variant key that is not a number', (f) => (f.concepts[0].variants.x = f.concepts[0].variants['0']), 'concepts[0].variants.x'],
  ['a negative variant key', (f) => (f.concepts[0].variants['-1'] = f.concepts[0].variants['0']), 'concepts[0].variants.-1'],
  ['a variant key with a leading zero', (f) => (f.concepts[0].variants['01'] = f.concepts[0].variants['0']), 'concepts[0].variants.01'],
  ['a variant that is not an object', (f) => (f.concepts[0].variants['0'] = 1), 'concepts[0].variants.0'],
  ['a variant with a bad lastShownAt', (f) => (f.concepts[0].variants['0'].lastShownAt = 'x'), 'concepts[0].variants.0.lastShownAt'],
  ['a variant without lastOk', (f) => delete f.concepts[0].variants['0'].lastOk, 'concepts[0].variants.0.lastOk'],
  ['two concepts with the same key', (f) => f.concepts.push({ ...f.concepts[1] }), 'concepts[2].key'],

  ['no sections', (f) => delete f.sections, 'sections'],
  ['sections that are not a list', (f) => (f.sections = 'none'), 'sections'],
  ['a section that is not an object', (f) => (f.sections[0] = []), 'sections[0]'],
  ['a section without sectionId', (f) => delete f.sections[0].sectionId, 'sections[0].sectionId'],
  ['a section whose key is not bookId/sectionId', (f) => (f.sections[0].key = 'sys/other'), 'sections[0].key'],
  ['a readAt that is not a timestamp', (f) => (f.sections[0].readAt = 'now'), 'sections[0].readAt'],
  ['no readAt', (f) => delete f.sections[0].readAt, 'sections[0].readAt'],
  ['a completedAt that is not a timestamp', (f) => (f.sections[0].completedAt = 5), 'sections[0].completedAt'],
  ['no completedAt', (f) => delete f.sections[0].completedAt, 'sections[0].completedAt'],
  ['two sections with the same key', (f) => f.sections.push({ ...f.sections[0] }), 'sections[1].key'],
]

describe('readProgressExport: a file with one thing wrong', () => {
  test.each(BROKEN)('rejects %s', (_description, edit, where) => {
    expect(rejection(text(edit))).toContain(where)
  })

  test('says what was expected', () => {
    expect(rejection(text((f) => (f.concepts[0].box = 6)))).toBe('concepts[0].box: expected a box from 1 to 5, or null')
    expect(rejection(text((f) => (f.concepts[0].due = '2026-02-30')))).toBe(
      'concepts[0].due: expected a date like 2026-01-31, or null',
    )
  })

  test('reports a problem in a later record even when the first ones are fine', () => {
    const file = validFile()
    for (let i = 0; i < 50; i++) {
      file.concepts.push({ ...file.concepts[1], key: `sys/c${i}`, conceptId: `c${i}` })
    }
    file.concepts[40].box = 9 as never
    expect(rejection(JSON.stringify(file))).toContain('concepts[40].box')
  })
})

describe('buildExport', () => {
  test('has the format, the version, the time of the export and the records', () => {
    const concepts = [answeredRecord('sys', 'lru')]
    const sections = [sectionRecord('sys', 'cache')]
    expect(buildExport(concepts, sections, AT)).toEqual({
      format: 'study-progress',
      version: 1,
      exportedAt: AT,
      concepts,
      sections,
    })
  })

  test('lists records in key order, whatever order they come in', () => {
    const forward = [answeredRecord('a', 'x'), answeredRecord('a', 'y'), answeredRecord('b', 'x')]
    const one = buildExport(forward, [], AT)
    const two = buildExport([...forward].reverse(), [], AT)
    expect(one.concepts.map((r) => r.key)).toEqual(['a/x', 'a/y', 'b/x'])
    expect(two).toEqual(one)
  })

  test('takes records from any iterable, such as the values of a Map', () => {
    const map = new Map([['a/x', answeredRecord('a', 'x')]])
    expect(buildExport(map.values(), [], AT).concepts).toHaveLength(1)
  })
})

describe('exportFileName', () => {
  test('is study-progress-YYYY-MM-DD.json', () => {
    expect(exportFileName('2026-09-19')).toBe('study-progress-2026-09-19.json')
  })
})
