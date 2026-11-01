import 'dotenv/config'
import {
  defineBlueprint,
  defineContextKnowledgeBase,
  defineContextMcpEndpoint,
} from '@sanity/blueprints'
import {citationName, docPaths} from './docs.mjs'

const {
  CONTEXT_PROJECT_ID,
  CONTEXT_DATASET = 'production',
  SITE_URL = 'http://localhost:3000',
  DOCS_BASE_URL = 'https://github.com/mematthew123/sanity-remotion-cloudinary-template/blob/main',
} = process.env

if (!CONTEXT_PROJECT_ID) {
  throw new Error('Set CONTEXT_PROJECT_ID in apps/blueprint/.env (see .env.example).')
}

const siteKnowledge = defineContextKnowledgeBase({
  name: 'site-knowledge',
  title: 'Site knowledge',
  description:
    'Serves two audiences: readers asking about what this site publishes (the articles, the topics they cover, and the videos rendered from them), and developers evaluating or setting up the Sanity + Remotion + Cloudinary template behind it (how the render-once, fan-out pipeline works, how to configure and deploy it, what it costs, and how to fix common problems).',
})

export default defineBlueprint({
  resources: [
    siteKnowledge,
    defineContextMcpEndpoint({
      name: 'video-catalog',
      title: 'Video catalog',
      sources: [{type: 'dataset', id: `${CONTEXT_PROJECT_ID}.${CONTEXT_DATASET}`}],
      groqFilter: '_type in ["post", "author"] || (_type == "video" && status == "ready")',
      instructions: [
        'You answer questions about the articles on this site and the videos rendered from them.',
        'Articles are `post` documents; a post is read at `' + SITE_URL + '/posts/<slug.current>`.',
        'Videos are `video` documents that reference their article through `post._ref`. Find a post\'s videos with `*[_type == "video" && post._ref == $postId]`.',
        'Every video has one canonical MP4 in `cloudinaryUrl` and a list of ready-made derivations in `variants[]` (`variantId`, `surface`, `format`, `url`, `width`, `height`).',
        'Pick variants by `variantId`: `site-mp4` (web playback), `site-poster-jpg` (poster frame), `site-preview-gif` (email/inline preview), `og-image-jpg` (social share card), `youtube-1080p-mp4`, `podcast-mp3` (audio only). Not every video has every variant.',
        'Return the variant `url` exactly as stored. Never invent or rewrite URLs.',
      ].join('\n'),
    }),
    defineContextMcpEndpoint({
      name: 'site-assistant',
      title: 'Site assistant',
      sources: [siteKnowledge],
      instructions: [
        'Answer from the Knowledge Base only, and cite the entries you used.',
        'It covers the published articles and the template itself: architecture, setup, configuration, deployment, costs, and troubleshooting.',
        'Link articles as `' + SITE_URL + '/posts/<slug>` when an entry names one.',
        'Entries drawn from the template docs cite their source file by the names below. When an answer uses one, link the matching doc:',
        ...docPaths.map((path) => `- ${citationName(path)} → ${DOCS_BASE_URL}/${path}`),
        'If the Knowledge Base does not cover the question, say so instead of guessing.',
      ].join('\n'),
    }),
  ],
})
