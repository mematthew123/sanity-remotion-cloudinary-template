import type {StructureBuilder} from 'sanity/structure'
import {DocumentTextIcon, UserIcon, PlayIcon, SparklesIcon} from '@sanity/icons'

export const structure = (S: StructureBuilder) =>
  S.list()
    .title('Video Template Studio')
    .items([
      S.documentTypeListItem('post').title('Posts').icon(DocumentTextIcon),
      S.documentTypeListItem('author').title('Authors').icon(UserIcon),
      S.divider(),
      S.documentTypeListItem('video').title('Videos').icon(PlayIcon),
      S.divider(),
      // The brand-voice Agent Context doc (@sanity/agent-context). Surfaced so
      // editors can read/tune the voice that AI Assist actions follow.
      S.documentTypeListItem('sanity.agentContext').title('Brand Voice').icon(SparklesIcon),
    ])
