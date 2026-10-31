import 'dotenv/config'
import {
  defineBlueprint,
  defineContextKnowledgeBase,
  defineContextMcpEndpoint,
} from '@sanity/blueprints'

const {CONTEXT_PROJECT_ID, CONTEXT_DATASET = 'production', SITE_URL = 'http://localhost:3000'} =
  process.env

if (!CONTEXT_PROJECT_ID) {
  throw new Error('Set CONTEXT_PROJECT_ID in apps/blueprint/.env (see .env.example).')
}

const siteKnowledge = defineContextKnowledgeBase({
  name: 'site-knowledge',
  title: 'Site knowledge',
  description:
    'Serves readers and agents asking about what this site publishes: the articles, the topics they cover, and the videos rendered from them. Also explains how the render-once, fan-out pipeline works.',
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
        'Link articles as `' + SITE_URL + '/posts/<slug>` when an entry names one.',
        'If the Knowledge Base does not cover the question, say so instead of guessing.',
      ].join('\n'),
    }),
  ],
})
