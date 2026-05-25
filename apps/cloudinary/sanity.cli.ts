import {defineCliConfig} from 'sanity/cli'

// App SDK apps are tied to a Sanity *organization*, not a single project.
// Provide SANITY_APP_ORGANIZATION_ID via .env — see .env.example.
export default defineCliConfig({
  app: {
    organizationId: process.env.SANITY_APP_ORGANIZATION_ID,
    entry: './src/App.tsx',
  },
  // Pinned after the first `sanity deploy` so subsequent deploys are
  // non-interactive (no application-title prompt). Forking into a different
  // org? Run `npx sanity deploy` once to create your own app, then replace this.
  deployment: {
    appId: 'qolkvl8oyf6vhb1co4fptavq',
  },
})
