import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const distDir = path.resolve(import.meta.dirname, '..', 'dist')

function listFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(full))
    else files.push(full)
  }
  return files
}

const errors = []

const extraFiles = listFiles(distDir)
  .map((file) => path.relative(distDir, file))
  .filter((file) => file !== 'index.html')
if (extraFiles.length > 0) {
  errors.push(`dist/ holds files other than index.html: ${extraFiles.join(', ')}`)
}

const html = readFileSync(path.join(distDir, 'index.html'), 'utf8')

// Inline JS can legitimately contain "src=" or "href=" as plain string literals
// (built URLs, sprite refs, ...). Strip script bodies before scanning for real
// references so those literals aren't mistaken for references from the HTML itself.
const withoutScriptBodies = html.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2')

const refPattern = /\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi
for (const match of withoutScriptBodies.matchAll(refPattern)) {
  const value = match[1] ?? match[2]
  if (value.startsWith('data:') || value.startsWith('#')) continue
  errors.push(`index.html references a file or URL outside inline script: ${match[0]}`)
}

const styleUrlPattern = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi
for (const styleMatch of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
  for (const urlMatch of styleMatch[1].matchAll(styleUrlPattern)) {
    const value = urlMatch[2]
    if (!value.startsWith('data:')) {
      errors.push(`<style> contains a non-data url(): ${urlMatch[0]}`)
    }
  }
}

if (errors.length > 0) {
  console.error('verify-dist failed:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log('verify-dist: dist/index.html is self-contained.')
