/** The parts of `document` that `onBecameVisible` uses. */
export type VisibilitySource = Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>

/**
 * Calls `callback` each time the page becomes visible again, such as when its tab is brought to the front.
 * Hiding the page does not call it. Returns the function that stops listening.
 */
export function onBecameVisible(source: VisibilitySource, callback: () => void): () => void {
  const listener = () => {
    if (source.visibilityState === 'visible') callback()
  }
  source.addEventListener('visibilitychange', listener)
  return () => source.removeEventListener('visibilitychange', listener)
}
