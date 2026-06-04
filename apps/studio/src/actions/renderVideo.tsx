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
import {PlayIcon, SparklesIcon} from '@sanity/icons'
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

// =============================================================================
// Narrated reading — a separate render action because the props shape diverges
// from ArticleVideoProps. It reads `post.voiceoverChunks` (populated by the
// generate-voiceover CLI) instead of `post.videoCopy`, and passes the chunks
// straight through to the composition.
// =============================================================================

const NARRATED_FIELDS_QUERY = `*[_id == $id][0]{
  title,
  publishedAt,
  "authorName": author->name,
  "mainImageUrl": mainImage.asset->url,
  voiceoverChunks
}`

type NarratedFields = {
  title?: string
  publishedAt?: string
  authorName?: string
  mainImageUrl?: string
  voiceoverChunks?: Array<{id: string; text: string; audioUrl: string; durationSeconds: number}>
}

function RenderArticleNarratedAction(props: DocumentActionProps): DocumentActionDescription {
  const [isRendering, setIsRendering] = useState(false)
  const client = useClient({apiVersion: '2024-12-27'})
  const toast = useToast()

  const onHandle = async () => {
    const publishedId = (props.id || '').replace(/^drafts\./, '')
    const snapshot = props.draft ?? props.published
    if (!snapshot) {
      toast.push({status: 'warning', title: 'Save the post first'})
      props.onComplete()
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
        props.onComplete()
        return
      }

      // Defensive: every chunk must have a non-zero duration so calculateMetadata
      // sums to a useful total. Bail loud rather than render an empty video.
      const totalSeconds = chunks.reduce((sum, c) => sum + (c.durationSeconds ?? 0), 0)
      if (totalSeconds <= 0) {
        toast.push({
          status: 'error',
          title: 'Voiceover chunks have no duration',
          description: 'Re-run generate-voiceover — Cloudinary may not have reported durations.',
        })
        props.onComplete()
        return
      }

      const inputProps = {
        title: resolved?.title ?? 'Untitled',
        authorName: resolved?.authorName ?? 'Unknown',
        publishedAt: resolved?.publishedAt ?? new Date().toISOString(),
        mainImageUrl: resolved?.mainImageUrl || undefined,
        chunks,
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
      const minutes = Math.round(totalSeconds / 60)
      toast.push({
        status: 'info',
        title: `Rendering ${minutes}-min narrated reading… this may take several minutes.`,
      })

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
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
      props.onComplete()
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
// Generate voiceover — Studio-side trigger for the same TTS pipeline the CLI
// runs. Editor-friendly path so non-developers can refresh narration after
// editing the post body. Cheap re-runs hit the Cloudinary cache; only changed
// paragraphs re-bill ElevenLabs.
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
  const secret = import.meta.env.SANITY_STUDIO_RENDER_SECRET

  const fetchPreview = async (): Promise<void> => {
    if (!secret) {
      toast.push({status: 'error', title: 'SANITY_STUDIO_RENDER_SECRET not set'})
      props.onComplete()
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`${apiUrl}/api/voiceover/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
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
        props.onComplete()
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
      props.onComplete()
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
          Authorization: `Bearer ${secret}`,
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
      props.onComplete()
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
            onCancel: () => {
              setConfirmOpen(false)
              props.onComplete()
            },
          }
        : false,
  }
}

GenerateVoiceoverAction.displayName = 'Generate_voiceover'

export const GenerateVoiceover: DocumentActionComponent = GenerateVoiceoverAction
