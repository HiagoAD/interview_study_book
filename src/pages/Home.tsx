import { books } from 'virtual:content'

// Placeholder: Phase 5 replaces this with the real home page.
export function HomePage() {
  return (
    <main>
      <h1>Home</h1>
      <p>Placeholder: will list books with progress, a review link and a data link.</p>
      <ul>
        {books.map((book) => (
          <li key={book.id}>
            <a href={`#/b/${book.id}`}>{book.title}</a>
          </li>
        ))}
        <li>
          <a href="#/review">Review</a>
        </li>
        <li>
          <a href="#/data">Data</a>
        </li>
      </ul>
    </main>
  )
}
