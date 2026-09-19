import { useProgress } from '../storage/useProgress'

/**
 * Shown on every page while progress isn't being saved: the browser wouldn't open its storage, or a write to it
 * failed. The site keeps working from memory, so the reader can go on, but only an export keeps the progress.
 */
export function StorageBanner() {
  const { persistent } = useProgress()
  if (persistent) return null

  return (
    <div className="banner" role="alert">
      <p>
        <strong>Progress is not being saved.</strong> This browser is not letting the page store data, so what you do
        here is lost when you close or reload the page. <a href="#/data">Export your progress</a> to keep a copy.
      </p>
    </div>
  )
}
