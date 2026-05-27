/**
 * Seeds the Brand Voice Agent Context document.
 *
 * This bootstraps the brand-voice `sanity.agentContext` document (id
 * "brand-voice") from `brand-voice-instructions.md`. It uses
 * `createIfNotExists`, so it only creates the doc the FIRST time — after that,
 * the **Brand Voice** document in the Studio is the source of truth and
 * re-running this won't overwrite your edits. (To re-bootstrap from the
 * markdown, delete the brand-voice document first.)
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
  await client.createIfNotExists({
    _id: DOC_ID,
    _type: 'sanity.agentContext',
    version: '1',
    name: NAME,
    slug: {_type: 'slug', current: SLUG},
    groqFilter: GROQ_FILTER,
    instructions,
  })

  console.log(
    `Ensured Agent Context "${NAME}" exists (id: ${DOC_ID}). ` +
      `Edit it in the Studio under "Brand Voice" to tune the voice.`,
  )
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
