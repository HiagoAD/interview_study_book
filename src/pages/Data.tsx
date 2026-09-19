import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react'
import { books } from 'virtual:content'
import { Breadcrumb } from '../components/Breadcrumb'
import { plural } from '../components/plural'
import { reveal } from '../components/reveal'
import { readProgressExport } from '../storage/exchange'
import type { ProgressExport } from '../storage/exchange'
import { useProgress, useProgressActions } from '../storage/useProgress'

export function DataPage() {
  return (
    <main>
      <Breadcrumb trail={[{ label: 'Home', href: '#/' }]} />
      <h1>Data</h1>
      <p>
        Your progress is kept in this browser, on this computer, and nowhere else. The browser ties it to where the page
        is opened from, so a moved or renamed <code>index.html</code>, or another browser, starts empty. Export a backup
        before you move, and import it afterwards.
      </p>

      <ExportSection />
      <ImportSection />
      <ResetSection />
      {import.meta.env.DEV && <SimulateToday />}
    </main>
  )
}

interface Message {
  /** Changes with every message, so that the same text twice is announced twice. */
  id: number
  kind: 'good' | 'bad'
  text: string
}

let nextMessageId = 0

function message(kind: Message['kind'], text: string): Message {
  return { id: nextMessageId++, kind, text }
}

/** What happened, said once and given focus, so that a screen reader reads it and the keyboard carries on here. */
function Notice({ message: { kind, text } }: { message: Message }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return (
    <p ref={ref} className={`message message-${kind}`} role={kind === 'bad' ? 'alert' : 'status'} tabIndex={-1}>
      <span aria-hidden="true">{kind === 'good' ? '✓' : '✗'}</span> {text}
    </p>
  )
}

/** A question to answer before something is deleted or replaced. It takes focus when it appears; Esc cancels. */
function Confirm({
  title,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
  children,
}: {
  title: string
  confirmLabel: string
  busy: boolean
  onConfirm(): void
  onCancel(): void
  children: ReactNode
}) {
  const titleId = useId()
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const panel = ref.current
    if (!panel) return
    reveal(panel)
    panel.focus({ preventScroll: true })
  }, [])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !busy) onCancel()
  }

  return (
    <section ref={ref} className="confirm" tabIndex={-1} aria-labelledby={titleId} onKeyDown={onKeyDown}>
      <h3 id={titleId} className="confirm-title">
        {title}
      </h3>
      {children}
      <div className="actions">
        <button type="button" className="button button-danger" disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}

function ExportSection() {
  const { exportProgress } = useProgressActions()
  const titleId = useId()
  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId}>Export</h2>
      <p>
        Saves all your progress to a file, <code>study-progress-YYYY-MM-DD.json</code>, in your downloads.
      </p>
      <button type="button" className="button button-primary" onClick={exportProgress}>
        Export progress
      </button>
    </section>
  )
}

interface Pending {
  fileName: string
  text: string
  data: ProgressExport
}

function ImportSection() {
  const progress = useProgress()
  const { importProgress } = useProgressActions()
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [notice, setNotice] = useState<Message | null>(null)
  const [busy, setBusy] = useState(false)

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    // Cleared so that choosing the same file again is a change.
    input.value = ''
    setPending(null)
    setNotice(null)
    if (!file) return

    let text: string
    try {
      text = await file.text()
    } catch {
      setNotice(message('bad', `Could not read ${file.name}. Nothing was changed.`))
      return
    }

    // Check the file before asking anything, so the question is about a file that can be imported.
    const result = readProgressExport(text)
    if (!result.ok) {
      setNotice(message('bad', `${file.name} is not a progress backup this site can read: ${result.error}. Nothing was changed.`))
      return
    }
    setPending({ fileName: file.name, text, data: result.data })
  }

  async function replace() {
    if (!pending || busy) return
    setBusy(true)
    try {
      const outcome = await importProgress(pending.text)
      setNotice(
        outcome.ok
          ? message('good', `Restored progress on ${plural(outcome.concepts, 'concept')} and ${plural(outcome.sections, 'section')}.`)
          : message('bad', `${outcome.error}. Nothing was changed.`),
      )
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  function cancel() {
    setPending(null)
    buttonRef.current?.focus()
  }

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId}>Import</h2>
      <p>
        Replaces all the progress in this browser with the contents of a backup file. Nothing changes until you
        confirm.
      </p>
      {/* A button drives the hidden input, because the native control's text follows the browser's language. */}
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => void choose(event)}
      />
      <button ref={buttonRef} type="button" className="button" onClick={() => inputRef.current?.click()}>
        Choose backup file…
      </button>

      {pending && (
        <Confirm
          title="Replace your progress with this backup?"
          confirmLabel="Replace progress"
          busy={busy}
          onConfirm={() => void replace()}
          onCancel={cancel}
        >
          <p>
            <strong>{pending.fileName}</strong> was exported on{' '}
            {new Date(pending.data.exportedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}{' '}
            and holds progress on {plural(pending.data.concepts.length, 'concept')} and{' '}
            {plural(pending.data.sections.length, 'section')}.
          </p>
          <p>
            It replaces the {plural(progress.concepts.size, 'concept')} and {plural(progress.sections.size, 'section')}{' '}
            held now. Export first if you may want them back.
          </p>
        </Confirm>
      )}
      {notice && <Notice key={notice.id} message={notice} />}
    </section>
  )
}

function ResetSection() {
  const progress = useProgress()
  const { resetBook } = useProgressActions()
  const titleId = useId()
  const triggers = useRef(new Map<string, HTMLButtonElement>())
  const [confirming, setConfirming] = useState<string | null>(null)
  const [notice, setNotice] = useState<Message | null>(null)
  const [busy, setBusy] = useState(false)

  async function reset(bookId: string, title: string) {
    if (busy) return
    setBusy(true)
    try {
      await resetBook(bookId)
      setNotice(message('good', `Progress on “${title}” was reset.`))
      setConfirming(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId}>Reset a book</h2>
      <p>
        Deletes all your progress on one book: answers, review schedule and unlocked sections. The other books are
        untouched.
      </p>

      {books.length === 0 ? (
        <p className="muted">There are no books.</p>
      ) : (
        <ul className="rows">
          {books.map((book) => {
            const concepts = [...progress.concepts.values()].filter((record) => record.bookId === book.id).length
            const sections = [...progress.sections.values()].filter((record) => record.bookId === book.id).length
            const empty = concepts === 0 && sections === 0
            return (
              <li key={book.id} className="row">
                <div className="row-head row-head-centered">
                  <span className="row-title">{book.title}</span>
                  <button
                    type="button"
                    className="button button-danger"
                    disabled={empty}
                    ref={(button) => {
                      if (button) triggers.current.set(book.id, button)
                      else triggers.current.delete(book.id)
                    }}
                    onClick={() => {
                      setNotice(null)
                      setConfirming(book.id)
                    }}
                  >
                    Reset progress
                  </button>
                </div>
                <p className="muted row-note">
                  {empty ? 'No progress yet.' : `Progress on ${plural(concepts, 'concept')} and ${plural(sections, 'section')}.`}
                </p>
                {confirming === book.id && (
                  <Confirm
                    title={`Reset “${book.title}”?`}
                    confirmLabel="Delete progress"
                    busy={busy}
                    onConfirm={() => void reset(book.id, book.title)}
                    onCancel={() => {
                      setConfirming(null)
                      triggers.current.get(book.id)?.focus()
                    }}
                  >
                    <p>
                      This deletes progress on {plural(concepts, 'concept')} and {plural(sections, 'section')}, and
                      can't be undone. Export first if you may want it back.
                    </p>
                  </Confirm>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {notice && <Notice key={notice.id} message={notice} />}
    </section>
  )
}

/**
 * Dev builds only: lets review scheduling be tried without waiting for days to pass. `data-dev-only` is what
 * scripts/verify-dist.mjs looks for, to fail the build if this section ever reaches the production bundle.
 */
function SimulateToday() {
  const { today } = useProgress()
  const { setToday } = useProgressActions()
  const titleId = useId()
  const inputId = useId()
  return (
    <section aria-labelledby={titleId} data-dev-only="">
      <h2 id={titleId}>Developer tools</h2>
      <p>Only under <code>npm run dev</code>: the built site has no such section.</p>
      <div className="field">
        <label className="field-label" htmlFor={inputId}>
          Simulate today
        </label>
        <input
          id={inputId}
          className="text-input"
          type="date"
          value={today}
          onChange={(event) => setToday(event.target.value)}
        />
      </div>
      <div className="actions">
        <button type="button" className="button" onClick={() => setToday(null)}>
          Use the real date
        </button>
      </div>
      <p className="muted">Every due date and the due count use this date. Timestamps in the history stay real.</p>
    </section>
  )
}
