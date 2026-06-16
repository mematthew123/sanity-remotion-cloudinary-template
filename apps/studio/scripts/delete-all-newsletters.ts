/**
 * Deletes ALL `newsletter` documents (published + drafts) from the dataset.
 *
 * Destructive and irreversible. Intended for clearing out test/demo newsletters.
 * Nothing in the schema references a newsletter, so no reference-clearing step
 * is needed — but per-doc failures are caught and reported just in case.
 *
 * Run with:
 *   cd apps/studio && npx sanity exec ./scripts/delete-all-newsletters.ts --with-user-token
 */
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2024-12-27'})

async function run() {
  // `raw` perspective so we catch both published docs and their drafts.
  const ids = await client.fetch<string[]>(`*[_type == "newsletter"]._id`, {}, {perspective: 'raw'})

  if (ids.length === 0) {
    console.log('No newsletter documents found — nothing to delete.')
    return
  }

  console.log(`Found ${ids.length} newsletter document(s) (including drafts).`)

  let deleted = 0
  for (const id of ids) {
    try {
      await client.delete(id)
      deleted += 1
      console.log(`  ✓ deleted ${id}`)
    } catch (err) {
      console.error(`  ✗ failed ${id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`\nDone. Deleted ${deleted}/${ids.length} newsletter document(s).`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
