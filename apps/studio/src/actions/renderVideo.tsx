import {useState} from 'react'
import {
  useClient,
  type DocumentActionComponent,
  type DocumentActionDescription,
  type DocumentActionProps,
} from 'sanity'
// `useToast` lives in @sanity/ui (it is NOT re-exported from the `sanity`
// barrel in v5), so import it from there directly.
import {useToast} from '@sanity/ui'
import {PlayIcon} from '@sanity/icons'
import type {CompositionId} from '@template/video-core/registry'
import type {ArticleVideoProps} from '@template/video-core/types'

// Fields the render route needs that may not be on the draft/published snapshot
// (the author name and image URL live behind references/assets).
type ResolvedPostFields = {
  title?: string
  excerpt?: string
  publishedAt?: string
  authorName?: string
  mainImageUrl?: string
}

const POST_FIELDS_QUERY = `*[_id == $id][0]{
  title,
  excerpt,
  publishedAt,
  "authorName": author->name,
  "mainImageUrl": mainImage.asset->url
}`

/**
 * Builds a "Render" document action for a single Remotion composition. The
 * action snapshots the current post, assembles `ArticleVideoProps`, and POSTs
 * to the web app's render route — the one-click showcase of the template.
 */
function makeRenderAction(
  compositionId: CompositionId,
  label: string,
): DocumentActionComponent {
  function RenderAction(props: DocumentActionProps): DocumentActionDescription {
    const [isRendering, setIsRendering] = useState(false)
    const client = useClient({apiVersion: '2024-12-27'})
    const toast = useToast()

    const onHandle = async () => {
      const publishedId = (props.id || '').replace(/^drafts\./, '')
      // We only need to know a snapshot EXISTS (i.e. the post has been saved);
      // every field used below is re-fetched via GROQ, so an untyped record is
      // enough here.
      const snapshot = props.draft ?? props.published

      if (!snapshot) {
        toast.push({status: 'warning', title: 'Save the post first'})
        props.onComplete()
        return
      }

      try {
        // Resolve the reference/asset-derived fields the snapshot lacks. Try the
        // published id first, then fall back to the draft.
        let resolved = await client.fetch<ResolvedPostFields | null>(POST_FIELDS_QUERY, {
          id: publishedId,
        })
        if (!resolved) {
          resolved = await client.fetch<ResolvedPostFields | null>(POST_FIELDS_QUERY, {
            id: `drafts.${publishedId}`,
          })
        }

        const inputProps: ArticleVideoProps = {
          title: resolved?.title ?? 'Untitled',
          authorName: resolved?.authorName ?? 'Unknown',
          publishedAt: resolved?.publishedAt ?? new Date().toISOString(),
          excerpt: resolved?.excerpt ?? '',
          mainImageUrl: resolved?.mainImageUrl || undefined,
        }

        const url =
          import.meta.env.SANITY_STUDIO_RENDER_API_URL || 'http://localhost:3000/api/video/render'
        const secret = import.meta.env.SANITY_STUDIO_RENDER_SECRET

        if (!secret) {
          toast.push({status: 'error', title: 'SANITY_STUDIO_RENDER_SECRET not set'})
          props.onComplete()
          return
        }

        setIsRendering(true)
        toast.push({
          status: 'info',
          title: `Rendering ${label}… this can take a minute.`,
        })

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify({compositionId, inputProps, postId: publishedId}),
        })

        const data: Record<string, unknown> = await res
          .json()
          .catch(() => ({}) as Record<string, unknown>)

        if (res.ok) {
          toast.push({
            status: 'success',
            title: data.idempotent ? 'Video already exists' : 'Video ready — see the Videos list',
          })
        } else {
          const errorDescription =
            typeof data.error === 'string' ? data.error : res.statusText
          toast.push({
            status: 'error',
            title: 'Render failed',
            description: errorDescription,
          })
        }
      } catch (err) {
        toast.push({
          status: 'error',
          title: 'Render request failed',
          description: err instanceof Error ? err.message : 'Network error',
        })
      } finally {
        setIsRendering(false)
        props.onComplete()
      }
    }

    return {
      label: `Render ${label}`,
      icon: PlayIcon,
      disabled: isRendering,
      onHandle,
    }
  }

  // Helps Studio dev-tooling / React devtools identify the action.
  RenderAction.displayName = `Render_${compositionId}`

  return RenderAction
}

export const RenderArticlePromo = makeRenderAction('article-promo', 'Promo (1:1)')
export const RenderArticleTeaser = makeRenderAction('article-teaser', 'Teaser (9:16)')
