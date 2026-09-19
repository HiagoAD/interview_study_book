import { readFileSync, readdirSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import path from 'node:path'
import { parseContentFile, slug } from './parse.ts'
import type { ContentError, RawChapter, RawFile } from './parse.ts'

export interface RawBook {
  id: string
  title: string
  chapters: RawChapter[]
}

export interface LoadResult {
  books: RawBook[]
  errors: ContentError[]
}

export interface Source {
  /** Path relative to the repo root, as shown in error messages. */
  path: string
  text: string
}

export interface Totals {
  books: number
  chapters: number
  sections: number
  concepts: number
  variants: number
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Every `.md` file under `dir`, as repo-relative paths with `/` separators, in plain string order. */
export function findContentFiles(root: string, dir = 'content'): string[] {
  let entries: Dirent[]
  try {
    entries = readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort(byString)
}

/**
 * Parses every source and merges the files into books. Books are keyed by their id, so files whose
 * titles have the same slug belong together. Never throws on bad content: every problem, in every
 * file, comes back in `errors`, and `books` is best-effort when there are any.
 */
export function assembleBooks(sources: Source[]): LoadResult {
  const errors: ContentError[] = []
  const files: RawFile[] = []
  for (const source of [...sources].sort((a, b) => byString(a.path, b.path))) {
    const parsed = parseContentFile(source.path, source.text)
    errors.push(...parsed.errors)
    files.push(parsed.file)
  }

  const groups = new Map<string, { title: string; at: string; files: RawFile[] }>()
  for (const file of files) {
    if (!file.book) continue
    const id = slug(file.book.title)
    const group = groups.get(id)
    if (!group) {
      groups.set(id, { title: file.book.title, at: `${file.path}:${file.book.line}`, files: [file] })
    } else if (group.title !== file.book.title) {
      errors.push({
        file: file.path,
        line: file.book.line,
        message: `book "${file.book.title}" has the same id "${id}" as book "${group.title}" (${group.at}): write exactly the same title in every file of one book, or rename one of the books`,
      })
    } else {
      group.files.push(file)
    }
  }

  const books: RawBook[] = []
  for (const [id, group] of groups) {
    const chapters: RawChapter[] = []
    const chapterAt = new Map<string, { title: string; at: string }>()
    const sectionAt = new Map<string, string>()
    const conceptAt = new Map<string, string>()

    for (const file of group.files) {
      for (const chapter of file.chapters) {
        const first = chapterAt.get(chapter.id)
        if (first) {
          errors.push({
            file: file.path,
            line: chapter.line,
            message: `chapter "${chapter.title}" has the same id "${chapter.id}" as chapter "${first.title}" (${first.at}): chapter titles must be unique within a book, so rename this one or move its sections under the first`,
          })
        } else {
          chapterAt.set(chapter.id, { title: chapter.title, at: `${file.path}:${chapter.line}` })
          chapters.push(chapter)
        }

        for (const section of chapter.sections) {
          const seen = sectionAt.get(section.id)
          if (seen) {
            errors.push({
              file: file.path,
              line: section.line,
              message: `section id "${section.id}" is already used at ${seen}: section ids must be unique within a book, so give this section a different id`,
            })
          } else {
            sectionAt.set(section.id, `${file.path}:${section.line}`)
          }

          for (const concept of section.concepts) {
            const used = conceptAt.get(concept.id)
            if (used) {
              errors.push({
                file: file.path,
                line: concept.line,
                message: `concept id "${concept.id}" is already used at ${used}: concept ids must be unique within a book; to add another question to the same concept, start it with "?+" instead of "??"`,
              })
            } else {
              conceptAt.set(concept.id, `${file.path}:${concept.line}`)
            }
          }
        }
      }
    }
    books.push({ id, title: group.title, chapters })
  }

  books.sort((a, b) => a.title.localeCompare(b.title, 'en'))
  errors.sort((a, b) => byString(a.file, b.file) || a.line - b.line)
  return { books, errors }
}

export function loadContent(root: string, dir = 'content'): LoadResult {
  const sources = findContentFiles(root, dir).map((file) => ({
    path: file,
    text: readFileSync(path.join(root, file), 'utf8'),
  }))
  return assembleBooks(sources)
}

export function summarize(books: RawBook[]): Totals {
  const totals: Totals = { books: books.length, chapters: 0, sections: 0, concepts: 0, variants: 0 }
  for (const book of books) {
    totals.chapters += book.chapters.length
    for (const chapter of book.chapters) {
      totals.sections += chapter.sections.length
      for (const section of chapter.sections) {
        totals.concepts += section.concepts.length
        for (const concept of section.concepts) totals.variants += concept.variants.length
      }
    }
  }
  return totals
}
