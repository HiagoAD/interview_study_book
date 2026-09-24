import { readFileSync, readdirSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import path from 'node:path'
import type { Book, Chapter, Concept, GlossaryEntry, Section, SectionUse, Variant } from '../src/types/content.ts'
import { parseContentFile, slug } from './parse.ts'
import type { ContentError, RawChapter, RawEntry, RawFile, RawVariant, Text } from './parse.ts'
import { isOneParagraph, renderMarkdown, renderOption } from './render.ts'
import type { LinkContext, Rendered, SectionTarget, TermTarget } from './render.ts'

export interface RawBook {
  id: string
  title: string
  chapters: RawChapter[]
  entries: RawEntry[]
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
  terms: number
  /** Section-to-term links, counted once per section, which is what an entry's "where this appears" lists. */
  links: number
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const byLocation = (a: ContentError, b: ContentError) => byString(a.file, b.file) || a.line - b.line

interface Place {
  file: string
  line: number
}

const at = (place: Place) => `${place.file}:${place.line}`

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
 * Parses every source and merges the files into books. Every file names its book's id in `book:`, and
 * one of them may give its title in `title:`; without one, the title is the id. Never throws on bad
 * content: every problem, in every file, comes back in `errors`, and `books` is best-effort when there
 * are any.
 */
export function assembleBooks(sources: Source[]): AssembleResult {
  const errors: ContentError[] = []
  const files: RawFile[] = []
  for (const source of [...sources].sort((a, b) => byString(a.path, b.path))) {
    const parsed = parseContentFile(source.path, source.text)
    errors.push(...parsed.errors)
    files.push(parsed.file)
  }

  // A book's first `book:` line, and its `title:` line when it has one.
  const groups = new Map<string, { first: Place; title: (Place & { text: string }) | null; files: RawFile[] }>()
  for (const file of files) {
    if (!file.book) continue
    const { id } = file.book
    let group = groups.get(id)
    if (!group) {
      group = { first: { file: file.path, line: file.book.line }, title: null, files: [] }
      groups.set(id, group)
    }
    group.files.push(file)
    if (!file.title) continue
    if (group.title) {
      errors.push({
        file: file.path,
        line: file.title.line,
        message: `book "${id}" already has the title "${group.title.text}" (${at(group.title)}): give the title in one file of the book only`,
      })
    } else {
      group.title = { text: file.title.text, file: file.path, line: file.title.line }
    }
  }

  const books: RawBook[] = []
  const titleOwners = new Map<string, { id: string; place: Place }>()
  for (const [id, group] of groups) {
    const title = group.title?.text ?? id
    const place = group.title ?? group.first
    const owner = titleOwners.get(title)
    if (owner) {
      errors.push({ file: place.file, line: place.line, message: `book "${id}" has the same title as book "${owner.id}" (${at(owner.place)}): give one of them another title` })
    } else {
      titleOwners.set(title, { id, place })
    }

    const chapters: RawChapter[] = []
    const entries: RawEntry[] = []
    // An entry id and every "=" name share one namespace, because `[[...]]` looks a term up by either.
    const nameAt = new Map<string, { term: string; at: string }>()
    const chapterAt = new Map<string, { title: string; at: string }>()
    const sectionAt = new Map<string, string>()
    const conceptAt = new Map<string, string>()

    for (const file of group.files) {
      for (const entry of file.entries) {
        entries.push(entry)
        for (const name of [{ text: entry.id, line: entry.line }, ...entry.names]) {
          const key = slug(name.text)
          const first = nameAt.get(key)
          if (first) {
            errors.push({
              file: file.path,
              line: name.line,
              message: `"${name.text}" already names the glossary entry "${first.term}" (${first.at}): an entry id and every "=" name must be unique within a book, because a "[[...]]" link finds a term by them`,
            })
          } else {
            nameAt.set(key, { term: entry.term, at: `${file.path}:${entry.line}` })
          }
        }
      }

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
    const entryIds = new Set(entries.map((entry) => entry.id))
    for (const entry of entries) {
      for (const see of entry.see) {
        if (see.id === entry.id) {
          errors.push({ file: entry.file, line: see.line, message: `"-> ${see.id}" points at this entry itself: "->" lists other entries, so remove it` })
        } else if (!entryIds.has(see.id)) {
          errors.push({
            file: entry.file,
            line: see.line,
            message: `no glossary entry has the id "${see.id}": "->" takes the id from another entry's heading, and it has to be in this book`,
          })
        }
      }
    }

    books.push({ id, title, chapters, entries })
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
/** Every id and "=" name of the book's entries, slugged, all pointing at their entry. */
function termIndex(book: RawBook): Map<string, TermTarget> {
  const terms = new Map<string, TermTarget>()
  for (const entry of book.entries) {
    const target = { id: entry.id, term: entry.term }
    // Ids are already slugs. A duplicate name was reported while assembling, so the last one may win here.
    terms.set(entry.id, target)
    for (const name of entry.names) terms.set(slug(name.text), target)
  }
  return terms
}

/** The book's sections by id, with the chapter each sits in, because a section's route needs both. */
function sectionIndex(book: RawBook): Map<string, SectionTarget> {
  const sections = new Map<string, SectionTarget>()
  for (const chapter of book.chapters) {
    for (const section of chapter.sections) {
      if (!sections.has(section.id)) sections.set(section.id, { chapter: chapter.id, title: section.title })
    }
  }
  return sections
}

export async function renderBooks(rawBooks: RawBook[], root: string, dir = 'content'): Promise<LoadResult> {
  const errors: ContentError[] = []
  // Where the entries linked from the chunk being rendered land. Reset per section, and read once it is done.
  let sink: string[] = []
  const collect = ({ html, errors: found, refs }: Rendered) => {
    errors.push(...found)
    sink.push(...refs)
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
    const terms = termIndex(rawBook)
    const sectionsById = sectionIndex(rawBook)
    const links = (kind: 'section' | 'entry', id: string): LinkContext => ({
      bookId: rawBook.id,
      terms,
      sections: sectionsById,
      self: { kind, id },
    })
    const uses = new Map<string, SectionUse[]>()

    const chapters: Chapter[] = []
    for (const rawChapter of rawBook.chapters) {
      const sections: Section[] = []
      for (const rawSection of rawChapter.sections) {
        const context = { root, dir, file: rawChapter.file, links: links('section', rawSection.id) }
        const block = async (text: Text) => collect(await renderMarkdown(text, context))
        const option = async (text: Text) => collect(await renderOption(text, context))

        sink = []
        const html = await block(rawSection.content)
        const concepts: Concept[] = []
        for (const rawConcept of rawSection.concepts) {
          const variants: Variant[] = []
          for (const rawVariant of rawConcept.variants) variants.push(await renderVariant(rawVariant, block, option))
          concepts.push({ id: rawConcept.id, variants })
        }
        // One section that names a term three times is one place it appears, so each entry is listed once.
        for (const entryId of new Set(sink)) {
          const seen = uses.get(entryId) ?? []
          seen.push({ chapter: rawChapter.id, section: rawSection.id })
          uses.set(entryId, seen)
        }
        sections.push({ id: rawSection.id, title: rawSection.title, html, concepts })
      }
      chapters.push({ id: rawChapter.id, title: rawChapter.title, sections })
    }

    // After the chapters, so every entry knows the sections that reached it.
    const glossary: GlossaryEntry[] = []
    for (const rawEntry of rawBook.entries) {
      const context = { root, dir, file: rawEntry.file, links: links('entry', rawEntry.id) }
      // Links between entries are what "->" is for, so nothing an entry says counts as a place it appears.
      sink = []
      const summary = collect(await renderMarkdown(rawEntry.summary, context))
      const html = rawEntry.body.md ? collect(await renderMarkdown(rawEntry.body, context)) : ''
      if (summary && !isOneParagraph(summary)) {
        errors.push({
          file: rawEntry.file,
          line: rawEntry.summary.line,
          message: 'the summary must be one paragraph, because a preview card shows it whole: move the list, table, code block or second paragraph into the body, below a blank line',
        })
      }
      glossary.push({
        id: rawEntry.id,
        term: rawEntry.term,
        names: rawEntry.names.map((name) => name.text),
        summary,
        html,
        see: rawEntry.see.map((see) => see.id),
        uses: uses.get(rawEntry.id) ?? [],
      })
    }
    glossary.sort((a, b) => a.term.localeCompare(b.term, 'en'))

    books.push({ id: rawBook.id, title: rawBook.title, chapters, glossary })
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
export interface Countable {
  chapters: { sections: { concepts: { variants: unknown[] }[] }[] }[]
  /** A rendered book carries `glossary`; a raw one carries `entries`, which has no backlinks yet. */
  glossary?: { uses: unknown[] }[]
  entries?: unknown[]
}

export function summarize(books: Countable[]): Totals {
  const totals: Totals = { books: books.length, chapters: 0, sections: 0, concepts: 0, variants: 0, terms: 0, links: 0 }
  for (const book of books) {
    totals.terms += book.glossary?.length ?? book.entries?.length ?? 0
    for (const entry of book.glossary ?? []) totals.links += entry.uses.length
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
