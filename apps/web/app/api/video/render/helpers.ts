import {execSync} from 'node:child_process'

// Bundle the Remotion entry into `bundleDir` (relative to `apps/web`). Used at
// build time for the snapshot and as the local-dev fallback inside the render
// route (when VERCEL=undefined). In production, the bundle ships inside the
// snapshot — this function isn't called on the hot path.
export function bundleRemotionProject(bundleDir: string): void {
  try {
    execSync(`node_modules/.bin/remotion bundle remotion/index.ts --out-dir ./${bundleDir}`, {
      cwd: process.cwd(),
      stdio: 'inherit',
    })
  } catch (e) {
    const stderr = (e as {stderr?: Buffer}).stderr?.toString() ?? ''
    throw new Error(`Remotion bundle failed: ${stderr || (e as Error).message}`)
  }
}
