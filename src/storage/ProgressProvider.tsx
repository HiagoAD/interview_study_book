import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { createClock } from './clock'
import { downloadTextFile } from './download'
import { exportFileName } from './exchange'
import { openProgressStore } from './store'
import type { ProgressStore } from './store'
import { ActionsContext, SnapshotContext } from './useProgress'
import type { ProgressActions } from './useProgress'

// One store for the page. Effects run twice in development, and this keeps them from opening it twice.
let opening: Promise<ProgressStore> | undefined

function openOnce(): Promise<ProgressStore> {
  return (opening ??= openProgressStore(createClock()))
}

/** Loads the progress, then renders its children with it. Renders nothing until then. */
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

  return store && <Connected store={store}>{children}</Connected>
}

function Connected({ store, children }: { store: ProgressStore; children: ReactNode }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)

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
