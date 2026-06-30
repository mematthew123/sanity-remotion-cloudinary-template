import {useState} from 'react'
import {
  type DocumentActionComponent,
  type DocumentActionDescription,
  type DocumentActionProps,
} from 'sanity'
// `useToast` is in @sanity/ui — not re-exported from the `sanity` barrel in v5.
import {useToast} from '@sanity/ui'
import {PlayIcon, SparklesIcon} from '@sanity/icons'
import {extractNarrationScenes, type CompositionId} from '@template/video-core/registry'
import type {ArticleVideoProps} from '@template/video-core/types'
import {useStudioClient, useStudioUserToken} from '../lib/useStudioClient'

// Shown when the editor's Sanity session exposes no token (e.g. cookie-based
// auth). The render routes still accept the server-side VIDEO_RENDER_SECRET for
// automation, but the interactive trigger relies on the editor's own token.
const NO_TOKEN_MESSAGE =
  'No Sanity session token available — sign in again, or use the server-side render secret for automation.'

// Fields the render route needs that the snapshot lacks (author name and image
// URL live behind references/assets).
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
 * Builds a "Render" document action for one Remotion composition: snapshots the
 * post, assembles `ArticleVideoProps`, and POSTs to the render route.
 */
function makeRenderAction(
  compositionId: CompositionId,
  label: string,
): DocumentActionComponent {
  function RenderAction(props: DocumentActionProps): DocumentActionDescription {
    const [isRendering, setIsRendering] = useState(false)
    const client = useStudioClient()
    const userToken = useStudioUserToken()
    const toast = useToast()

    const onHandle = async () => {
      const publishedId = (props.id || '').replace(/^drafts\./, '')
      // Only need to confirm a snapshot exists (post is saved); all fields are
      // re-fetched via GROQ below.
      const snapshot = props.draft ?? props.published

      if (!snapshot) {
        toast.push({status: 'warning', title: 'Save the post first'})
        return
      }

      try {
        // Resolve reference/asset fields the snapshot lacks; published id first,
        // then draft.
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

        if (!userToken) {
          toast.push({status: 'error', title: NO_TOKEN_MESSAGE})
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
            Authorization: `Bearer ${userToken}`,
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
      }
    }

    return {
      label: `Render ${label}`,
      icon: PlayIcon,
      disabled: isRendering,
      onHandle,
    }
  }

  RenderAction.displayName = `Render_${compositionId}`

  return RenderAction
}

export const RenderArticlePromo = makeRenderAction('article-promo', 'Promo (1:1)')
export const RenderArticleTeaser = makeRenderAction('article-teaser', 'Teaser (9:16)')

// =============================================================================
// Narrated reading — separate action: props diverge from ArticleVideoProps. It
// reads `post.voiceoverChunks` (from the generate-voiceover step) instead of
// `post.videoCopy` and passes the chunks straight to the composition.
// =============================================================================

const NARRATED_FIELDS_QUERY = `*[_id == $id][0]{
  title,
  publishedAt,
  "authorName": author->name,
  "mainImageUrl": mainImage.asset->url,
  "kicker": videoCopy.kicker,
  voiceoverChunks,
  // Body in order with image URLs inlined so extractNarrationScenes() can pull
  // chapters (H2/H3) + b-roll without a second deref.
  "body": body[]{
    ...,
    "imageUrl": asset->url
  }
}`

type NarratedFields = {
  title?: string
  publishedAt?: string
  authorName?: string
  mainImageUrl?: string
  kicker?: string
  voiceoverChunks?: Array<{id: string; text: string; audioUrl: string; durationSeconds: number}>
  body?: unknown[]
}

function RenderArticleNarratedAction(props: DocumentActionProps): DocumentActionDescription {
  const [isRendering, setIsRendering] = useState(false)
  const client = useStudioClient()
  const userToken = useStudioUserToken()
  const toast = useToast()

  const onHandle = async () => {
    const publishedId = (props.id || '').replace(/^drafts\./, '')
    const snapshot = props.draft ?? props.published
    if (!snapshot) {
      toast.push({status: 'warning', title: 'Save the post first'})
      return
    }

    try {
      let resolved = await client.fetch<NarratedFields | null>(NARRATED_FIELDS_QUERY, {
        id: publishedId,
      })
      if (!resolved) {
        resolved = await client.fetch<NarratedFields | null>(NARRATED_FIELDS_QUERY, {
          id: `drafts.${publishedId}`,
        })
      }

      const chunks = resolved?.voiceoverChunks ?? []
      if (chunks.length === 0) {
        toast.push({
          status: 'warning',
          title: 'No voiceover yet',
          description:
            'Run: pnpm --filter @template/web generate-voiceover -- --post-id=' + publishedId,
        })
        return
      }

      // Every chunk needs a non-zero duration so calculateMetadata sums right;
      // bail loud rather than render an empty video.
      const totalSeconds = chunks.reduce((sum, c) => sum + (c.durationSeconds ?? 0), 0)
      if (totalSeconds <= 0) {
        toast.push({
          status: 'error',
          title: 'Voiceover chunks have no duration',
          description: 'Re-run generate-voiceover — Cloudinary may not have reported durations.',
        })
        return
      }

      // Chapter cards (H2/H3) + b-roll, in lockstep with the chunks (same body
      // order).
      const {chapters, images} = extractNarrationScenes(resolved?.body)

      const inputProps = {
        title: resolved?.title ?? 'Untitled',
        authorName: resolved?.authorName ?? 'Unknown',
        publishedAt: resolved?.publishedAt ?? new Date().toISOString(),
        mainImageUrl: resolved?.mainImageUrl || undefined,
        kicker: resolved?.kicker || undefined,
        chapters,
        images,
        chunks,
      }

      const url =
        import.meta.env.SANITY_STUDIO_RENDER_API_URL || 'http://localhost:3000/api/video/render'

      if (!userToken) {
        toast.push({status: 'error', title: NO_TOKEN_MESSAGE})
        return
      }

      setIsRendering(true)
      const minutes = Math.round(totalSeconds / 60)
      toast.push({
        status: 'info',
        title: `Rendering ${minutes}-min narrated reading… this may take several minutes.`,
      })

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          compositionId: 'article-narrated',
          inputProps,
          postId: publishedId,
        }),
      })

      const data: Record<string, unknown> = await res
        .json()
        .catch(() => ({}) as Record<string, unknown>)

      if (res.ok) {
        toast.push({
          status: 'success',
          title: data.idempotent
            ? 'Narrated reading already rendered'
            : 'Narrated reading ready — see the Videos list',
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
    }
  }

  return {
    label: 'Render narrated reading',
    icon: PlayIcon,
    disabled: isRendering,
    onHandle,
  }
}

RenderArticleNarratedAction.displayName = 'Render_article_narrated'

export const RenderArticleNarrated: DocumentActionComponent = RenderArticleNarratedAction

// =============================================================================
// Generate voiceover — Studio trigger for the same TTS pipeline the CLI runs,
// so editors can refresh narration. Re-runs hit the Cloudinary cache; only
// changed paragraphs re-bill ElevenLabs.
// =============================================================================

function GenerateVoiceoverAction(props: DocumentActionProps): DocumentActionDescription {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [dryRunInfo, setDryRunInfo] = useState<{
    chunks: number
    chars: number
    estCostUsd: number
  } | null>(null)

  const baseId = (props.id || '').replace(/^drafts\./, '')
  const apiUrl =
    import.meta.env.SANITY_STUDIO_RENDER_API_URL?.replace(/\/api\/video\/render$/, '') ||
    'http://localhost:3000'
  const userToken = useStudioUserToken()

  const fetchPreview = async (): Promise<void> => {
    if (!userToken) {
      toast.push({status: 'error', title: NO_TOKEN_MESSAGE})
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/voiceover/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({postId: baseId, dryRun: true}),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        chunkCount?: number
        totalChars?: number
        estimatedFreshCostUsd?: number
      }
      if (!res.ok) {
        toast.push({status: 'error', title: 'Dry-run failed', description: data.error ?? res.statusText})
        return
      }
      setDryRunInfo({
        chunks: data.chunkCount ?? 0,
        chars: data.totalChars ?? 0,
        estCostUsd: data.estimatedFreshCostUsd ?? 0,
      })
      setConfirmOpen(true)
    } catch (err) {
      toast.push({
        status: 'error',
        title: 'Could not preview',
        description: err instanceof Error ? err.message : 'Network error',
      })
    } finally {
      setBusy(false)
    }
  }

  const onConfirm = async () => {
    setConfirmOpen(false)
    setBusy(true)
    toast.push({
      status: 'info',
      title: 'Generating voiceover…',
      description: 'New chunks call ElevenLabs; unchanged chunks are free (Cloudinary cache).',
    })
    try {
      const res = await fetch(`${apiUrl}/api/voiceover/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({postId: baseId}),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        chunkCount?: number
        cacheHits?: number
        generated?: number
        totalSeconds?: number
      }
      if (res.ok) {
        const secs = data.totalSeconds ?? 0
        const mins = secs > 0 ? `${Math.round(secs / 60)}m` : '?'
        toast.push({
          status: 'success',
          title: `Voiceover ready (${mins} narration)`,
          description: `${data.generated ?? 0} generated · ${data.cacheHits ?? 0} cached`,
        })
      } else {
        toast.push({
          status: 'error',
          title: 'Generation failed',
          description: data.error ?? res.statusText,
        })
      }
    } catch (err) {
      toast.push({
        status: 'error',
        title: 'Generation request failed',
        description: err instanceof Error ? err.message : 'Network error',
      })
    } finally {
      setBusy(false)
    }
  }

  return {
    label: 'Generate voiceover',
    icon: SparklesIcon,
    disabled: busy,
    onHandle: fetchPreview,
    dialog:
      confirmOpen && dryRunInfo
        ? {
            type: 'confirm',
            tone: dryRunInfo.estCostUsd > 5 ? 'caution' : 'default',
            message: `${dryRunInfo.chunks} chunks · ${dryRunInfo.chars} chars · est. cost up to $${dryRunInfo.estCostUsd.toFixed(2)} (cached chunks are free). Continue?`,
            onConfirm,
            onCancel: () => setConfirmOpen(false),
          }
        : false,
  }
}

GenerateVoiceoverAction.displayName = 'Generate_voiceover'

export const GenerateVoiceover: DocumentActionComponent = GenerateVoiceoverAction
