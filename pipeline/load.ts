import { readFileSync, readdirSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import path from 'node:path'
import type { Book, Chapter, Concept, Section, Variant } from '../src/types/content.ts'
import { parseContentFile, slug } from './parse.ts'
import type { ContentError, RawChapter, RawFile, RawVariant, Text } from './parse.ts'
import { renderMarkdown, renderOption } from './render.ts'
import type { Rendered } from './render.ts'

export interface RawBook {
  id: string
  title: string
  chapters: RawChapter[]
}

/** The result of parsing and assembling, before anything is rendered. */
export interface AssembleResult {
  books: RawBook[]
  errors: ContentError[]
}

export interface LoadResult {
  books: Book[]
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
const byLocation = (a: ContentError, b: ContentError) => byString(a.file, b.file) || a.line - b.line

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
export function assembleBooks(sources: Source[]): AssembleResult {
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
  errors.sort(byLocation)
  return { books, errors }
}

/**
 * Renders every chunk of Markdown in the books. Each chunk is rendered on its own, so an error's
 * line is mapped from the chunk back to the file (see `renderMarkdown`). Like `assembleBooks` it
 * never throws on bad content: `books` is best-effort when there are errors, and a chunk that
 * failed has empty HTML.
 */
export async function renderBooks(rawBooks: RawBook[], root: string, dir = 'content'): Promise<LoadResult> {
  const errors: ContentError[] = []
  const collect = ({ html, errors: found }: Rendered) => {
    errors.push(...found)
    return html
  }

  async function renderVariant(variant: RawVariant, block: (text: Text) => Promise<string>, option: (text: Text) => Promise<string>): Promise<Variant> {
    const prompt = await block(variant.prompt)
    const explanation = await block(variant.explanation)
    switch (variant.type) {
      case 'tf':
        return { type: 'tf', prompt, explanation, answer: variant.answer }
      case 'short':
        return { type: 'short', prompt, explanation, accepted: variant.accepted }
      default: {
        const correct: string[] = []
        for (const text of variant.correct) correct.push(await option(text))
        const wrong: string[] = []
        for (const text of variant.wrong) wrong.push(await option(text))
        return { type: variant.type, prompt, explanation, correct, wrong, n: variant.n }
      }
    }
  }

  const books: Book[] = []
  for (const rawBook of rawBooks) {
    const chapters: Chapter[] = []
    for (const rawChapter of rawBook.chapters) {
      const context = { root, dir, file: rawChapter.file }
      const block = async (text: Text) => collect(await renderMarkdown(text, context))
      const option = async (text: Text) => collect(await renderOption(text, context))

      const sections: Section[] = []
      for (const rawSection of rawChapter.sections) {
        const html = await block(rawSection.content)
        const concepts: Concept[] = []
        for (const rawConcept of rawSection.concepts) {
          const variants: Variant[] = []
          for (const rawVariant of rawConcept.variants) variants.push(await renderVariant(rawVariant, block, option))
          concepts.push({ id: rawConcept.id, variants })
        }
        sections.push({ id: rawSection.id, title: rawSection.title, html, concepts })
      }
      chapters.push({ id: rawChapter.id, title: rawChapter.title, sections })
    }
    books.push({ id: rawBook.id, title: rawBook.title, chapters })
  }
  return { books, errors: errors.sort(byLocation) }
}

/**
 * Finds, parses and renders every content file. Every error from every stage comes back together,
 * sorted by file and line, so one run lists all of them. `books` is best-effort when there are any.
 */
export async function loadContent(root: string, dir = 'content'): Promise<LoadResult> {
  const sources = findContentFiles(root, dir).map((file) => ({
    path: file,
    text: readFileSync(path.join(root, file), 'utf8'),
  }))
  const assembled = assembleBooks(sources)
  const rendered = await renderBooks(assembled.books, root, dir)
  return { books: rendered.books, errors: [...assembled.errors, ...rendered.errors].sort(byLocation) }
}

/** Anything with the book shape: raw books from the parser and rendered books count alike. */
interface Countable {
  chapters: { sections: { concepts: { variants: unknown[] }[] }[] }[]
}

export function summarize(books: Countable[]): Totals {
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
