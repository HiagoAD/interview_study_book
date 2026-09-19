import { useEffect, useRef } from 'react'
import { books } from 'virtual:content'
import type { Book, Chapter } from '../types/content'
import { Breadcrumb } from '../components/Breadcrumb'
import { Html } from '../components/Html'
import { isSectionUnlocked } from '../engine/sections'
import { useProgress, useProgressActions } from '../storage/useProgress'
import { NotFoundPage } from './NotFound'
import { SectionQuestions } from './SectionQuestions'

export function SectionPage({
  book: bookId,
  chapter: chapterId,
  section: sectionId,
}: {
  book: string
  chapter: string
  section: string
}) {
  const book = books.find((candidate) => candidate.id === bookId)
  const chapter = book?.chapters.find((candidate) => candidate.id === chapterId)
  const index = chapter?.sections.findIndex((candidate) => candidate.id === sectionId) ?? -1
  if (!book || !chapter || index === -1) return <NotFoundPage />

  // The same component shows every section, so a key is what gives each one fresh state: without it, the
  // questions of one section would still be on screen after "Next section".
  return <SectionView key={`${book.id}/${chapter.id}/${sectionId}`} book={book} chapter={chapter} index={index} />
}

function SectionView({ book, chapter, index }: { book: Book; chapter: Chapter; index: number }) {
  const section = chapter.sections[index]
  const progress = useProgress()
  const { markRead } = useProgressActions()
  const contentRef = useRef<HTMLElement>(null)
  const unlocked = isSectionUnlocked(book.id, chapter, index, progress)

  useEffect(() => {
    if (unlocked) markRead(book.id, chapter, section.id)
  }, [unlocked, markRead, book.id, chapter, section.id])

  // Like following a link to the content: scroll there and move focus with it. Left on the button, focus would
  // make the next Enter press "Reread content" again instead of continuing.
  function reread() {
    contentRef.current?.scrollIntoView({ block: 'start' })
    contentRef.current?.focus({ preventScroll: true })
  }

  const chapterHref = `#/b/${book.id}/${chapter.id}`
  const trail = [
    { label: 'Home', href: '#/' },
    { label: book.title, href: `#/b/${book.id}` },
    { label: chapter.title, href: chapterHref },
  ]

  if (!unlocked) {
    const previous = chapter.sections[index - 1]
    return (
      <main>
        <Breadcrumb trail={trail} />
        <h1>{section.title}</h1>
        <div className="notice" role="note">
          <p>
            <strong>This section is locked.</strong> Answer the questions in{' '}
            <a href={`${chapterHref}/${previous.id}`}>{previous.title}</a> to unlock it.
          </p>
        </div>
        <p>
          <a href={chapterHref}>Back to chapter</a>
        </p>
      </main>
    )
  }

  return (
    <main>
      <Breadcrumb trail={trail} />
      <h1>{section.title}</h1>
      <section ref={contentRef} className="content" tabIndex={-1} aria-label="Content">
        <Html html={section.html} className="prose" />
      </section>
      <SectionQuestions
        book={book}
        chapter={chapter}
        index={index}
        onReread={reread}
      />
    </main>
  )
}
