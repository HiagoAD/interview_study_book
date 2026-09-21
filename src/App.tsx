import { useEffect } from 'react'
import { StorageBanner } from './components/StorageBanner'
import { useRoute } from './router'
import { BookPage } from './pages/Book'
import { ChapterPage } from './pages/Chapter'
import { DataPage } from './pages/Data'
import { GlossaryPage } from './pages/Glossary'
import { TermPage } from './pages/Term'
import { HomePage } from './pages/Home'
import { NotFoundPage } from './pages/NotFound'
import { ReviewPage } from './pages/Review'
import { SectionPage } from './pages/Section'
import { ProgressProvider } from './storage/ProgressProvider'

export function App() {
  return (
    <ProgressProvider>
      <StorageBanner />
      <Pages />
    </ProgressProvider>
  )
}

function Pages() {
  const route = useRoute()

  // Following a link to another page changes only the hash, and the browser keeps the scroll position: without
  // this, "Next section" would open the next page scrolled to the bottom.
  const page = JSON.stringify(route)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [page])

  switch (route.name) {
    case 'home':
      return <HomePage />
    case 'book':
      return <BookPage book={route.book} />
    case 'chapter':
      return <ChapterPage book={route.book} chapter={route.chapter} />
    case 'section':
      return <SectionPage book={route.book} chapter={route.chapter} section={route.section} />
    case 'glossary':
      return <GlossaryPage book={route.book} />
    case 'term':
      return <TermPage book={route.book} term={route.term} />
    case 'review':
      return <ReviewPage />
    case 'data':
      return <DataPage />
    case 'not-found':
      return <NotFoundPage />
  }
}
