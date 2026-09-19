export function SectionPage({
  book,
  chapter,
  section,
}: {
  book: string
  chapter: string
  section: string
}) {
  return (
    <main>
      <h1>
        Section: {section} <small>({book} / {chapter})</small>
      </h1>
      <p>Placeholder: will show the section's content, then its questions.</p>
      <p>
        <a href={`#/b/${book}/${chapter}`}>Back to chapter</a>
      </p>
    </main>
  )
}
