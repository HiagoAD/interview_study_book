import { createContext, useContext } from 'react'
import type { ChapterRef } from '../engine/sections'
import type { ImportOutcome, ProgressSnapshot, RecordAnswerInput } from './store'

/** The changes the app can make to progress. The object never changes, so using it doesn't re-render. */
export interface ProgressActions {
  recordAnswer(input: RecordAnswerInput): void
  markRead(bookId: string, chapter: ChapterRef, sectionId: string): void
  /** Downloads the progress as `study-progress-YYYY-MM-DD.json`. */
  exportProgress(): void
  importProgress(text: string): Promise<ImportOutcome>
  resetBook(bookId: string): Promise<void>
  /** Dev builds only: the "Simulate today" date. Null goes back to the real date. */
  setToday(date: string | null): void
}

export const SnapshotContext = createContext<ProgressSnapshot | null>(null)
export const ActionsContext = createContext<ProgressActions | null>(null)

function required<T>(value: T | null): T {
  if (value === null) throw new Error('Progress is only available inside <ProgressProvider>.')
  return value
}

/** The records in memory, today's date and whether progress is being saved. */
export function useProgress(): ProgressSnapshot {
  return required(useContext(SnapshotContext))
}

export function useProgressActions(): ProgressActions {
  return required(useContext(ActionsContext))
}
