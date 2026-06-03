import {defineConfig, useClient, pathToString, type SanityClient} from 'sanity'
import {useEffect, useMemo, useState} from 'react'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {agentContextPlugin} from '@sanity/agent-context/studio'
import {assist, defineAssistFieldAction} from '@sanity/assist'
import {schemaTypes} from './src/schemaTypes'
import {getDefaultDocumentNode, structure} from './src/structure'
import {RenderArticlePromo, RenderArticleTeaser} from './src/actions/renderVideo'

// Default brand-voice Agent Context document id. The AI Assist menu exposes
// one action per voice doc found in the dataset; this id is the fallback
// used to highlight the "preferred" voice when `post.voice` is unset.
// All voice docs are seeded from `voices/*.md` by `scripts/seed-agent-context.ts`.
const DEFAULT_VOICE_DOC_ID = 'brand-voice'

type VoiceDoc = {_id: string; name: string | null}

// Module-level cache so we don't re-query voices for every field render.
// Voices change rarely; a Studio reload picks up new voices.
let voicesCache: VoiceDoc[] | null = null
let voicesPromise: Promise<VoiceDoc[]> | null = null

function useVoices(client: SanityClient): VoiceDoc[] {
  const [voices, setVoices] = useState<VoiceDoc[]>(voicesCache ?? [])
  useEffect(() => {
    if (voicesCache) return
    if (!voicesPromise) {
      voicesPromise = client
        .fetch<VoiceDoc[]>(
          `*[_type == "sanity.agentContext"] | order(name asc, _id asc){_id, name}`,
        )
        .catch(() => [] as VoiceDoc[])
    }
    let cancelled = false
    voicesPromise.then((res) => {
      voicesCache = res
      if (!cancelled) setVoices(res)
    })
    return () => {
      cancelled = true
    }
  }, [client])
  return voices
}

function preferredVoiceId(getDocumentValue: () => unknown): string {
  const doc = getDocumentValue() as {voice?: {_ref?: string}} | undefined
  return doc?.voice?._ref || DEFAULT_VOICE_DOC_ID
}

function sortVoices(voices: VoiceDoc[], preferredId: string): VoiceDoc[] {
  return [...voices].sort((a, b) => {
    if (a._id === preferredId) return -1
    if (b._id === preferredId) return 1
    return (a.name ?? a._id).localeCompare(b.name ?? b._id)
  })
}

export default defineConfig({
  name: 'default',
  title: 'Video Template Studio',
  basePath: '/',

  projectId: import.meta.env.SANITY_STUDIO_PROJECT_ID,
  dataset: import.meta.env.SANITY_STUDIO_DATASET,

  plugins: [
    structureTool({structure, defaultDocumentNode: getDefaultDocumentNode}),
    visionTool(),
    agentContextPlugin(),
    assist({
      fieldActions: {
        title: 'Brand AI',
        useFieldActions: (props) => {
          const {
            actionType,
            schemaId,
            documentIdForAction,
            documentSchemaType,
            path,
            schemaType,
            getConditionalPaths,
            getDocumentValue,
          } = props
          // Agent Actions require the `vX` API version at this time.
          const client = useClient({apiVersion: 'vX'})
          // Read-only client for listing voices (no special API version needed).
          const voices = useVoices(useClient({apiVersion: '2024-01-01'}))

          return useMemo(() => {
            if (actionType !== 'field') return []

            const actions: ReturnType<typeof defineAssistFieldAction>[] = []

            // Text-like fields (string/text/blockContent) get a "Rewrite as <voice>" action per voice.
            const isTextLike =
              schemaType.jsonType === 'string' ||
              (schemaType.jsonType === 'array' && schemaType.name === 'blockContent')

            // Sort voices so the post's preferred voice (or the default
            // brand-voice) appears first in the menu — editors usually want it.
            const sortedVoices = sortVoices(voices, preferredVoiceId(getDocumentValue))
            const voiceLabel = (v: VoiceDoc) => v.name?.trim() || v._id

            if (isTextLike) {
              for (const v of sortedVoices) {
                actions.push(
                  defineAssistFieldAction({
                    title: `Rewrite as ${voiceLabel(v)}`,
                    onAction: async () => {
                      await client.agent.action.transform({
                        schemaId,
                        documentId: documentIdForAction,
                        instruction:
                          'Rewrite $field to follow the brand voice and tone rules in $voice. Preserve meaning; change tone only. Do not add or remove facts.',
                        instructionParams: {
                          field: {type: 'field', path},
                          voice: {type: 'document', documentId: v._id},
                        },
                        target: path.length ? {path} : undefined,
                        conditionalPaths: {paths: getConditionalPaths()},
                      })
                    },
                  }),
                )
              }
            }

            // The videoCopy object on `post` gets a "Generate video copy as <voice>" action per voice.
            if (documentSchemaType.name === 'post' && pathToString(path) === 'videoCopy') {
              for (const v of sortedVoices) {
                actions.push(
                  defineAssistFieldAction({
                    title: `Generate video copy as ${voiceLabel(v)}`,
                    onAction: async () => {
                      await client.agent.action.generate({
                        schemaId,
                        // createIfNotExists so this also works on a brand-new,
                        // unsaved post: it drafts the doc with the current form
                        // values first, which feed the $title/$excerpt/$body params.
                        targetDocument: {
                          operation: 'createIfNotExists',
                          _id: documentIdForAction,
                          _type: documentSchemaType.name,
                          initialValues: getDocumentValue(),
                        },
                        instruction: [
                          'Fill every slot of $field with short copy for a promo video about this article.',
                          'Follow the brand voice and tone rules in $voice EXACTLY.',
                          "Base the copy on the article's $title, $excerpt, and $body.",
                          '',
                          'Per-slot guidance:',
                          '- kicker: a short label, max 3 words.',
                          '- headline: punchy, max 8 words. It may differ from the article title.',
                          '- subhead: one supporting line, max 12 words.',
                          '- pullQuote: a short standout line drawn from the article, max 16 words.',
                          '- ctaPrimary: max 4 words (e.g. "Read more").',
                          '- ctaSecondary: optional, max 6 words.',
                          '',
                          'Output only the structured object — no commentary.',
                        ].join('\n'),
                        instructionParams: {
                          field: {type: 'field', path},
                          voice: {type: 'document', documentId: v._id},
                          title: {type: 'field', path: ['title']},
                          excerpt: {type: 'field', path: ['excerpt']},
                          body: {type: 'field', path: ['body']},
                        },
                        target: path.length ? {path} : undefined,
                        conditionalPaths: {paths: getConditionalPaths()},
                      })
                    },
                  }),
                )
              }
            }

            return actions
          }, [
            actionType,
            schemaId,
            documentIdForAction,
            documentSchemaType,
            path,
            schemaType,
            getConditionalPaths,
            getDocumentValue,
            client,
            voices,
          ])
        },
      },
    }),
  ],

  schema: {
    types: schemaTypes,
  },

  document: {
    // Surface the one-click "Render" actions on `post` documents only.
    actions: (prev, ctx) =>
      ctx.schemaType === 'post' ? [...prev, RenderArticlePromo, RenderArticleTeaser] : prev,
  },
})
