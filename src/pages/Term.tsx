import { books } from 'virtual:content'
import type { Book, GlossaryEntry } from '../types/content'
import { Breadcrumb } from '../components/Breadcrumb'
import { appearances } from '../components/glossary'
import { Html } from '../components/Html'
import { useProgress } from '../storage/useProgress'
import { NotFoundPage } from './NotFound'

export function TermPage({ book: bookId, term: termId }: { book: string; term: string }) {
  const book = books.find((candidate) => candidate.id === bookId)
  const entry = book?.glossary.find((candidate) => candidate.id === termId)
  if (!book || !entry) return <NotFoundPage />

  return <TermView book={book} entry={entry} />
}

function TermView({ book, entry }: { book: Book; entry: GlossaryEntry }) {
  const related = entry.see.map((id) => book.glossary.find((candidate) => candidate.id === id)).filter((found) => found !== undefined)

  return (
    <main>
      <Breadcrumb
        trail={[
          { label: 'Home', href: '#/' },
          { label: book.title, href: `#/b/${book.id}` },
          { label: 'Glossary', href: `#/g/${book.id}` },
        ]}
      />
      <h1>{entry.term}</h1>
      {entry.names.length > 0 && <p className="muted">Also called {entry.names.join(', ')}</p>}

      <Html html={entry.summary} className="prose lead" />
      {entry.html !== '' && <Html html={entry.html} className="prose" />}

      {related.length > 0 && (
        <>
          <h2>See also</h2>
          <ul className="inline-links">
            {related.map((other) => (
              <li key={other.id}>
                <a href={`#/g/${book.id}/${other.id}`}>{other.term}</a>
              </li>
            ))}
          </ul>
        </>
      )}

      <Appearances book={book} entry={entry} />
    </main>
  )
}

/** The sections that link to this term. A locked one is named but not linked, as on the chapter page. */
function Appearances({ book, entry }: { book: Book; entry: GlossaryEntry }) {
  const places = appearances(book, entry, useProgress())
  if (places.length === 0) return null

  return (
    <>
      <h2>Where this appears</h2>
      <ul className="rows">
        {places.map((place) => (
          <li key={`${place.chapter.id}/${place.section.id}`} className="row">
            {place.unlocked ? (
              <a className="row-title" href={`#/b/${book.id}/${place.chapter.id}/${place.section.id}`}>
                {place.section.title}
              </a>
            ) : (
              <span className="row-title row-title-locked">{place.section.title}</span>
            )}
            <p className="muted row-note">
              {place.chapter.title}
              {!place.unlocked && place.previous && <>. Answer the questions in “{place.previous.title}” to unlock it.</>}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
