import {
  useClient,
  type DocumentActionComponent,
  type DocumentActionDescription,
  type DocumentActionProps,
} from 'sanity'
// `useToast` is exported from @sanity/ui, not the `sanity` barrel.
import {useToast} from '@sanity/ui'
import type {ArticleVideoProps} from '@template/video-core/types'

// The plain document snapshot carries the editable fields directly; only the
// author name and main-image URL live behind a reference/asset and need a deref.
type DerivedFields = {
  authorName?: string
  mainImageUrl?: string
}

type PostSnapshot = {
  title?: string
  excerpt?: string
  publishedAt?: string
  autoGenerateVideoOnPublish?: boolean
}

const DERIVED_QUERY = `*[_id == $id][0]{
  "authorName": author->name,
  "mainImageUrl": mainImage.asset->url
}`

/**
 * Fire a promo (1:1) render for a post. Mirrors the manual "Render Promo" POST,
 * but is invoked automatically right after publish. Throws on failure so the
 * caller can surface a non-blocking toast — it must never undo the publish.
 */
async function firePromoRender(
  postId: string,
  inputProps: ArticleVideoProps,
): Promise<{idempotent?: boolean}> {
  const url =
    import.meta.env.SANITY_STUDIO_RENDER_API_URL || 'http://localhost:3000/api/video/render'
  const secret = import.meta.env.SANITY_STUDIO_RENDER_SECRET
  if (!secret) throw new Error('SANITY_STUDIO_RENDER_SECRET not set')

  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${secret}`},
    body: JSON.stringify({compositionId: 'article-promo', inputProps, postId}),
  })
  const data = (await res.json().catch(() => ({}))) as {error?: string; idempotent?: boolean}
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : res.statusText)
  return {idempotent: data.idempotent}
}

/**
 * Wraps the Studio's built-in Publish action for `post` documents. After the
 * normal publish runs, if the post has `autoGenerateVideoOnPublish` enabled, it
 * fires a one-off promo render in the background. The render route is idempotent
 * (an existing ready/in-flight video for this post+template short-circuits), so
 * re-publishing won't double-render. Render failures are surfaced as a warning
 * toast only — they never block or undo the publish that triggered them.
 */
export function withAutoPromoOnPublish(
  originalPublishAction: DocumentActionComponent,
): DocumentActionComponent {
  function PublishWithAutoPromo(props: DocumentActionProps): DocumentActionDescription | null {
    const original = originalPublishAction(props)
    const client = useClient({apiVersion: '2024-12-27'})
    const toast = useToast()

    if (!original) return original

    return {
      ...original,
      onHandle: () => {
        const snapshot = (props.draft ?? props.published) as PostSnapshot | null

        if (!snapshot?.autoGenerateVideoOnPublish) {
          original.onHandle?.()
          return
        }

        const postId = (props.id || '').replace(/^drafts\./, '')

        // Resolve the reference/asset-derived fields BEFORE publishing — once
        // the publish lands, the draft is gone and the published doc may not be
        // queryable yet (the race that previously left the video "Untitled").
        // title/excerpt/publishedAt come straight off the snapshot, so they're
        // never lost regardless of timing.
        const derivedPromise: Promise<DerivedFields | null> = client
          .fetch<DerivedFields | null>(DERIVED_QUERY, {id: `drafts.${postId}`})
          .then((d) => d ?? client.fetch<DerivedFields | null>(DERIVED_QUERY, {id: postId}))
          .catch(() => null)

        // Publish immediately — never make the editor wait on the render path.
        original.onHandle?.()

        toast.push({
          status: 'info',
          title: 'Published — generating promo video in the background…',
        })

        // Fire-and-forget: don't await, and swallow errors into a soft toast so
        // a render hiccup can't disrupt the publish it rode in on.
        derivedPromise
          .then((derived) =>
            firePromoRender(postId, {
              title: snapshot.title ?? 'Untitled',
              authorName: derived?.authorName ?? 'Unknown',
              publishedAt: snapshot.publishedAt ?? new Date().toISOString(),
              excerpt: snapshot.excerpt ?? '',
              mainImageUrl: derived?.mainImageUrl || undefined,
            }),
          )
          .then((r) =>
            toast.push({
              status: 'success',
              title: r.idempotent
                ? 'Promo video already existed'
                : 'Promo video ready — see the Videos list',
            }),
          )
          .catch((err) =>
            toast.push({
              status: 'warning',
              title: 'Auto-promo render skipped',
              description: err instanceof Error ? err.message : 'Render request failed',
            }),
          )
      },
    }
  }

  PublishWithAutoPromo.displayName = 'PublishWithAutoPromo'
  return PublishWithAutoPromo
}
