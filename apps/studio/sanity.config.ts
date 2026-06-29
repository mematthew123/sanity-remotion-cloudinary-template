import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {presentationTool, defineLocations} from 'sanity/presentation'
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

// The `article-narrated` composition needs ElevenLabs (a paid third party) set
// up on the web app before it can render. It's off by default so a first-run
// Studio never surfaces a voiceover/narrated action that would fail — flip
// SANITY_STUDIO_ENABLE_NARRATED=true once ElevenLabs env is configured.
const narratedEnabled = import.meta.env.SANITY_STUDIO_ENABLE_NARRATED === 'true'

export default defineConfig({
  name: 'default',
  title: 'Video Template Studio',
  basePath: '/',

  projectId: import.meta.env.SANITY_STUDIO_PROJECT_ID,
  dataset: import.meta.env.SANITY_STUDIO_DATASET,

  plugins: [
    structureTool({structure, defaultDocumentNode: getDefaultDocumentNode}),
    // Live click-to-edit preview of the Next.js site (needs SANITY_API_READ_TOKEN on the web app).
    presentationTool({
      previewUrl: {
        origin: import.meta.env.SANITY_STUDIO_PREVIEW_URL ?? 'http://localhost:3000',
        previewMode: {enable: '/api/draft-mode/enable'},
      },
      resolve: {
        // Map a `post` to the site URLs where it appears.
        locations: {
          post: defineLocations({
            select: {title: 'title', slug: 'slug.current'},
            resolve: (doc) => ({
              locations: [
                {title: doc?.title || 'Untitled', href: `/posts/${doc?.slug}`},
                {title: 'Home', href: '/'},
              ],
            }),
          }),
        },
      },
    }),
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
            // GenerateVoiceover + RenderArticleNarrated depend on ElevenLabs;
            // only surface them when the narrated feature is enabled.
            ...(narratedEnabled ? [GenerateVoiceover] : []),
            RenderArticlePromo,
            RenderArticleTeaser,
            ...(narratedEnabled ? [RenderArticleNarrated] : []),
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
