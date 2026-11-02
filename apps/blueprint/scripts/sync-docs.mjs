import 'dotenv/config'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {blueprintDir, docPaths, repoRoot} from '../docs.mjs'

const KB_TITLE = 'Site knowledge'

function sanity(args, {json = false} = {}) {
  const out = execFileSync('pnpm', ['dlx', 'sanity@latest', 'context', ...args, ...(json ? ['--json'] : [])], {
    cwd: blueprintDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 16 * 1024 * 1024,
  })
  if (!json) return out
  return JSON.parse(out.slice(out.search(/[[{]/)))
}

function resolveKnowledgeBaseId() {
  if (process.env.SITE_KNOWLEDGE_KB_ID) return process.env.SITE_KNOWLEDGE_KB_ID
  const {organizationId} = JSON.parse(
    readFileSync(join(blueprintDir, '.sanity/blueprint.config.json'), 'utf8'),
  )
  const matches = sanity(['list', '--organization', organizationId], {json: true}).filter(
    (kb) => kb.title === KB_TITLE,
  )
  if (matches.length !== 1) {
    throw new Error(
      `Expected one "${KB_TITLE}" Knowledge Base, found ${matches.length}. Set SITE_KNOWLEDGE_KB_ID in apps/blueprint/.env.`,
    )
  }
  return matches[0].publicId
}

const kb = resolveKnowledgeBaseId()
console.log(`Syncing ${docPaths.length} docs into ${KB_TITLE} (${kb})`)

const managed = new Set(docPaths)
for (const imp of sanity(['imports', 'list', kb], {json: true})) {
  if (imp.sourceKind !== 'dataset' && (managed.has(imp.name) || imp.name.endsWith('.md'))) {
    console.log(`  - remove ${imp.name}`)
    sanity(['imports', 'delete', kb, imp.id, '--yes'])
  }
}

for (const path of docPaths) {
  console.log(`  + import ${path}`)
  sanity([
    'imports',
    'create',
    kb,
    '--title',
    path,
    '--content-type',
    'text/markdown',
    '--text',
    readFileSync(join(repoRoot, path), 'utf8'),
  ])
}

console.log('Building…')
sanity(['build', kb, '--watch'])
process.stdout.write(sanity(['entries', 'list', kb]))
process.stdout.write(sanity(['issues', 'list', kb, '--status', 'open']))
