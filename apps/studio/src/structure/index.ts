import type {DefaultDocumentNodeResolver, StructureBuilder} from 'sanity/structure'
import {
  DocumentTextIcon,
  EnvelopeIcon,
  ImagesIcon,
  PlayIcon,
  SparklesIcon,
  UserIcon,
} from '@sanity/icons'
import {VariantViewer} from '../components/VariantViewer'

export const structure = (S: StructureBuilder) =>
  S.list()
    .title('Video Template Studio')
    .items([
      S.documentTypeListItem('post').title('Posts').icon(DocumentTextIcon),
      S.documentTypeListItem('author').title('Authors').icon(UserIcon),
      S.divider(),
      S.documentTypeListItem('video').title('Videos').icon(PlayIcon),
      S.documentTypeListItem('newsletter').title('Newsletters').icon(EnvelopeIcon),
      S.divider(),
      // Brand-voice Agent Context docs (@sanity/agent-context). Surfaced so
      // editors can read/tune the voices that AI Assist actions follow. Each
      // voice is seeded from a markdown file in `apps/studio/voices/`.
      S.documentTypeListItem('sanity.agentContext').title('Brand Voices').icon(SparklesIcon),
    ])

// Add a "Variants" view to the `video` document type: a Cloudinary variant
// gallery + live transform preview (see ../components/VariantViewer). Every
// other type keeps just the default form view.
export const getDefaultDocumentNode: DefaultDocumentNodeResolver = (S, {schemaType}) =>
  schemaType === 'video'
    ? S.document().views([
        S.view.form(),
        S.view.component(VariantViewer).id('variants').title('Variants').icon(ImagesIcon),
      ])
    : S.document().views([S.view.form()])
