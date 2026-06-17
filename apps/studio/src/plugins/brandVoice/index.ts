import {definePlugin, useClient, pathToString} from 'sanity'
import {useMemo} from 'react'
import {agentContextPlugin} from '@sanity/agent-context/studio'
import {assist, defineAssistFieldAction} from '@sanity/assist'
import {preferredVoiceId, sortVoices, useVoices, type VoiceDoc} from './voices'

// Brand-voice AI feature, bundled as one plugin so the root sanity.config.ts
// stays focused on the video-render wiring. Composes two upstream plugins:
//   - agentContextPlugin(): registers the `sanity.agentContext` doc type +
//     the "Brand Voices" list where voices are authored/edited.
//   - assist(): adds a per-voice "Brand AI" field-action menu.
//
// Voices are data-driven: each `sanity.agentContext` doc (seeded from
// voices/*.md by scripts/seed-agent-context.ts) yields its own menu actions —
// "Rewrite as <voice>" on text-like fields, and "Generate video copy as
// <voice>" on `post.videoCopy`. The post's preferred `voice` reference (or the
// default brand-voice) is sorted to the top of the menu.
export const brandVoicePlugin = definePlugin({
  name: 'brand-voice',
  plugins: [
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
})
