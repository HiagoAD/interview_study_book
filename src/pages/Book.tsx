import { books } from 'virtual:content'
import { Breadcrumb } from '../components/Breadcrumb'
import { plural } from '../components/plural'
import { ProgressMeter } from '../components/ProgressMeter'
import { countCompleteSections } from '../engine/sections'
import { useProgress } from '../storage/useProgress'
import { NotFoundPage } from './NotFound'

export function BookPage({ book: bookId }: { book: string }) {
  const progress = useProgress()
  const book = books.find((candidate) => candidate.id === bookId)
  if (!book) return <NotFoundPage />

  const sections = book.chapters.flatMap((chapter) => chapter.sections)

  return (
    <main>
      <Breadcrumb trail={[{ label: 'Home', href: '#/' }]} />
      <h1>{book.title}</h1>
      <ProgressMeter done={countCompleteSections(book.id, sections, progress)} total={sections.length} noun="sections" />

      <ul className="rows">
        {book.chapters.map((chapter) => (
          <li key={chapter.id} className="row">
            <a className="row-title" href={`#/b/${book.id}/${chapter.id}`}>
              {chapter.title}
            </a>
            <ProgressMeter
              done={countCompleteSections(book.id, chapter.sections, progress)}
              total={chapter.sections.length}
              noun="sections"
            />
          </li>
        ))}
      </ul>

      {book.glossary.length > 0 && (
        <nav className="page-links" aria-label="More">
          <a href={`#/g/${book.id}`}>Glossary ({plural(book.glossary.length, 'term')})</a>
        </nav>
      )}
    </main>
  )
}
