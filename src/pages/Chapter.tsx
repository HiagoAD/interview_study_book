import { books } from 'virtual:content'
import { Breadcrumb } from '../components/Breadcrumb'
import { countInReview, isSectionComplete, isSectionUnlocked } from '../engine/sections'
import { useProgress } from '../storage/useProgress'
import { NotFoundPage } from './NotFound'

type Status = 'locked' | 'open' | 'complete'

const STATUS_LABEL: Record<Status, string> = { locked: 'Locked', open: 'Open', complete: '✓ Complete' }

export function ChapterPage({ book: bookId, chapter: chapterId }: { book: string; chapter: string }) {
  const progress = useProgress()
  const book = books.find((candidate) => candidate.id === bookId)
  const chapter = book?.chapters.find((candidate) => candidate.id === chapterId)
  if (!book || !chapter) return <NotFoundPage />

  return (
    <main>
      <Breadcrumb
        trail={[
          { label: 'Home', href: '#/' },
          { label: book.title, href: `#/b/${book.id}` },
        ]}
      />
      <h1>{chapter.title}</h1>

      <ol className="rows">
        {chapter.sections.map((section, index) => {
          const status: Status = !isSectionUnlocked(book.id, chapter, index, progress)
            ? 'locked'
            : isSectionComplete(book.id, section, progress)
              ? 'complete'
              : 'open'
          const inReview = countInReview(book.id, section, progress.concepts)
          return (
            <li key={section.id} className="row">
              <div className="row-head">
                {status === 'locked' ? (
                  <span className="row-title row-title-locked">{section.title}</span>
                ) : (
                  <a className="row-title" href={`#/b/${book.id}/${chapter.id}/${section.id}`}>
                    {section.title}
                  </a>
                )}
                <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span>
              </div>
              <p className="muted row-note">
                {status === 'locked'
                  ? `Answer the questions in “${chapter.sections[index - 1].title}” to unlock it.`
                  : `${inReview} of ${section.concepts.length} ${section.concepts.length === 1 ? 'concept' : 'concepts'} in review`}
              </p>
            </li>
          )
        })}
      </ol>
    </main>
  )
}
