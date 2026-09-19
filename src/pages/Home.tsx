import { books } from 'virtual:content'
import { ProgressMeter } from '../components/ProgressMeter'
import { dueConcepts } from '../engine/due'
import { countCompleteSections } from '../engine/sections'
import { useProgress } from '../storage/useProgress'

export function HomePage() {
  const progress = useProgress()
  const due = dueConcepts(books, progress, progress.today).length

  return (
    <main>
      <h1>Books</h1>

      {books.length === 0 ? (
        <p className="notice">
          There are no books yet. Add Markdown files under <code>content/</code>; docs/content-format.md describes the
          format.
        </p>
      ) : (
        <ul className="rows">
          {books.map((book) => {
            const sections = book.chapters.flatMap((chapter) => chapter.sections)
            return (
              <li key={book.id} className="row">
                <a className="row-title" href={`#/b/${book.id}`}>
                  {book.title}
                </a>
                <ProgressMeter done={countCompleteSections(book.id, sections, progress)} total={sections.length} noun="sections" />
              </li>
            )
          })}
        </ul>
      )}

      <nav className="page-links" aria-label="More">
        <a href="#/review" className={due > 0 ? 'has-due' : undefined}>
          Review ({due} due)
        </a>
        <a href="#/data">Data</a>
      </nav>
    </main>
  )
}
