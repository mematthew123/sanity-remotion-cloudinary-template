import {defineConfig, useClient, pathToString} from 'sanity'
import {useMemo} from 'react'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {agentContextPlugin} from '@sanity/agent-context/studio'
import {assist, defineAssistFieldAction} from '@sanity/assist'
import {schemaTypes} from './src/schemaTypes'
import {getDefaultDocumentNode, structure} from './src/structure'
import {RenderArticlePromo, RenderArticleTeaser} from './src/actions/renderVideo'

// Default brand-voice Agent Context document id. A `post` may override this
// per-document via its `voice` reference field; everything else falls back
// to this id. All voice docs are seeded from `voices/*.md` by
// `scripts/seed-agent-context.ts`.
const DEFAULT_VOICE_DOC_ID = 'brand-voice'

function resolveVoiceDocId(getDocumentValue: () => unknown): string {
  const doc = getDocumentValue() as {voice?: {_ref?: string}} | undefined
  return doc?.voice?._ref || DEFAULT_VOICE_DOC_ID
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

          return useMemo(() => {
            if (actionType !== 'field') return []

            const actions: ReturnType<typeof defineAssistFieldAction>[] = []

            // "Rewrite in brand voice" — text-like fields (string/text/blockContent).
            const isTextLike =
              schemaType.jsonType === 'string' ||
              (schemaType.jsonType === 'array' && schemaType.name === 'blockContent')

            if (isTextLike) {
              actions.push(
                defineAssistFieldAction({
                  title: 'Rewrite in brand voice',
                  onAction: async () => {
                    await client.agent.action.transform({
                      schemaId,
                      documentId: documentIdForAction,
                      instruction:
                        'Rewrite $field to follow the brand voice and tone rules in $voice. Preserve meaning; change tone only. Do not add or remove facts.',
                      instructionParams: {
                        field: {type: 'field', path},
                        voice: {
                          type: 'document',
                          documentId: resolveVoiceDocId(getDocumentValue),
                        },
                      },
                      target: path.length ? {path} : undefined,
                      conditionalPaths: {paths: getConditionalPaths()},
                    })
                  },
                }),
              )
            }

            // "Generate video copy in brand voice" — the `videoCopy` object on `post`.
            if (documentSchemaType.name === 'post' && pathToString(path) === 'videoCopy') {
              actions.push(
                defineAssistFieldAction({
                  title: 'Generate video copy in brand voice',
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
                        voice: {
                          type: 'document',
                          documentId: resolveVoiceDocId(getDocumentValue),
                        },
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
