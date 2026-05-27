/**
 * Seeds Brand Voice Agent Context documents.
 *
 * Reads every `*.md` file in `apps/studio/voices/` and ensures one
 * `sanity.agentContext` document per file:
 *
 *   apps/studio/voices/<slug>.md  →  doc id `<slug>` (e.g. `brand-voice`, `dead-head`)
 *
 * The doc's `name` is taken from the first `# Heading` in the markdown,
 * falling back to a title-cased version of the slug. `createIfNotExists`
 * is used, so existing voice documents in the Studio are NOT overwritten —
 * Studio is the source of truth once a voice has been seeded once. To
 * re-bootstrap from markdown, delete the voice document in Studio first.
 *
 * Run with:
 *   cd apps/studio && npx sanity exec ./scripts/seed-agent-context.ts --with-user-token
 */
import {getCliClient} from 'sanity/cli'
import {readFileSync, readdirSync} from 'node:fs'
import {dirname, resolve, basename, extname} from 'node:path'
import {fileURLToPath} from 'node:url'

// Which document types these voices apply to. Add your own types here.
const GROQ_FILTER = '_type in ["post", "author"]'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const voicesDir = resolve(scriptDir, '../voices')

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ')
}

function deriveName(slug: string, contents: string): string {
  const heading = contents.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim()
  if (heading) return heading.replace(/\s+(voice\s*&\s*tone|voice|tone)\s*$/i, '').trim() || heading
  return titleCase(slug)
}

const client = getCliClient({apiVersion: '2024-01-01'})

async function main() {
  const files = readdirSync(voicesDir).filter((f) => f.endsWith('.md'))
  if (files.length === 0) {
    console.warn(`No voice markdown files found in ${voicesDir}.`)
    return
  }

  for (const file of files) {
    const slug = basename(file, extname(file))
    const instructions = readFileSync(resolve(voicesDir, file), 'utf8')
    const name = deriveName(slug, instructions)

    await client.createIfNotExists({
      _id: slug,
      _type: 'sanity.agentContext',
      version: '1',
      name,
      slug: {_type: 'slug', current: slug},
      groqFilter: GROQ_FILTER,
      instructions,
    })

    console.log(`Ensured Agent Context "${name}" (id: ${slug}).`)
  }

  console.log(
    `\nEdit voices in the Studio under "Brand Voice" to tune them. ` +
      `Seeding will not overwrite documents that already exist.`,
  )
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
