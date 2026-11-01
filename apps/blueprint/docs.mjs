import {readdirSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

export const blueprintDir = dirname(fileURLToPath(import.meta.url))
export const repoRoot = resolve(blueprintDir, '../..')

export const docPaths = [
  'README.md',
  'SETUP.md',
  ...readdirSync(join(repoRoot, 'docs'))
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((f) => `docs/${f}`),
]

export function citationName(path) {
  return `${path.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`
}
