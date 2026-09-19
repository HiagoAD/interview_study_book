import { afterEach, describe, expect, test, vi } from 'vitest'
import { createClock } from './clock'

afterEach(() => vi.unstubAllEnvs())

/** A clock whose current time is whatever `time.now` says. */
function clockAt(time: { now: Date }) {
  return createClock(() => time.now)
}

describe('now', () => {
  test('is the current instant as an ISO timestamp in UTC', () => {
    const time = { now: new Date('2026-09-19T10:15:30.123Z') }
    expect(clockAt(time).now()).toBe('2026-09-19T10:15:30.123Z')
  })

  test('follows the time it is given', () => {
    const time = { now: new Date('2026-09-19T10:00:00.000Z') }
    const clock = clockAt(time)
    time.now = new Date('2026-09-20T11:00:00.000Z')
    expect(clock.now()).toBe('2026-09-20T11:00:00.000Z')
  })
})

describe('today', () => {
  test('is the local date, not the UTC date, in a zone ahead of UTC', () => {
    vi.stubEnv('TZ', 'Pacific/Auckland')
    // 00:30 on the 19th in Auckland is still the 18th in UTC.
    const time = { now: new Date(2026, 8, 19, 0, 30) }
    expect(time.now.toISOString().slice(0, 10)).toBe('2026-09-18')
    expect(clockAt(time).today()).toBe('2026-09-19')
  })

  test('is the local date, not the UTC date, in a zone behind UTC', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    // 23:30 on the 19th in Los Angeles is already the 20th in UTC.
    const time = { now: new Date(2026, 8, 19, 23, 30) }
    expect(time.now.toISOString().slice(0, 10)).toBe('2026-09-20')
    expect(clockAt(time).today()).toBe('2026-09-19')
  })

  test('changes at local midnight', () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    const time = { now: new Date(2026, 8, 19, 23, 59, 59) }
    const clock = clockAt(time)
    expect(clock.today()).toBe('2026-09-19')
    time.now = new Date(2026, 8, 20, 0, 0, 0)
    expect(clock.today()).toBe('2026-09-20')
  })
})

describe('setToday (dev builds)', () => {
  const real = () => ({ now: new Date(2026, 8, 19, 12, 0) })

  test('replaces today, and null goes back to the real date', () => {
    const clock = clockAt(real())
    clock.setToday('2026-10-01')
    expect(clock.today()).toBe('2026-10-01')
    clock.setToday(null)
    expect(clock.today()).toBe('2026-09-19')
  })

  test('leaves now alone: timestamps stay real', () => {
    const time = real()
    const clock = clockAt(time)
    clock.setToday('2030-01-01')
    expect(clock.now()).toBe(time.now.toISOString())
  })

  test('a value that is not a date goes back to the real date, so a cleared date input works', () => {
    for (const value of ['', '2026-02-30', 'tomorrow', '2026-9-1']) {
      const clock = clockAt(real())
      clock.setToday('2026-10-01')
      clock.setToday(value)
      expect(clock.today()).toBe('2026-09-19')
    }
  })

  test('does not follow the real date while it is set', () => {
    const time = real()
    const clock = clockAt(time)
    clock.setToday('2026-10-01')
    time.now = new Date(2026, 8, 25, 12, 0)
    expect(clock.today()).toBe('2026-10-01')
  })
})

describe('setToday in a production build', () => {
  test('changes nothing', () => {
    vi.stubEnv('DEV', false)
    const clock = clockAt({ now: new Date(2026, 8, 19, 12, 0) })
    clock.setToday('2030-01-01')
    expect(clock.today()).toBe('2026-09-19')
  })

  test('ignores a date that was set while it was a dev build', () => {
    const clock = clockAt({ now: new Date(2026, 8, 19, 12, 0) })
    clock.setToday('2030-01-01')
    expect(clock.today()).toBe('2030-01-01')
    vi.stubEnv('DEV', false)
    expect(clock.today()).toBe('2026-09-19')
  })
})
