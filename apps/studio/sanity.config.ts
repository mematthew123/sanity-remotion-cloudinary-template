import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './src/schemaTypes'
import {structure} from './src/structure'
import {RenderArticlePromo, RenderArticleTeaser} from './src/actions/renderVideo'

export default defineConfig({
  name: 'default',
  title: 'Video Template Studio',
  basePath: '/',

  projectId: import.meta.env.SANITY_STUDIO_PROJECT_ID,
  dataset: import.meta.env.SANITY_STUDIO_DATASET,

  plugins: [structureTool({structure}), visionTool()],

  schema: {
    types: schemaTypes,
  },

  document: {
    // Surface the one-click "Render" actions on `post` documents only.
    actions: (prev, ctx) =>
      ctx.schemaType === 'post' ? [...prev, RenderArticlePromo, RenderArticleTeaser] : prev,
  },
})
