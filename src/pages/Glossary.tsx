import { useId, useState } from 'react'
import { books } from 'virtual:content'
import type { Book } from '../types/content'
import { Breadcrumb } from '../components/Breadcrumb'
import { matchesTerm } from '../components/glossary'
import { Html } from '../components/Html'
import { plural } from '../components/plural'
import { NotFoundPage } from './NotFound'

export function GlossaryPage({ book: bookId }: { book: string }) {
  const book = books.find((candidate) => candidate.id === bookId)
  if (!book) return <NotFoundPage />

  return <GlossaryView key={book.id} book={book} />
}

function GlossaryView({ book }: { book: Book }) {
  const [query, setQuery] = useState('')
  const filterId = useId()
  const shown = book.glossary.filter((entry) => matchesTerm(entry, query))

  const trail = [
    { label: 'Home', href: '#/' },
    { label: book.title, href: `#/b/${book.id}` },
  ]

  if (book.glossary.length === 0) {
    return (
      <main>
        <Breadcrumb trail={trail} />
        <h1>Glossary</h1>
        <div className="notice" role="note">
          <p>
            This book has no glossary yet. Add a file under <code>content/</code> whose front matter says{' '}
            <code>kind: glossary</code>; docs/content-format.md describes the format.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main>
      <Breadcrumb trail={trail} />
      <h1>Glossary</h1>
      <p className="muted">
        {plural(book.glossary.length, 'term')} the book uses without stopping to define. Nothing here is tested or
        scheduled for review.
      </p>

      <div className="field">
        <label htmlFor={filterId}>Find a term</label>
        <input
          id={filterId}
          className="text-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          placeholder="Part of a term"
        />
      </div>

      <p className="sr-only" role="status">
        {plural(shown.length, 'term')} shown
      </p>

      {shown.length === 0 ? (
        <div className="notice" role="note">
          <p>No term matches that. Try part of a word, such as “pool”.</p>
        </div>
      ) : (
        <ul className="rows">
          {shown.map((entry) => (
            <li key={entry.id} className="row">
              <a className="row-title" href={`#/g/${book.id}/${entry.id}`}>
                {entry.term}
              </a>
              {entry.names.length > 0 && <p className="muted row-note">Also called {entry.names.join(', ')}</p>}
              <Html html={entry.summary} className="prose term-summary" />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
