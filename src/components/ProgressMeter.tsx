/** "3 of 5 sections complete", with a bar. The text is what carries the number; the bar is a glance. */
export function ProgressMeter({ done, total, noun }: { done: number; total: number; noun: string }) {
  return (
    <div className="meter">
      <progress max={total} value={done} aria-hidden="true" />
      <span className="muted">
        {done} of {total} {noun} complete
      </span>
    </div>
  )
}
