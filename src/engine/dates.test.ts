import { describe, expect, test } from 'vitest'
import { inTimeZone } from '../test-helpers'
import { addDays, compareDates, isLocalDate, toLocalDate } from './dates'

// Zones on both sides of UTC, with a half-hour offset, a 30-minute DST step, and DST that starts at midnight.
const ZONES = [
  'UTC',
  'Pacific/Auckland',
  'Pacific/Kiritimati',
  'Pacific/Pago_Pago',
  'America/Los_Angeles',
  'America/New_York',
  'America/Havana',
  'Europe/London',
  'Asia/Kolkata',
  'Australia/Lord_Howe',
]

/** Independent reference: day arithmetic in UTC, where there are no zones or DST. */
function reference(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

describe('toLocalDate', () => {
  test('the zone switch used by these tests works: the UTC date of a local time can be another day', () => {
    inTimeZone('Pacific/Auckland', () => {
      expect(new Date(2026, 0, 1, 0, 30).toISOString().slice(0, 10)).toBe('2025-12-31')
    })
    inTimeZone('America/Los_Angeles', () => {
      expect(new Date(2026, 0, 1, 23, 30).toISOString().slice(0, 10)).toBe('2026-01-02')
    })
  })

  test.each(ZONES)('is the local calendar date at any time of day in %s', (zone) => {
    inTimeZone(zone, () => {
      for (const [hour, minute] of [[0, 0], [0, 30], [6, 0], [12, 0], [18, 0], [23, 30], [23, 59]]) {
        expect(toLocalDate(new Date(2026, 0, 1, hour, minute))).toBe('2026-01-01')
        expect(toLocalDate(new Date(2026, 6, 15, hour, minute))).toBe('2026-07-15')
        expect(toLocalDate(new Date(2026, 11, 31, hour, minute))).toBe('2026-12-31')
      }
    })
  })

  test('one instant is a different local date in different zones', () => {
    const instant = new Date('2026-03-08T04:30:00Z')
    inTimeZone('America/Los_Angeles', () => expect(toLocalDate(instant)).toBe('2026-03-07'))
    inTimeZone('UTC', () => expect(toLocalDate(instant)).toBe('2026-03-08'))
    inTimeZone('Pacific/Auckland', () => expect(toLocalDate(instant)).toBe('2026-03-08'))
  })

  test('pads month and day, and counts months from 1', () => {
    expect(toLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toLocalDate(new Date(2026, 8, 9))).toBe('2026-09-09')
    expect(toLocalDate(new Date(2026, 9, 10))).toBe('2026-10-10')
  })
})

describe('addDays', () => {
  test('moves across month, year and leap-day boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(addDays('2100-02-28', 1)).toBe('2100-03-01')
    expect(addDays('2000-02-28', 1)).toBe('2000-02-29')
  })

  test('adds the box intervals', () => {
    expect(addDays('2026-09-19', 1)).toBe('2026-09-20')
    expect(addDays('2026-09-19', 3)).toBe('2026-09-22')
    expect(addDays('2026-09-19', 7)).toBe('2026-09-26')
    expect(addDays('2026-09-19', 14)).toBe('2026-10-03')
    expect(addDays('2026-09-19', 30)).toBe('2026-10-19')
  })

  test('zero changes nothing and negative days go back', () => {
    expect(addDays('2026-09-19', 0)).toBe('2026-09-19')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2026-09-19', -30)).toBe('2026-08-20')
  })

  test('matches an independent UTC calculation for every day of 13 years', () => {
    const steps = [-400, -30, -14, -7, -3, -1, 0, 1, 3, 7, 14, 30, 365, 366, 1000]
    for (let day = 0; day < 4748; day++) {
      const date = reference('2020-01-01', day)
      for (const step of steps) expect(addDays(date, step)).toBe(reference(date, step))
    }
  })

  test.each(ZONES)('never drifts across daylight-saving changes in %s', (zone) => {
    // The days around the 2026 clock changes of the zones above (New York, Havana, London, Auckland, Lord Howe).
    const transitions = ['2026-03-08', '2026-03-29', '2026-04-05', '2026-09-27', '2026-10-04', '2026-10-25', '2026-11-01']
    inTimeZone(zone, () => {
      for (const transition of transitions) {
        for (const offset of [-1, 0, 1]) {
          const date = addDays(transition, offset)
          for (const step of [-30, -1, 1, 3, 7, 14, 30]) expect(addDays(date, step)).toBe(reference(date, step))
        }
      }
    })
  })

  test('rejects a date that is not a calendar date, and a fractional number of days', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError)
    expect(() => addDays('tomorrow', 1)).toThrow(RangeError)
    expect(() => addDays('2026-09-19', 0.5)).toThrow(RangeError)
    expect(() => addDays('2026-09-19', Number.NaN)).toThrow(RangeError)
  })
})

describe('compareDates', () => {
  test('orders by calendar date', () => {
    expect(compareDates('2026-01-31', '2026-02-01')).toBeLessThan(0)
    expect(compareDates('2026-02-01', '2026-01-31')).toBeGreaterThan(0)
    expect(compareDates('2026-09-19', '2026-09-19')).toBe(0)
    expect(compareDates('2025-12-31', '2026-01-01')).toBeLessThan(0)
    expect(compareDates('2026-09-30', '2026-10-01')).toBeLessThan(0)
    expect(compareDates('2026-10-01', '2026-09-30')).toBeGreaterThan(0)
  })
})

describe('isLocalDate', () => {
  test('accepts real calendar dates', () => {
    for (const date of ['2026-09-19', '2024-02-29', '2000-02-29', '2026-12-31', '2026-01-01']) {
      expect(isLocalDate(date)).toBe(true)
    }
  })

  test('rejects impossible dates, other shapes and other types', () => {
    for (const date of ['2026-02-29', '2100-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-01-00']) {
      expect(isLocalDate(date)).toBe(false)
    }
    for (const date of ['2026-1-1', '26-01-01', '2026-01-01T00:00', ' 2026-01-01', '', 'garbage']) {
      expect(isLocalDate(date)).toBe(false)
    }
    for (const value of [null, undefined, 20260101, new Date(0), {}]) expect(isLocalDate(value)).toBe(false)
  })
})
