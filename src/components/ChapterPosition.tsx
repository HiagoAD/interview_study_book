import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { isSectionUnlocked } from '../engine/sections'
import { useProgress } from '../storage/useProgress'
import type { Book, Chapter } from '../types/content'
import { readingDepth } from './readingDepth'

/**
 * The bar pinned to the top of a section page: which section of the chapter this is, and how far through its
 * content the reader has scrolled. The track has one segment per section. Those before this one are full, this
 * one fills as the content is read, and each open section's segment links to it.
 */
export function ChapterPosition({
  book,
  chapter,
  index,
  content,
}: {
  book: Book
  chapter: Chapter
  index: number
  /** The section's content; left out on a locked section, which has none to read. */
  content?: RefObject<HTMLElement | null>
}) {
  const progress = useProgress()
  const bar = useRef<HTMLElement>(null)
  const percent = useReadPercent(content, bar)
  const total = chapter.sections.length

  return (
    <nav ref={bar} className="position" aria-label="Position in chapter">
      <p className="position-text">
        <span className="position-where">
          Section {index + 1} of {total}
          <span className="muted"> · {chapter.title}</span>
        </span>
        {content && <span className="muted">{percent}% read</span>}
      </p>
      <ol className="position-track">
        {chapter.sections.map((section, i) => {
          const fill = i < index ? 1 : i === index ? percent / 100 : 0
          const open = isSectionUnlocked(book.id, chapter, i, progress)
          const label = `Section ${i + 1}: ${section.title}`
          const text = <span className="sr-only">{i === index ? `${label} (this section)` : open ? label : `${label} (locked)`}</span>
          return (
            <li key={section.id} style={{ '--fill': fill } as CSSProperties} aria-current={i === index ? 'step' : undefined}>
              {open && i !== index ? (
                <a className="position-segment" href={`#/b/${book.id}/${chapter.id}/${section.id}`} title={label}>
                  {text}
                </a>
              ) : (
                <span className={open ? 'position-segment' : 'position-segment position-locked'} title={label}>
                  {text}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * How much of `content` has been read, as a whole percentage, measured again on every scroll and resize and
 * whenever the content changes size (an image loading, say). Rounding keeps a scroll from re-rendering the bar
 * for every pixel.
 */
function useReadPercent(content: RefObject<HTMLElement | null> | undefined, bar: RefObject<HTMLElement | null>): number {
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    const element = content?.current
    if (!element) return
    let frame = 0

    function measure() {
      frame = 0
      if (!element) return
      const { top, bottom } = element.getBoundingClientRect()
      // Reading starts below the bar once it is pinned; before that its bottom is above the content anyway.
      const start = Math.max(0, bar.current?.getBoundingClientRect().bottom ?? 0)
      setPercent(Math.round(readingDepth(top, bottom, window.innerHeight, start) * 100))
    }
    function schedule() {
      if (frame === 0) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer.disconnect()
    }
  }, [content, bar])

  return percent
}
