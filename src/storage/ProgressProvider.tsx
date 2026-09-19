import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { createClock } from './clock'
import { downloadTextFile } from './download'
import { exportFileName } from './exchange'
import { openProgressStore } from './store'
import type { ProgressStore } from './store'
import { ActionsContext, SnapshotContext } from './useProgress'
import type { ProgressActions } from './useProgress'
import { onBecameVisible } from './visibility'

// One store for the page. Effects run twice in development, and this keeps them from opening it twice.
let opening: Promise<ProgressStore> | undefined

function openOnce(): Promise<ProgressStore> {
  return (opening ??= openProgressStore(createClock()))
}

/**
 * Loads the progress, then renders its children with it. Until then it shows a loading note; the wait is at
 * most a few seconds, because opening the database is given up on after that and progress is kept in memory.
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<ProgressStore | null>(null)

  useEffect(() => {
    let mounted = true
    void openOnce().then((opened) => {
      if (mounted) setStore(opened)
    })
    return () => {
      mounted = false
    }
  }, [])

  if (!store) {
    return (
      <main>
        <p className="loading" role="status">
          Loading your progress…
        </p>
      </main>
    )
  }
  return <Connected store={store}>{children}</Connected>
}

function Connected({ store, children }: { store: ProgressStore; children: ReactNode }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)

  // A tab left open overnight still holds yesterday's date. Reading it again when the tab comes back keeps
  // the due count right.
  useEffect(() => onBecameVisible(document, store.refreshToday), [store])

  const actions = useMemo<ProgressActions>(
    () => ({
      recordAnswer: store.recordAnswer,
      markRead: store.markRead,
      exportProgress: () =>
        downloadTextFile(exportFileName(store.getSnapshot().today), JSON.stringify(store.exportData(), null, 2)),
      importProgress: store.importProgress,
      resetBook: store.resetBook,
      setToday: store.setToday,
    }),
    [store],
  )

  return (
    <ActionsContext value={actions}>
      <SnapshotContext value={snapshot}>{children}</SnapshotContext>
    </ActionsContext>
  )
}
