export function BookPage({ book }: { book: string }) {
  return (
    <main>
      <h1>Book: {book}</h1>
      <p>Placeholder: will list this book's chapters with progress.</p>
      <p>
        <a href="#/">Home</a> · <a href={`#/b/${book}/sample-chapter`}>Sample chapter</a>
      </p>
    </main>
  )
}
