import { books } from 'virtual:content'
import { NotFoundPage } from './NotFound'

// Placeholder: Phase 5 replaces this with the real chapter page.
export function ChapterPage({ book: bookId, chapter: chapterId }: { book: string; chapter: string }) {
  const book = books.find((candidate) => candidate.id === bookId)
  const chapter = book?.chapters.find((candidate) => candidate.id === chapterId)
  if (!book || !chapter) return <NotFoundPage />

  return (
    <main>
      <h1>
        {chapter.title} <small>({book.title})</small>
      </h1>
      <p>Placeholder: will list this chapter's sections, locked/open/complete.</p>
      <ul>
        {chapter.sections.map((section) => (
          <li key={section.id}>
            <a href={`#/b/${book.id}/${chapter.id}/${section.id}`}>{section.title}</a>
          </li>
        ))}
      </ul>
      <p>
        <a href={`#/b/${book.id}`}>Back to book</a>
      </p>
    </main>
  )
}
