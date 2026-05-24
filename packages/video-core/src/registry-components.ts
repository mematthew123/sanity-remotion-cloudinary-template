import type React from 'react'
import {ArticlePromo} from './compositions/ArticlePromo'
import {ArticleTeaser} from './compositions/ArticleTeaser'
import type {CompositionId} from './registry'

// Kept separate from `registry.ts` so consumers that only need metadata (the
// Sanity schema layer and the server render route) don't pull React/Remotion
// into their bundle.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const COMPOSITION_COMPONENTS: Record<CompositionId, React.FC<any>> = {
  'article-promo': ArticlePromo,
  'article-teaser': ArticleTeaser,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getComponent(id: CompositionId): React.FC<any> {
  const component = COMPOSITION_COMPONENTS[id]
  if (!component) throw new Error(`No component registered for composition: ${id}`)
  return component
}
