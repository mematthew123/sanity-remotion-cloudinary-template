/**
 * Deletes ALL `video` documents (published + drafts) from the dataset.
 *
 * Destructive and irreversible. Intended for clearing out test/demo renders.
 * Before deleting, it unsets any `newsletter.video` references pointing at a
 * video — Sanity refuses to delete a document that is still referenced.
 *
 * The render pipeline recreates video docs on the next render, so this only
 * clears existing data; it changes no schema or code.
 *
 * Run with:
 *   cd apps/studio && npx sanity exec ./scripts/delete-all-videos.ts --with-user-token
 */
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2024-12-27'})

async function run() {
  // `raw` perspective so we catch both published docs and their drafts.
  const ids = await client.fetch<string[]>(`*[_type == "video"]._id`, {}, {perspective: 'raw'})

  if (ids.length === 0) {
    console.log('No video documents found — nothing to delete.')
    return
  }

  console.log(`Found ${ids.length} video document(s) (including drafts).`)

  // Clear references first so deletes don't fail with a reference conflict.
  const referencing = await client.fetch<{_id: string}[]>(
    `*[_type == "newsletter" && defined(video._ref)]{_id}`,
    {},
    {perspective: 'raw'},
  )
  for (const n of referencing) {
    await client.patch(n._id).unset(['video']).commit()
    console.log(`  · cleared video reference on newsletter ${n._id}`)
  }

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

  console.log(`\nDone. Deleted ${deleted}/${ids.length} video document(s).`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
