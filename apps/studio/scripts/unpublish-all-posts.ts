/**
 * Unpublishes ALL `post` documents: for each published post it ensures a draft
 * exists (copying the published content if there isn't one already), then deletes
 * the published document — leaving the post as a draft only. Mirrors the Studio
 * "Unpublish" action, in bulk. Content is preserved as a draft; this only removes
 * the published version (so the site's published queries stop returning it).
 *
 * NOTE: Sanity refuses to delete a published doc that still has incoming strong
 * references. `video.post` references the published post, so any rendered videos
 * will block their matching posts. Run `delete-all-videos.ts` first for a clean
 * sweep — posts that are still referenced are reported and skipped, never lost.
 *
 * Idempotent — safe to re-run.
 *
 * Run with:
 *   cd apps/studio && npx sanity exec ./scripts/unpublish-all-posts.ts --with-user-token
 */
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2024-12-27'})

async function run() {
  // Published docs only (drafts live under the `drafts.` path).
  const published = await client.fetch<Array<Record<string, unknown> & {_id: string}>>(
    `*[_type == "post" && !(_id in path("drafts.**"))]`,
    {},
    {perspective: 'raw'},
  )

  if (published.length === 0) {
    console.log('No published posts found — nothing to unpublish.')
    return
  }

  console.log(`Found ${published.length} published post(s).`)

  let unpublished = 0
  let skipped = 0
  for (const doc of published) {
    // Build the draft from the published content; drop server-managed fields.
    const draft: Record<string, unknown> = {...doc, _id: `drafts.${doc._id}`}
    delete draft._rev
    delete draft._createdAt
    delete draft._updatedAt

    try {
      // Atomic: keep/seed the draft, then drop the published doc. createIfNotExists
      // means an existing (newer) draft is preserved rather than overwritten.
      await client
        .transaction()
        .createIfNotExists(draft as never)
        .delete(doc._id)
        .commit()
      unpublished += 1
      console.log(`  ✓ unpublished ${doc._id}`)
    } catch (err) {
      skipped += 1
      console.error(`  ✗ skipped ${doc._id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log(`\nDone. Unpublished ${unpublished}, skipped ${skipped} of ${published.length}.`)
  if (skipped > 0) {
    console.log(
      'Skipped posts are usually blocked by incoming references (e.g. videos). ' +
        'Run delete-all-videos.ts first, then re-run this script.',
    )
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
