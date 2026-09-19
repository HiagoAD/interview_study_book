import { books } from 'virtual:content'
import { NotFoundPage } from './NotFound'

// Placeholder: Phase 5 replaces this with the real section page.
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
  const section = chapter?.sections.find((candidate) => candidate.id === sectionId)
  if (!book || !chapter || !section) return <NotFoundPage />

  return (
    <main>
      <h1>
        {section.title}{' '}
        <small>
          ({book.title} / {chapter.title})
        </small>
      </h1>
      <p>Placeholder: will show the section's content, then its questions.</p>
      {/* The build produced this HTML from files in content/, so it is trusted. */}
      <div dangerouslySetInnerHTML={{ __html: section.html }} />
      <p>
        <a href={`#/b/${book.id}/${chapter.id}`}>Back to chapter</a>
      </p>
    </main>
  )
}
