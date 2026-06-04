import 'dotenv/config'
import {defineCliConfig} from 'sanity/cli'

// projectId and dataset come from .env so the template doesn't ship a real id.
// Both must be set before `pnpm --filter @template/blueprints deploy`.
export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET ?? 'production',
  },
})
