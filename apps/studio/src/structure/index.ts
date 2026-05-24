import type {StructureBuilder} from 'sanity/structure'
import {DocumentTextIcon, UserIcon, PlayIcon} from '@sanity/icons'

export const structure = (S: StructureBuilder) =>
  S.list()
    .title('Video Template Studio')
    .items([
      S.documentTypeListItem('post').title('Posts').icon(DocumentTextIcon),
      S.documentTypeListItem('author').title('Authors').icon(UserIcon),
      S.divider(),
      S.documentTypeListItem('video').title('Videos').icon(PlayIcon),
    ])
