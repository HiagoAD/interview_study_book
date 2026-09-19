export function ChapterPage({ book, chapter }: { book: string; chapter: string }) {
  return (
    <main>
      <h1>
        Chapter: {chapter} <small>({book})</small>
      </h1>
      <p>Placeholder: will list this chapter's sections, locked/open/complete.</p>
      <p>
        <a href={`#/b/${book}`}>Back to book</a> ·{' '}
        <a href={`#/b/${book}/${chapter}/sample-section`}>Sample section</a>
      </p>
    </main>
  )
}
