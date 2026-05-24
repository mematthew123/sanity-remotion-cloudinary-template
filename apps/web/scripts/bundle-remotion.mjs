import {bundle} from '@remotion/bundler'
import {enableTailwind} from '@remotion/tailwind-v4'
import path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const entry = path.resolve(__dirname, '../remotion/index.ts')
// Output OUTSIDE public/ to avoid recursive copy
// (Remotion's bundler copies public/ into the bundle)
const outDir = path.resolve(__dirname, '../.remotion-bundle')

console.log('Bundling Remotion compositions...')
console.log('Entry:', entry)
console.log('Output:', outDir)

const bundleLocation = await bundle({
  entryPoint: entry,
  outDir,
  // Use an empty dir as public to avoid copying Next.js public assets
  publicDir: path.resolve(__dirname, '../remotion/public'),
  // Match remotion.config.ts so SSR renders pick up Tailwind classes too.
  webpackOverride: (config) => enableTailwind(config),
})

console.log('Remotion bundle created at:', bundleLocation)
