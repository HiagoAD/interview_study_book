import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { gradeChoice, gradeShort, gradeTrueFalse } from '../engine/grading'
import type { PreparedQuestion } from '../engine/questions'
import type { ShownOption } from '../engine/sampling'
import { Html } from './Html'
import { questionKey } from './questionKeys'
import { reveal } from './reveal'

export interface QuestionCardProps {
  /** Made once by the caller and never changed while the card is shown: see `prepareQuestion`. */
  question: PreparedQuestion
  /** Heads the card and names it, such as "Question 2 of 4". */
  title: string
  /** Extra controls beside the title. */
  aside?: ReactNode
  /** Called once, when the answer is final: on submit, or for a wrong short answer when the reader decides. */
  onAnswer(ok: boolean): void
  /** The reader is done with this question. */
  onNext(): void
  /** The label of the button that moves on after an answer. */
  nextLabel: string
}

type Stage =
  | { name: 'answering' }
  // A short answer that graded wrong: the reader still decides whether it counts.
  | { name: 'judging' }
  | { name: 'answered'; ok: boolean }

interface Mark {
  text: string
  good: boolean
}

/** What to say about an option or button once the question is answered. Wording, not colour, carries it. */
function markFor(correct: boolean, chosen: boolean): Mark | null {
  if (correct) return { text: chosen ? 'Correct' : 'Correct answer', good: true }
  return chosen ? { text: 'Incorrect', good: false } : null
}

function Badge({ mark }: { mark: Mark }) {
  return (
    <span className={`badge ${mark.good ? 'badge-good' : 'badge-bad'}`}>
      <span aria-hidden="true">{mark.good ? '✓' : '✗'}</span> {mark.text}
    </span>
  )
}

/**
 * One question, for study and review alike. It grades the answer, shows the verdict and the explanation, and
 * reports the final answer through `onAnswer`. It keeps no scheduling state and never picks a variant or
 * samples options: it shows `question` as given.
 */
export function QuestionCard({ question, title, aside, onAnswer, onNext, nextLabel }: QuestionCardProps) {
  const { variant, options } = question
  const ids = useId()
  const titleId = `${ids}-title`
  const promptId = `${ids}-prompt`
  const cardRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>({ name: 'answering' })
  const [picked, setPicked] = useState<readonly number[]>([]) // indices into `options`
  const [chosen, setChosen] = useState<boolean | null>(null) // true/false
  const [text, setText] = useState('') // short answer
  const [explained, setExplained] = useState(false)

  const answering = stage.name === 'answering'

  function finish(ok: boolean) {
    setStage({ name: 'answered', ok })
    onAnswer(ok)
  }

  function togglePick(index: number) {
    if (!answering || (variant.type !== 'mc' && variant.type !== 'multi')) return
    setPicked((now) =>
      variant.type === 'mc' ? [index] : now.includes(index) ? now.filter((i) => i !== index) : [...now, index],
    )
  }

  function submitChoice() {
    if (answering && picked.length > 0) finish(gradeChoice(options, picked))
  }

  function answerTrueFalse(value: boolean) {
    if (!answering || variant.type !== 'tf') return
    setChosen(value)
    finish(gradeTrueFalse(variant.answer, value))
  }

  function submitShort() {
    if (!answering || variant.type !== 'short' || text.trim() === '') return
    if (gradeShort(variant.accepted, text)) finish(true)
    else setStage({ name: 'judging' })
  }

  // The reader has seen the expected answer and decides. Either way the answer is final and we move on.
  function judge(ok: boolean) {
    if (stage.name !== 'judging') return
    onAnswer(ok)
    onNext()
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const key = questionKey(event)
    if (!key) return

    if (key.kind === 'option') {
      if (variant.type === 'tf' && key.index < 2) answerTrueFalse(key.index === 0)
      else if ((variant.type === 'mc' || variant.type === 'multi') && key.index < options.length) togglePick(key.index)
      else return
    } else if (stage.name === 'answered') onNext()
    else if (stage.name === 'judging') judge(false)
    else if (variant.type === 'short') submitShort()
    else submitChoice()
    event.preventDefault()
  })

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // On arrival: scroll the card into view, then put focus where the reader continues, so a screen reader
  // announces the new question and the keyboard carries on from here.
  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    reveal(card)
    ;(variant.type === 'short' ? inputRef.current : card)?.focus({ preventScroll: true })
  }, [])

  const showExplanation = stage.name === 'judging' || (stage.name === 'answered' && (!stage.ok || explained))

  let hint: string | null = null
  if (stage.name !== 'answering') hint = 'Enter continues.'
  else if (variant.type === 'tf') hint = 'Keys: 1 for True, 2 for False.'
  else if (variant.type !== 'short') hint = `Keys: 1–${options.length} pick an option, Enter submits.`

  return (
    <article ref={cardRef} className="card" tabIndex={-1} aria-labelledby={titleId}>
      <header className="card-header">
        <h2 id={titleId} className="card-title">
          {title}
        </h2>
        {aside}
      </header>

      <div id={promptId}>
        <Html html={variant.prompt} className="prose prompt" />
      </div>

      {variant.type === 'multi' && <p className="instruction">Select all that apply.</p>}

      {(variant.type === 'mc' || variant.type === 'multi') && (
        <ChoiceOptions
          options={options}
          multi={variant.type === 'multi'}
          picked={picked}
          answered={!answering}
          labelledBy={promptId}
          onToggle={togglePick}
        />
      )}
      {variant.type === 'tf' && (
        <TrueFalseButtons
          answer={variant.answer}
          chosen={chosen}
          answered={!answering}
          labelledBy={promptId}
          onChoose={answerTrueFalse}
        />
      )}
      {variant.type === 'short' && answering && (
        <form
          className="short"
          onSubmit={(event) => {
            event.preventDefault()
            submitShort()
          }}
        >
          <label className="field-label" htmlFor={`${ids}-answer`}>
            Your answer
          </label>
          <ShortInput id={`${ids}-answer`} ref={inputRef} value={text} onChange={setText} describedBy={promptId} />
          <button type="submit" className="button button-primary" disabled={text.trim() === ''}>
            Submit
          </button>
        </form>
      )}

      {/* Always in the page, so that the verdict is announced when it appears. */}
      <div className="feedback" role="status">
        {stage.name === 'answered' && (
          <p className={`verdict ${stage.ok ? 'verdict-good' : 'verdict-bad'}`}>
            <span aria-hidden="true">{stage.ok ? '✓' : '✗'}</span> {stage.ok ? 'Correct' : 'Incorrect'}
          </p>
        )}
        {stage.name === 'judging' && (
          <p className="verdict verdict-bad">
            <span aria-hidden="true">✗</span> Not quite
          </p>
        )}
      </div>

      {variant.type === 'short' && !answering && (
        <dl className="answer-summary">
          <dt>Your answer</dt>
          <dd>{text}</dd>
          {stage.name === 'judging' && (
            <>
              <dt>Expected answer</dt>
              <dd>{variant.accepted[0]}</dd>
            </>
          )}
        </dl>
      )}

      {showExplanation && (
        <div className="explanation">
          <h3 className="explanation-title">Explanation</h3>
          <Html html={variant.explanation} className="prose" />
        </div>
      )}

      <div className="actions">
        {answering && (variant.type === 'mc' || variant.type === 'multi') && (
          <button type="button" className="button button-primary" disabled={picked.length === 0} onClick={submitChoice}>
            Submit
          </button>
        )}
        {stage.name === 'answered' && stage.ok && !explained && (
          <button type="button" className="button" onClick={() => setExplained(true)}>
            Show explanation
          </button>
        )}
        {stage.name === 'answered' && (
          <button type="button" className="button button-primary" onClick={onNext}>
            {nextLabel}
          </button>
        )}
        {stage.name === 'judging' && (
          <>
            <button type="button" className="button" onClick={() => judge(true)}>
              I was right
            </button>
            <button type="button" className="button button-primary" onClick={() => judge(false)}>
              Continue
            </button>
          </>
        )}
      </div>

      {hint && <p className="hint">{hint}</p>}
    </article>
  )
}

function ChoiceOptions({
  options,
  multi,
  picked,
  answered,
  labelledBy,
  onToggle,
}: {
  options: readonly ShownOption[]
  multi: boolean
  picked: readonly number[]
  answered: boolean
  labelledBy: string
  onToggle(index: number): void
}) {
  const name = useId()
  return (
    <div className={`options${answered ? ' options-answered' : ''}`} role={multi ? 'group' : 'radiogroup'} aria-labelledby={labelledBy}>
      {options.map((option, index) => {
        const isPicked = picked.includes(index)
        const mark = answered ? markFor(option.correct, isPicked) : null
        const state = mark ? (mark.good ? ' option-good' : ' option-bad') : isPicked ? ' option-picked' : ''
        return (
          <label key={index} className={`option${state}`}>
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={name}
              checked={isPicked}
              disabled={answered}
              onChange={() => onToggle(index)}
            />
            <span className="key" aria-hidden="true">
              {index + 1}
            </span>
            <span className="option-body">
              <Html as="span" html={option.html} className="option-text" />
              {mark && <Badge mark={mark} />}
            </span>
          </label>
        )
      })}
    </div>
  )
}

function TrueFalseButtons({
  answer,
  chosen,
  answered,
  labelledBy,
  onChoose,
}: {
  answer: boolean
  chosen: boolean | null
  answered: boolean
  labelledBy: string
  onChoose(value: boolean): void
}) {
  return (
    <div className="tf" role="group" aria-labelledby={labelledBy}>
      {[true, false].map((value, index) => {
        const isChosen = chosen === value
        const mark = answered ? markFor(value === answer, isChosen) : null
        const state = mark ? (mark.good ? ' option-good' : ' option-bad') : ''
        return (
          <div key={String(value)} className="tf-choice">
            <button
              type="button"
              className={`option tf-button${state}`}
              disabled={answered}
              aria-pressed={answered ? isChosen : undefined}
              onClick={() => onChoose(value)}
            >
              <span className="key" aria-hidden="true">
                {index + 1}
              </span>
              {value ? 'True' : 'False'}
            </button>
            {mark && <Badge mark={mark} />}
          </div>
        )
      })}
    </div>
  )
}

function ShortInput({
  id,
  ref,
  value,
  onChange,
  describedBy,
}: {
  id: string
  ref: Ref<HTMLInputElement>
  value: string
  onChange(value: string): void
  describedBy: string
}) {
  return (
    <input
      id={id}
      ref={ref}
      className="text-input"
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-describedby={describedBy}
      autoComplete="off"
      autoCapitalize="none"
      spellCheck={false}
      enterKeyHint="go"
    />
  )
}
