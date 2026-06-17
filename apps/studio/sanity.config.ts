import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './src/schemaTypes'
import {getDefaultDocumentNode, structure} from './src/structure'
import {
  GenerateVoiceover,
  RenderArticleNarrated,
  RenderArticlePromo,
  RenderArticleTeaser,
} from './src/actions/renderVideo'
import {withAutoPromoOnPublish} from './src/actions/autoPromoOnPublish'
import {newsletterPlugin} from './src/plugins/newsletter'
import {brandVoicePlugin} from './src/plugins/brandVoice'

export default defineConfig({
  name: 'default',
  title: 'Video Template Studio',
  basePath: '/',

  projectId: import.meta.env.SANITY_STUDIO_PROJECT_ID,
  dataset: import.meta.env.SANITY_STUDIO_DATASET,

  plugins: [
    structureTool({structure, defaultDocumentNode: getDefaultDocumentNode}),
    visionTool(),
    newsletterPlugin(),
    // Brand-voice AI menu (Agent Context + Assist field actions). Extracted to
    // src/plugins/brandVoice so this config stays focused on render wiring.
    brandVoicePlugin(),
  ],

  schema: {
    types: schemaTypes,
  },

  document: {
    // On `post` docs: wrap the built-in Publish action so it can auto-fire a
    // promo render (gated by the post's `autoGenerateVideoOnPublish` toggle),
    // and surface the one-click "Render" actions.
    actions: (prev, ctx) =>
      ctx.schemaType === 'post'
        ? [
            ...prev.map((action) =>
              action.action === 'publish' ? withAutoPromoOnPublish(action) : action,
            ),
            GenerateVoiceover,
            RenderArticlePromo,
            RenderArticleTeaser,
            RenderArticleNarrated,
          ]
        : prev,
    // welcomeEmail is a singleton — reachable only via its fixed structure item,
    // never created ad hoc. Drop it from the global "create new document" menu.
    newDocumentOptions: (prev, {creationContext}) =>
      creationContext.type === 'global'
        ? prev.filter((template) => template.templateId !== 'welcomeEmail')
        : prev,
  },
})
