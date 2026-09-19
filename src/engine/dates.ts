// Local calendar dates as YYYY-MM-DD strings. Day arithmetic is plain calendar math on the year, month and
// day, so a time zone or a daylight-saving change can't move a date. Because the fields are zero-padded and
// fixed-width, strings compare in date order.

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

function format(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  return month === 2 ? (isLeapYear(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** The year, month and day of a valid date string, or null. */
function parts(value: string): [number, number, number] | null {
  const match = DATE.exec(value)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  return [year, month, day]
}

export function isLocalDate(value: unknown): value is string {
  return typeof value === 'string' && parts(value) !== null
}

/**
 * The local calendar date of `date`, from its local year, month and day. `toISOString` would give the UTC
 * date instead, which is a different day for part of every day in most time zones.
 */
export function toLocalDate(date: Date): string {
  return format(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

// Days since 1970-01-01 and back, for the proleptic Gregorian calendar (Howard Hinnant's civil-date
// algorithms). Years run from March, so the leap day is the last day of the year.
function toDayNumber(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor(y / 400)
  const yearOfEra = y - era * 400
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra - 719468
}

function fromDayNumber(dayNumber: number): string {
  const z = dayNumber + 719468
  const era = Math.floor(z / 146097)
  const dayOfEra = z - era * 146097
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365,
  )
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
  const shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153)
  const day = dayOfYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1
  const month = shiftedMonth < 10 ? shiftedMonth + 3 : shiftedMonth - 9
  return format(yearOfEra + era * 400 + (month <= 2 ? 1 : 0), month, day)
}

/** `date` moved by a whole number of days, which may be negative. */
export function addDays(date: string, days: number): string {
  const p = parts(date)
  if (!p) throw new RangeError(`not a local date (YYYY-MM-DD): ${date}`)
  if (!Number.isInteger(days)) throw new RangeError(`days must be a whole number: ${days}`)
  return fromDayNumber(toDayNumber(...p) + days)
}

/** Negative when `a` is before `b`, positive when it is after, 0 when they are the same day. */
export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
