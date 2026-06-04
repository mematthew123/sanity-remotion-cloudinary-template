// Run ONCE before the first `pnpm --filter @template/blueprints deploy` on a
// dataset that already has ready videos:
//
//   pnpm --filter @template/blueprints backfill
//
// Patches `socialPostedAt: "backfill"` onto every already-ready video so the
// blueprint filter excludes them. Skipping this step would cause the function
// to fire once for every historical ready video the first time the blueprint
// observes the dataset.
import 'dotenv/config'
import {createClient} from '@sanity/client'

const {SANITY_PROJECT_ID, SANITY_DATASET, SANITY_WRITE_TOKEN} = process.env

if (!SANITY_PROJECT_ID || !SANITY_DATASET || !SANITY_WRITE_TOKEN) {
  console.error('Set SANITY_PROJECT_ID, SANITY_DATASET, SANITY_WRITE_TOKEN in apps/blueprints/.env')
  process.exit(1)
}

const client = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  token: SANITY_WRITE_TOKEN,
  useCdn: false,
  apiVersion: '2024-01-01',
})

async function main() {
  const ids = await client.fetch<string[]>(
    '*[_type == "video" && status == "ready" && !defined(socialPostedAt)]._id',
  )

  console.log(`Found ${ids.length} ready videos without socialPostedAt`)
  if (ids.length === 0) return

  const tx = ids.reduce(
    (acc, id) => acc.patch(id, {set: {socialPostedAt: 'backfill'}}),
    client.transaction(),
  )
  await tx.commit()
  console.log(`Patched ${ids.length} videos with socialPostedAt: "backfill"`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
