// Served by pipeline/vite-plugin.ts: every book in content/, rendered to HTML at build time.
declare module 'virtual:content' {
  export const books: import('./content').Book[]
}
