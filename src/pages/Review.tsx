import { useEffect, useId, useRef, useState } from 'react'
import { books } from 'virtual:content'
import { Breadcrumb } from '../components/Breadcrumb'
import { Html } from '../components/Html'
import { QuestionCard } from '../components/QuestionCard'
import { plural } from '../components/plural'
import { reveal } from '../components/reveal'
import { dueConcepts } from '../engine/due'
import { prepareReview } from '../engine/questions'
import type { ReviewItem } from '../engine/questions'
import { conceptKey } from '../engine/records'
import { useProgress, useProgressActions } from '../storage/useProgress'

interface Run {
  /**
   * Made once, when the review starts, and never again. Answering takes a concept out of the due list, so
   * walking the live list would shift it under the reader and skip questions; this is a copy of that moment.
   */
  items: readonly ReviewItem[]
  /** The final answer to each question so far, in order. */
  answers: readonly boolean[]
  /** The question being shown; equal to the number of items once the review is over. */
  step: number
}

export function ReviewPage() {
  const progress = useProgress()
  const { recordAnswer } = useProgressActions()
  const [run, setRun] = useState<Run | null>(null)

  function start() {
    setRun({ items: prepareReview(books, progress, progress.today, Math.random), answers: [], step: 0 })
  }

  let body
  if (run === null) {
    // Not started, so this is the live list: it follows the date, and it is what Home counts.
    const due = dueConcepts(books, progress, progress.today).length
    body = due === 0 ? <Empty /> : <Intro due={due} onStart={start} />
  } else if (run.step >= run.items.length) {
    body = <Summary items={run.items} answers={run.answers} />
  } else {
    const item = run.items[run.step]
    const chapterHref = `#/b/${item.book.id}/${item.chapter.id}`
    body = (
      <QuestionCard
        // One card per question: without the key React would reuse a card, and with it the answer and the typed
        // text of one question.
        key={run.step}
        question={item.question}
        title={`Question ${run.step + 1} of ${run.items.length}`}
        aside={
          <Breadcrumb
            label="Where this question is from"
            trail={[
              { label: item.book.title, href: `#/b/${item.book.id}` },
              { label: item.chapter.title, href: chapterHref },
              { label: item.section.title, href: `${chapterHref}/${item.section.id}` },
            ]}
          />
        }
        onAnswer={(ok) => {
          recordAnswer({
            bookId: item.book.id,
            section: item.section,
            conceptId: item.question.conceptId,
            v: item.question.v,
            ok,
            mode: 'review',
          })
          setRun((now) => now && { ...now, answers: [...now.answers, ok] })
        }}
        onNext={() => setRun((now) => now && { ...now, step: now.step + 1 })}
        nextLabel={run.step + 1 === run.items.length ? 'See summary' : 'Next question'}
      />
    )
  }

  return (
    <main>
      <Breadcrumb trail={[{ label: 'Home', href: '#/' }]} />
      <h1>Review</h1>
      {body}
    </main>
  )
}

function Empty() {
  return (
    <>
      <div className="notice" role="note">
        <p>
          <strong>Nothing is due.</strong> A concept you answer wrong is added here and comes back the next day.
        </p>
      </div>
      <p>
        <a href="#/">Back to the books</a>
      </p>
    </>
  )
}

function Intro({ due, onStart }: { due: number; onStart(): void }) {
  return (
    <>
      <p>
        {plural(due, 'concept')} {due === 1 ? 'is' : 'are'} due. You will get one question for each, one at a time.
      </p>
      <button type="button" className="button button-primary" onClick={onStart}>
        Start review
      </button>
    </>
  )
}

function Summary({ items, answers }: { items: readonly ReviewItem[]; answers: readonly boolean[] }) {
  const titleId = useId()
  const ref = useRef<HTMLElement>(null)
  const { concepts } = useProgress()
  const correct = answers.filter(Boolean).length

  useEffect(() => {
    const summary = ref.current
    if (!summary) return
    reveal(summary)
    summary.focus({ preventScroll: true })
  }, [])

  return (
    <section ref={ref} className="card result" tabIndex={-1} aria-labelledby={titleId}>
      <h2 id={titleId} className="card-title">
        Summary
      </h2>
      <p className="score">
        <strong>
          {correct}/{items.length}
        </strong>{' '}
        correct
      </p>

      <ul className="review-list">
        {items.map((item, i) => {
          // What became of the concept is read from its record, which the answer has already updated.
          const record = concepts.get(conceptKey(item.book.id, item.question.conceptId))
          return (
            <li key={`${item.book.id}/${item.question.conceptId}`}>
              <Html html={item.question.variant.prompt} className="prose" />
              <p className={`outcome ${answers[i] ? 'outcome-good' : 'outcome-bad'}`}>
                <span aria-hidden="true">{answers[i] ? '✓' : '✗'}</span> {answers[i] ? 'Correct' : 'Incorrect'}
                <span className="muted">
                  {' · '}
                  {record?.box != null ? `now in box ${record.box}, due ${record.due}` : 'no longer in review'}
                </span>
              </p>
            </li>
          )
        })}
      </ul>

      <div className="actions">
        <a className="button button-primary" href="#/">
          Back to the books
        </a>
      </div>
    </section>
  )
}
