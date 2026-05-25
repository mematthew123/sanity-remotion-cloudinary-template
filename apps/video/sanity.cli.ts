import {defineCliConfig} from 'sanity/cli'

// The App SDK CLI bundles `process.env.SANITY_APP_*` values at build time
// (Vite-style define). `organizationId` ties the deployed app to your Sanity
// organization — set SANITY_APP_ORGANIZATION_ID in the environment. No
// hardcoded fallback: a missing org id should fail loudly at deploy time.
export default defineCliConfig({
  app: {
    organizationId: process.env.SANITY_APP_ORGANIZATION_ID,
    entry: './src/App.tsx',
  },
  // Pinned after the first `sanity deploy` so subsequent deploys are
  // non-interactive (no application-title prompt). Forking into a different
  // org? Run `npx sanity deploy` once to create your own app, then replace this.
  deployment: {
    appId: 'jdcdylufqj6hz4tioozzf3il',
  },
})
