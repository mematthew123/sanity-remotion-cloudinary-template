import {head} from '@vercel/blob'
import {Sandbox} from '@vercel/sandbox'

const SANDBOX_TIMEOUT_MS = 5 * 60 * 1000

const snapshotBlobKey = () =>
  `snapshot-cache/${process.env.VERCEL_DEPLOYMENT_ID ?? 'local'}.json`

// Resume a sandbox from the snapshot recorded at build time by
// scripts/create-snapshot.ts. The snapshot already contains the Remotion bundle
// uploaded via addBundleToSandbox, so the render route skips the bundle step in
// production and just renders inside the resumed sandbox.
//
// `vcpus` overrides the default vCPU allocation (each vCPU also gets 2048 MB
// of memory). Long-form narrated renders need more CPU than the default to
// finish inside `maxDuration` — observed default sandbox does ~0.7 frames/sec
// on a 1920x1080 narrated composition, which can't finish a multi-minute
// reading in 13 minutes.
export async function restoreSnapshot({vcpus}: {vcpus?: number} = {}) {
  const blob = await head(snapshotBlobKey(), {
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  if (!blob) {
    throw new Error(
      'No sandbox snapshot found in Vercel Blob. The Vercel build should run `scripts/create-snapshot.ts` (see apps/web/vercel.json `buildCommand`).',
    )
  }

  const response = await fetch(blob.url)
  const {snapshotId} = (await response.json()) as {snapshotId?: string}
  if (!snapshotId) {
    throw new Error('Snapshot record in Vercel Blob is missing `snapshotId`.')
  }

  return Sandbox.create({
    source: {type: 'snapshot', snapshotId},
    timeout: SANDBOX_TIMEOUT_MS,
    ...(vcpus ? {resources: {vcpus}} : {}),
  })
}
