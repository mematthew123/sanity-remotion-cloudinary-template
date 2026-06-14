import {
  useClient,
  type DocumentActionComponent,
  type DocumentActionDescription,
  type DocumentActionProps,
  type SanityClient,
} from 'sanity'
// `useToast` is exported from @sanity/ui, not the `sanity` barrel.
import {useToast} from '@sanity/ui'
import type {ArticleVideoProps} from '@template/video-core/types'

// Author name + main-image URL live behind a reference/asset, so they aren't on
// the plain document snapshot — re-fetch them via GROQ (same shape the manual
// "Render Promo" action uses).
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
 * Fire a promo (1:1) render for a post. Mirrors the manual "Render Promo" POST,
 * but is invoked automatically right after publish. Throws on failure so the
 * caller can surface a non-blocking toast — it must never undo the publish.
 */
async function firePromoRender(
  client: SanityClient,
  postId: string,
): Promise<{idempotent?: boolean}> {
  const url =
    import.meta.env.SANITY_STUDIO_RENDER_API_URL || 'http://localhost:3000/api/video/render'
  const secret = import.meta.env.SANITY_STUDIO_RENDER_SECRET
  if (!secret) throw new Error('SANITY_STUDIO_RENDER_SECRET not set')

  // Prefer the just-published id; fall back to the draft if the publish write
  // hasn't propagated yet (the render route also tolerates either id).
  let resolved = await client.fetch<ResolvedPostFields | null>(POST_FIELDS_QUERY, {id: postId})
  if (!resolved) {
    resolved = await client.fetch<ResolvedPostFields | null>(POST_FIELDS_QUERY, {
      id: `drafts.${postId}`,
    })
  }

  const inputProps: ArticleVideoProps = {
    title: resolved?.title ?? 'Untitled',
    authorName: resolved?.authorName ?? 'Unknown',
    publishedAt: resolved?.publishedAt ?? new Date().toISOString(),
    excerpt: resolved?.excerpt ?? '',
    mainImageUrl: resolved?.mainImageUrl || undefined,
  }

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
        const snapshot = (props.draft ?? props.published) as
          | {autoGenerateVideoOnPublish?: boolean}
          | null
        const autoGenerate = Boolean(snapshot?.autoGenerateVideoOnPublish)

        // Run the real publish first — never gate it on the render.
        original.onHandle?.()

        if (!autoGenerate) return

        const postId = (props.id || '').replace(/^drafts\./, '')
        toast.push({
          status: 'info',
          title: 'Published — generating promo video in the background…',
        })
        // Fire-and-forget: don't await, and swallow errors into a soft toast so
        // a render hiccup can't disrupt the publish it rode in on.
        firePromoRender(client, postId)
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
