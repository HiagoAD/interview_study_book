import { useEffect, useId, useRef, useState } from 'react'
import { Html } from '../components/Html'
import { QuestionCard } from '../components/QuestionCard'
import { reveal } from '../components/reveal'
import { prepareQuestions } from '../engine/questions'
import type { PreparedQuestion } from '../engine/questions'
import { isSectionComplete } from '../engine/sections'
import { useProgress, useProgressActions } from '../storage/useProgress'
import type { Book, Chapter } from '../types/content'

interface Run {
  /**
   * Made once, when the run starts, and never again. Answering changes the records, and choosing from the
   * changed records would pick another variant and reshuffle the options under the feedback the reader is
   * reading. A new run makes a new set.
   */
  questions: readonly PreparedQuestion[]
  /** The final answer to each question so far, in order. */
  answers: readonly boolean[]
  /** The question being shown; equal to the number of questions once the run is over. */
  step: number
}

interface Props {
  book: Book
  chapter: Chapter
  index: number
  /** Scrolls back up to the section's content. */
  onReread(): void
}

/** The questions under a section's content: the start button, one question at a time, and the result. */
export function SectionQuestions({ book, chapter, index, onReread }: Props) {
  const section = chapter.sections[index]
  const progress = useProgress()
  const { recordAnswer } = useProgressActions()
  const [run, setRun] = useState<Run | null>(null)

  function start() {
    setRun({
      questions: prepareQuestions(book.id, section.concepts, progress.concepts, Math.random),
      answers: [],
      step: 0,
    })
  }

  if (run === null) {
    return <Intro count={section.concepts.length} complete={isSectionComplete(book.id, section, progress)} onStart={start} />
  }

  if (run.step >= run.questions.length) {
    return (
      <Result
        questions={run.questions}
        answers={run.answers}
        next={chapter.sections[index + 1]}
        nextHref={(id) => `#/b/${book.id}/${chapter.id}/${id}`}
        chapterHref={`#/b/${book.id}/${chapter.id}`}
        onAgain={start}
      />
    )
  }

  const question = run.questions[run.step]
  const last = run.step + 1 === run.questions.length
  return (
    <QuestionCard
      // Each question gets a card of its own. Without the key React would reuse one card for all of them, and
      // the answer, picks and typed text of one question would still be there in the next.
      key={run.step}
      question={question}
      title={`Question ${run.step + 1} of ${run.questions.length}`}
      aside={
        <button type="button" className="link-button" onClick={onReread}>
          Reread content
        </button>
      }
      onAnswer={(ok) => {
        recordAnswer({ bookId: book.id, section, conceptId: question.conceptId, v: question.v, ok, mode: 'study' })
        setRun((now) => now && { ...now, answers: [...now.answers, ok] })
      }}
      onNext={() => setRun((now) => now && { ...now, step: now.step + 1 })}
      nextLabel={last ? 'See results' : 'Next question'}
    />
  )
}

function Intro({ count, complete, onStart }: { count: number; complete: boolean; onStart(): void }) {
  const titleId = useId()
  return (
    <section className="questions" aria-labelledby={titleId}>
      <h2 id={titleId}>Questions</h2>
      <p>
        {complete
          ? 'You have completed this section. Practise it again whenever you like: the options are sampled afresh each time.'
          : `Answer ${count} ${count === 1 ? 'question' : 'questions'}, one for each concept in this section. You can go back to the content at any point.`}
      </p>
      <button type="button" className="button button-primary" onClick={onStart}>
        {complete ? 'Practise again' : 'Start questions'}
      </button>
    </section>
  )
}

function Result({
  questions,
  answers,
  next,
  nextHref,
  chapterHref,
  onAgain,
}: {
  questions: readonly PreparedQuestion[]
  answers: readonly boolean[]
  next: Chapter['sections'][number] | undefined
  nextHref(sectionId: string): string
  chapterHref: string
  onAgain(): void
}) {
  const titleId = useId()
  const ref = useRef<HTMLElement>(null)
  const correct = answers.filter(Boolean).length
  const toReview = questions.filter((_, i) => !answers[i])

  useEffect(() => {
    const result = ref.current
    if (!result) return
    reveal(result)
    result.focus({ preventScroll: true })
  }, [])

  return (
    <section ref={ref} className="card result" tabIndex={-1} aria-labelledby={titleId}>
      <h2 id={titleId} className="card-title">
        Result
      </h2>
      <p className="score">
        <strong>
          {correct}/{questions.length}
        </strong>{' '}
        correct
      </p>

      {toReview.length > 0 ? (
        <>
          <h3 className="result-heading">Sent to review</h3>
          <ul className="review-list">
            {toReview.map((question) => (
              <li key={question.conceptId}>
                <Html html={question.variant.prompt} className="prose" />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Nothing was sent to review.</p>
      )}

      <div className="actions">
        {next && (
          <a className="button button-primary" href={nextHref(next.id)}>
            Next section: {next.title}
          </a>
        )}
        <a className="button" href={chapterHref}>
          Back to chapter
        </a>
        <button type="button" className="button" onClick={onAgain}>
          Practise again
        </button>
      </div>
    </section>
  )
}
