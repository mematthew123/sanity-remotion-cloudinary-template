import {execSync} from 'node:child_process'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {ensureBrowser, selectComposition, renderMedia} from '@remotion/renderer'

// Bundle the Remotion entry into `bundleDir` (relative to `apps/web`). Used at
// build time for the snapshot and as the local-dev fallback inside the render
// route (when VERCEL=undefined). In production, the bundle ships inside the
// snapshot — this function isn't called on the hot path.
//
// Uses `pnpm exec` rather than the per-package `node_modules/.bin/remotion`
// shim because this repo's `.npmrc` sets `node-linker=hoisted` — the binary
// only exists at the workspace-root `node_modules/.bin/`, not inside
// `apps/web/`. `pnpm exec` walks up to find it.
export function bundleRemotionProject(bundleDir: string): void {
  try {
    execSync(`pnpm exec remotion bundle remotion/index.ts --out-dir ./${bundleDir}`, {
      cwd: process.cwd(),
      stdio: 'inherit',
    })
  } catch (e) {
    const stderr = (e as {stderr?: Buffer}).stderr?.toString() ?? ''
    throw new Error(`Remotion bundle failed: ${stderr || (e as Error).message}`)
  }
}

// Local render fallback: render the composition with headless Chromium on this
// machine — no Vercel Sandbox, no Blob store. This is what makes the template
// runnable with only Sanity + Cloudinary configured (see the LOCAL_RENDER /
// no-BLOB_READ_WRITE_TOKEN branch in route.ts). Returns the path to an MP4 in
// the OS temp dir; the caller uploads it straight to Cloudinary and unlinks it.
//
// Chromium is downloaded automatically by `ensureBrowser()` on first run
// (~1 min, one-time). Concurrency is left to Remotion's auto-detect so it uses
// all available cores locally.
export async function renderLocally(opts: {
  bundleDir: string
  compositionId: string
  inputProps: Record<string, unknown>
  onProgress?: (p: {renderedFrames: number; encodedFrames: number}) => void
}): Promise<{filePath: string; contentType: string}> {
  const {bundleDir, compositionId, inputProps, onProgress} = opts

  // Rebuild the bundle (same bundler the sandbox dev-fallback uses), then point
  // the local renderer at the absolute bundle directory.
  bundleRemotionProject(bundleDir)
  const serveUrl = resolve(process.cwd(), bundleDir)

  await ensureBrowser()

  const composition = await selectComposition({serveUrl, id: compositionId, inputProps})

  const outputLocation = join(tmpdir(), `${compositionId}-${Date.now()}.mp4`)

  await renderMedia({
    serveUrl,
    composition,
    codec: 'h264',
    outputLocation,
    inputProps,
    onProgress: ({renderedFrames, encodedFrames}) =>
      onProgress?.({renderedFrames, encodedFrames}),
  })

  return {filePath: outputLocation, contentType: 'video/mp4'}
}
