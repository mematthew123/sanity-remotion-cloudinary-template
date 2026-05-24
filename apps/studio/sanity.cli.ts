import {defineCliConfig} from 'sanity/cli'

// The CLI runs in Node, so it reads `process.env` (not `import.meta.env`).
// Provide SANITY_STUDIO_PROJECT_ID / SANITY_STUDIO_DATASET via .env — see .env.example.
export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET,
  },
  deployment: {
    autoUpdates: false,
  },
})
