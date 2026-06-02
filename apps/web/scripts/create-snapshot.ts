// Build-time snapshot creator. Runs as part of `pnpm vercel-build`:
//   1. Creates a fresh Vercel Sandbox.
//   2. Bundles the Remotion entry and uploads it into the sandbox.
//   3. Takes a non-expiring snapshot of the sandbox state.
//   4. Stores the snapshot id in Vercel Blob keyed by VERCEL_DEPLOYMENT_ID.
//
// At request time, restore-snapshot.ts reads the id and resumes — skipping the
// ~30s of sandbox + bundle setup that would otherwise eat the function budget.
import {put} from '@vercel/blob'
import {addBundleToSandbox, createSandbox} from '@remotion/vercel'

import {bundleRemotionProject} from '../app/api/video/render/helpers'

const BLOB_KEY = `snapshot-cache/${process.env.VERCEL_DEPLOYMENT_ID ?? 'local'}.json`
const BUNDLE_DIR = '.remotion-bundle'

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is not set. Connect a Vercel Blob store to this project (Storage → Create → Blob).',
    )
  }

  const sandbox = await createSandbox({
    onProgress: async ({progress, message}: {progress: number; message: string}) => {
      console.log(`[snapshot] ${message} (${Math.round(progress * 100)}%)`)
    },
  })

  console.log('[snapshot] bundling Remotion project…')
  bundleRemotionProject(BUNDLE_DIR)

  console.log('[snapshot] uploading bundle to sandbox…')
  await addBundleToSandbox({sandbox, bundleDir: BUNDLE_DIR})

  console.log('[snapshot] taking snapshot…')
  const {snapshotId} = await sandbox.snapshot({expiration: 0})

  await put(BLOB_KEY, JSON.stringify({snapshotId}), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    allowOverwrite: true,
  })

  console.log(`[snapshot] saved: ${snapshotId} → ${BLOB_KEY}`)

  await sandbox.stop().catch(() => undefined)
}

main().catch((err) => {
  console.error('[snapshot] failed:', err)
  process.exit(1)
})
