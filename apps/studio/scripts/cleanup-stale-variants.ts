/**
 * Removes stale Cloudinary variant entries from `video` documents.
 *
 * The variant catalog (`packages/video-core/src/registry.ts`) was trimmed to
 * only the variants with a real consumer. Video docs rendered before that trim
 * still carry the removed ids (the old per-platform social crops, the longform
 * short-form clips, `social-1x1`, etc.) in their stored `variants[]` array, so
 * the Studio "Variants" tab keeps showing them. New renders never produce them;
 * this is a one-time cleanup of pre-existing data.
 *
 * It rewrites each affected `variants[]` to keep only entries whose `variantId`
 * is still in the catalog. `autoGenerateArrayKeys` repairs any array items that
 * were stored without a `_key`. Idempotent — safe to re-run.
 *
 * Keep VALID_VARIANT_IDS in sync with `VARIANTS` in registry.ts.
 *
 * Run with:
 *   cd apps/studio && npx sanity exec ./scripts/cleanup-stale-variants.ts --with-user-token
 */
import {getCliClient} from 'sanity/cli'

const VALID_VARIANT_IDS = [
  'site-mp4',
  'site-poster-jpg',
  'site-preview-gif',
  'youtube-1080p-mp4',
  'podcast-mp3',
]

type VariantRow = {variantId?: string}
type VideoDoc = {_id: string; title?: string; variants?: VariantRow[]}

const client = getCliClient({apiVersion: '2024-12-27'})

async function run() {
  // `raw` perspective so we catch both published docs and their drafts.
  const docs = await client.fetch<VideoDoc[]>(
    `*[_type == "video" && defined(variants) && count(variants[!(variantId in $valid)]) > 0]{
      _id, title, variants
    }`,
    {valid: VALID_VARIANT_IDS},
    {perspective: 'raw'},
  )

  if (docs.length === 0) {
    console.log('No video docs with stale variants — nothing to do.')
    return
  }

  console.log(`Found ${docs.length} video doc(s) with stale variants:\n`)

  let patched = 0
  let removedTotal = 0
  for (const doc of docs) {
    const all = doc.variants ?? []
    const kept = all.filter((v) => v.variantId && VALID_VARIANT_IDS.includes(v.variantId))
    const removed = all.length - kept.length
    if (removed === 0) continue

    await client
      .patch(doc._id)
      .set({variants: kept})
      .commit({autoGenerateArrayKeys: true})

    patched += 1
    removedTotal += removed
    console.log(`  ✓ ${doc._id}  (${doc.title ?? 'untitled'}) — removed ${removed}, kept ${kept.length}`)
  }

  console.log(`\nDone. Patched ${patched} doc(s), removed ${removedTotal} stale variant entries.`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
