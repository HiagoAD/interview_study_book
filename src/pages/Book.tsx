import { books } from 'virtual:content'
import { NotFoundPage } from './NotFound'

// Placeholder: Phase 5 replaces this with the real book page.
export function BookPage({ book: bookId }: { book: string }) {
  const book = books.find((candidate) => candidate.id === bookId)
  if (!book) return <NotFoundPage />

  return (
    <main>
      <h1>{book.title}</h1>
      <p>Placeholder: will list this book's chapters with progress.</p>
      <ul>
        {book.chapters.map((chapter) => (
          <li key={chapter.id}>
            <a href={`#/b/${book.id}/${chapter.id}`}>{chapter.title}</a>
          </li>
        ))}
      </ul>
      <p>
        <a href="#/">Home</a>
      </p>
    </main>
  )
}
