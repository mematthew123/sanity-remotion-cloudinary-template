import {defineCliConfig} from 'sanity/cli'

// App SDK apps are tied to a Sanity *organization*, not a single project.
// Provide SANITY_APP_ORGANIZATION_ID via .env — see .env.example.
export default defineCliConfig({
  app: {
    organizationId: process.env.SANITY_APP_ORGANIZATION_ID,
    entry: './src/App.tsx',
  },
})
