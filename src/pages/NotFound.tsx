export function NotFoundPage() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>
        There is nothing at this address. If it was a link to a book, chapter or section, it may have been renamed or
        removed from the content: a book's address comes from its title, and a section's from its id.
      </p>
      <p>
        <a className="button button-primary" href="#/">
          Back to the books
        </a>
      </p>
    </main>
  )
}
