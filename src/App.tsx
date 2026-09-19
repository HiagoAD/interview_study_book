import { useRoute } from './router'
import { BookPage } from './pages/Book'
import { ChapterPage } from './pages/Chapter'
import { DataPage } from './pages/Data'
import { HomePage } from './pages/Home'
import { NotFoundPage } from './pages/NotFound'
import { ReviewPage } from './pages/Review'
import { SectionPage } from './pages/Section'
import { ProgressProvider } from './storage/ProgressProvider'

export function App() {
  return (
    <ProgressProvider>
      <Pages />
    </ProgressProvider>
  )
}

function Pages() {
  const route = useRoute()

  switch (route.name) {
    case 'home':
      return <HomePage />
    case 'book':
      return <BookPage book={route.book} />
    case 'chapter':
      return <ChapterPage book={route.book} chapter={route.chapter} />
    case 'section':
      return <SectionPage book={route.book} chapter={route.chapter} section={route.section} />
    case 'review':
      return <ReviewPage />
    case 'data':
      return <DataPage />
    case 'not-found':
      return <NotFoundPage />
  }
}
