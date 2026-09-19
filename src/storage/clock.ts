import { isLocalDate, toLocalDate } from '../engine/dates'

export interface Clock {
  /** The current instant as an ISO timestamp in UTC. */
  now(): string
  /** Today's local calendar date, or the date chosen with `setToday` in a dev build. */
  today(): string
  /** Dev builds only: pretend it is this date, or stop pretending with null. Does nothing in production. */
  setToday(date: string | null): void
}

/** The clock the app runs on. `read` gives the current time; tests pass their own. */
export function createClock(read: () => Date = () => new Date()): Clock {
  // Only ever set in a dev build. `import.meta.env.DEV` is false in production builds, so the bundler can
  // remove every use of it.
  let simulated: string | null = null

  return {
    now: () => read().toISOString(),
    today: () => (import.meta.env.DEV && simulated !== null ? simulated : toLocalDate(read())),
    setToday(date) {
      if (import.meta.env.DEV) simulated = isLocalDate(date) ? date : null
    },
  }
}
