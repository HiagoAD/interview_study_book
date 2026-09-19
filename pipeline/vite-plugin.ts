import path from 'node:path'
import { normalizePath } from 'vite'
import type { Plugin } from 'vite'
import type { Book } from '../src/types/content.ts'
import { loadContent } from './load.ts'
import { formatError } from './parse.ts'
import type { ContentError } from './parse.ts'
import { IMAGE_TYPES } from './render.ts'

const VIRTUAL_ID = 'virtual:content'
// A leading \0 marks an id as virtual, so no other plugin tries to read it from disk.
const RESOLVED_ID = `\0${VIRTUAL_ID}`

/** Files under the content folder that change what the site shows. */
const WATCHED_EXTENSIONS = new Set(['.md', ...Object.keys(IMAGE_TYPES)])

/** All the errors in one message, one `file:line: message` per line, for Vite's overlay and build log. */
export function formatErrors(errors: ContentError[]): string {
  return `${errors.length} content ${errors.length === 1 ? 'error' : 'errors'}:\n${errors.map(formatError).join('\n')}`
}

/**
 * The source of `virtual:content`. The build inlines it into a <script> in index.html, where a literal
 * `</script>` or `<!--` in the content (an accepted answer, say) would cut the script short or confuse
 * the HTML parser. Those are escaped here, so that holds whatever the bundler does with strings. The
 * rest of the tags stay as they are: escaping every `<` would add about 3% to dist/index.html.
 */
export function serialize(books: Book[]): string {
  const json = JSON.stringify(books).replace(/<(?=\/?script|!--)/gi, '\\u003c')
  return `export const books = JSON.parse(${JSON.stringify(json)})\n`
}

/** Serves `virtual:content`, which exports `books: Book[]`, and reloads the page when the content changes. */
export function content(dir = 'content'): Plugin {
  let root = process.cwd()
  let contentDir = ''

  function isContentFile(file: string): boolean {
    return file.startsWith(`${contentDir}/`) && WATCHED_EXTENSIONS.has(path.extname(file).toLowerCase())
  }

  return {
    name: 'content',

    configResolved(config) {
      root = config.root
      contentDir = normalizePath(path.resolve(root, dir))
    },

    resolveId: {
      filter: { id: new RegExp(`^${VIRTUAL_ID}$`) },
      handler: () => RESOLVED_ID,
    },

    load: {
      filter: { id: new RegExp(`^${RESOLVED_ID}$`) },
      async handler() {
        const { books, errors } = await loadContent(root, dir)
        // In dev this reaches Vite's overlay; in a build it fails the build. Either way every error is listed.
        if (errors.length > 0) this.error(formatErrors(errors))
        return serialize(books)
      },
    },

    configureServer(server) {
      server.watcher.add(path.resolve(root, dir))
    },

    // Called for every file the watcher reports, including ones with no module in the graph, like a .md or .svg.
    hotUpdate({ file }) {
      if (this.environment.name !== 'client' || !isContentFile(file)) return
      const { moduleGraph, hot, logger } = this.environment
      // The cached result would be served again otherwise.
      const module = moduleGraph.getModuleById(RESOLVED_ID)
      if (module) moduleGraph.invalidateModule(module)
      // Not an HMR update: books are read by many modules, and none of them can accept a new value in place.
      logger.info(`content changed ${path.relative(root, file)}: reloading`, { timestamp: true })
      hot.send({ type: 'full-reload' })
      return []
    },
  }
}

/**
 * KaTeX ships every font as woff2, woff and ttf. Every browser that can open this site reads woff2,
 * so the other two only add weight to dist/index.html.
 */
export function keepWoff2Only(css: string): string {
  return css.replace(/,\s*url\([^)]*\.(?:woff|ttf)\)\s*format\("(?:woff|truetype)"\)/g, '')
}

export function katexWoff2Only(): Plugin {
  return {
    name: 'katex-woff2-only',
    // Before Vite's own CSS handling turns each url() into an inlined asset.
    enforce: 'pre',
    transform: {
      filter: { id: /[\\/]katex[\\/]dist[\\/]katex(?:\.min)?\.css$/ },
      handler: (css) => keepWoff2Only(css),
    },
  }
}
