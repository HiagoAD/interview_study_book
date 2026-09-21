import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'book'; book: string }
  | { name: 'chapter'; book: string; chapter: string }
  | { name: 'section'; book: string; chapter: string; section: string }
  | { name: 'glossary'; book: string }
  | { name: 'term'; book: string; term: string }
  | { name: 'review' }
  | { name: 'data' }
  | { name: 'not-found' }

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean)

  if (parts.length === 0) return { name: 'home' }
  if (parts.length === 1 && parts[0] === 'review') return { name: 'review' }
  if (parts.length === 1 && parts[0] === 'data') return { name: 'data' }

  if (parts[0] === 'b') {
    const [, book, chapter, section] = parts
    if (parts.length === 2 && book) return { name: 'book', book }
    if (parts.length === 3 && book && chapter) return { name: 'chapter', book, chapter }
    if (parts.length === 4 && book && chapter && section) {
      return { name: 'section', book, chapter, section }
    }
  }

  // The glossary sits beside the books rather than inside one, so no chapter slug has to be reserved.
  if (parts[0] === 'g') {
    const [, book, term] = parts
    if (parts.length === 2 && book) return { name: 'glossary', book }
    if (parts.length === 3 && book && term) return { name: 'term', book, term }
  }

  return { name: 'not-found' }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

function getSnapshot(): string {
  return window.location.hash
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getSnapshot)
  return parseRoute(hash)
}
