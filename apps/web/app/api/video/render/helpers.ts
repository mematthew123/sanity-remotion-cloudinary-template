import {spawn} from 'node:child_process'
import {resolve} from 'node:path'
import {
  ensureBrowser,
  selectComposition,
  renderMedia,
  type CancelSignal,
} from '@remotion/renderer'

// Bundle the Remotion entry into `bundleDir` (absolute, or relative to `apps/web`). Used at
// build time for the snapshot and as the local-dev fallback inside the render
// route (when VERCEL=undefined). In production, the bundle ships inside the
// snapshot — this function isn't called on the hot path.
//
// Uses `pnpm exec` rather than the per-package `node_modules/.bin/remotion`
// shim because this repo's `.npmrc` sets `node-linker=hoisted` — the binary
// only exists at the workspace-root `node_modules/.bin/`, not inside
// `apps/web/`. `pnpm exec` walks up to find it.
export function bundleRemotionProject(bundleDir: string): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn(
      'pnpm',
      ['exec', 'remotion', 'bundle', 'remotion/index.ts', '--out-dir', resolve(process.cwd(), bundleDir)],
      {cwd: process.cwd(), stdio: 'inherit'},
    )
    child.on('error', (e) => fail(new Error(`Remotion bundle failed: ${e.message}`)))
    child.on('exit', (code) =>
      code === 0 ? done() : fail(new Error(`Remotion bundle failed (exit code ${code})`)),
    )
  })
}

// Local render fallback: render the composition with headless Chromium on this
// machine — no Vercel Sandbox, no Blob store. This is what makes the template
// runnable with only Sanity + Cloudinary configured (see the LOCAL_RENDER /
// no-BLOB_READ_WRITE_TOKEN branch in route.ts). Writes the MP4 to the caller's
// `outputLocation`, which the caller uploads straight to Cloudinary and unlinks.
//
// Chromium is downloaded automatically by `ensureBrowser()` on first run
// (~1 min, one-time). Concurrency is left to Remotion's auto-detect so it uses
// all available cores locally.
export async function renderLocally(opts: {
  bundleDir: string
  compositionId: string
  inputProps: Record<string, unknown>
  outputLocation: string
  cancelSignal?: CancelSignal
  onProgress?: (p: {renderedFrames: number; encodedFrames: number}) => void
}): Promise<void> {
  const {bundleDir, compositionId, inputProps, outputLocation, cancelSignal, onProgress} = opts

  // Rebuild the bundle (same bundler the sandbox dev-fallback uses), then point
  // the local renderer at the absolute bundle directory.
  await bundleRemotionProject(bundleDir)
  const serveUrl = resolve(process.cwd(), bundleDir)

  await ensureBrowser()

  const composition = await selectComposition({serveUrl, id: compositionId, inputProps})

  await renderMedia({
    serveUrl,
    composition,
    codec: 'h264',
    outputLocation,
    inputProps,
    cancelSignal,
    onProgress: ({renderedFrames, encodedFrames}) =>
      onProgress?.({renderedFrames, encodedFrames}),
  })
}
