/**
 * Seeds the Brand Voice Agent Context document.
 *
 * This reads `brand-voice-instructions.md` (the editable source of truth for
 * your brand voice) and writes it into a `sanity.agentContext` document that
 * the Studio's Assist field actions reference. Edit the markdown, then re-run
 * this script to publish the updated voice.
 *
 * Run with:
 *   cd apps/studio && npx sanity exec ./scripts/seed-agent-context.ts --with-user-token
 */
import {getCliClient} from 'sanity/cli'
import {readFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const DOC_ID = 'brand-voice'
const SLUG = 'brand-voice'
const NAME = 'Brand Voice'
// Which document types this context applies to. Add your own types here.
const GROQ_FILTER = '_type in ["post", "author"]'

// `import.meta.url` is the portable way to locate sibling files in an ESM
// package (this Studio sets `"type": "module"`), so `__dirname` is unavailable.
const scriptDir = dirname(fileURLToPath(import.meta.url))

const instructions = readFileSync(resolve(scriptDir, '../brand-voice-instructions.md'), 'utf8')

const client = getCliClient({apiVersion: '2024-01-01'})

async function main() {
  await client.createOrReplace({
    _id: DOC_ID,
    _type: 'sanity.agentContext',
    version: '1',
    name: NAME,
    slug: {_type: 'slug', current: SLUG},
    groqFilter: GROQ_FILTER,
    instructions,
  })

  console.log(`Seeded Agent Context "${NAME}" (id: ${DOC_ID})`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
