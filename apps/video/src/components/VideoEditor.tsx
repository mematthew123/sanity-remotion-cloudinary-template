import {Suspense, useCallback, useMemo, useState} from 'react'
import {Player} from '@remotion/player'
import {useDocumentProjection, useEditDocument, type DocumentHandle} from '@sanity/sdk-react'
import {Flex, Spinner, Text} from '@sanity/ui'
import {
  COLORS,
  fonts,
  compositionsForSource,
  getComponent,
  ArticleVideoPropsSchema,
  type ArticleVideoProps,
  type VideoCopy,
  type CompositionId,
  type CompositionMeta,
} from '@template/video-core'

// Templates available for `post` documents (article-promo, article-teaser).
const TEMPLATES = compositionsForSource('post')

// Slots editable in the props panel; each writes to `videoCopy.<key>` on the post.
const COPY_SLOTS: ReadonlyArray<{key: keyof VideoCopy; label: string; multiline?: boolean}> = [
  {key: 'kicker', label: 'Kicker'},
  {key: 'headline', label: 'Headline'},
  {key: 'subhead', label: 'Subhead'},
  {key: 'pullQuote', label: 'Pull quote', multiline: true},
  {key: 'ctaPrimary', label: 'Primary CTA'},
  {key: 'ctaSecondary', label: 'Secondary CTA'},
]

interface EditorProjection {
  title: string | null
  excerpt: string | null
  publishedAt: string | null
  authorName: string | null
  mainImageUrl: string | null
  videoCopy: VideoCopy | null
}

type RenderState =
  | {status: 'idle'}
  | {status: 'rendering'}
  | {status: 'ready'; documentId: string; cloudinaryUrl: string | null; idempotent: boolean}
  | {status: 'error'; message: string}

const PANEL_WIDTH = 300

// -----------------------------------------------------------------------------
// Props panel — edits the post's `videoCopy` via useEditDocument (persisted).
// -----------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: `3px solid ${COLORS.foreground}`,
  backgroundColor: COLORS.background,
  fontFamily: fonts.mono,
  fontSize: 13,
  color: COLORS.foreground,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontFamily: fonts.mono,
  fontWeight: 700,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: COLORS.muted,
  marginBottom: 4,
  display: 'block',
}

function SectionHeader({children}: {children: React.ReactNode}) {
  return (
    <div
      style={{
        fontFamily: fonts.mono,
        fontWeight: 800,
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: '-0.02em',
        color: COLORS.foreground,
        padding: '12px 0 8px',
        borderBottom: `2px solid ${COLORS.foreground}`,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

function VideoCopyPanel({
  handle,
  videoCopy,
  durationInSeconds,
  onDurationChange,
  fps,
}: {
  handle: DocumentHandle
  videoCopy: VideoCopy | null
  durationInSeconds: number
  onDurationChange: (s: number) => void
  fps: number
}) {
  // Single editor for the whole `videoCopy` object. Per-slot edits use a
  // functional update so we never clobber sibling slots — and the write lands
  // on the post in the Content Lake (no local form state for content).
  const editVideoCopy = useEditDocument<VideoCopy | undefined>({...handle, path: 'videoCopy'})

  const setSlot = useCallback(
    (key: keyof VideoCopy, value: string) => {
      editVideoCopy((current) => {
        const next: VideoCopy = {...(current ?? {})}
        if (value === '') {
          delete next[key]
        } else {
          next[key] = value
        }
        return next
      })
    },
    [editVideoCopy],
  )

  return (
    <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
      <div
        style={{
          padding: '16px 16px 12px',
          borderBottom: `3px solid ${COLORS.foreground}`,
        }}
      >
        <span
          style={{
            fontFamily: fonts.mono,
            fontWeight: 800,
            fontSize: 14,
            textTransform: 'uppercase',
            color: COLORS.foreground,
          }}
        >
          Edit
        </span>
        <p style={{fontFamily: fonts.body, fontSize: 11, color: COLORS.muted, margin: '4px 0 0'}}>
          Copy edits save to the post
        </p>
      </div>

      <div style={{flex: 1, overflow: 'auto', padding: 16}}>
        {/* Timing — preview-only, kept in local state. */}
        <SectionHeader>Timing (preview only)</SectionHeader>
        <div style={{marginBottom: 12}}>
          <label style={labelStyle}>
            Duration
            <span style={{color: COLORS.accent, fontWeight: 800, marginLeft: 8}}>
              {durationInSeconds}s
            </span>
          </label>
          <input
            type="range"
            min={3}
            max={15}
            step={0.5}
            value={durationInSeconds}
            onChange={(e) => onDurationChange(Number(e.target.value))}
            style={{width: '100%', accentColor: COLORS.accent, cursor: 'pointer'}}
          />
          <div style={{fontFamily: fonts.mono, fontSize: 10, color: COLORS.muted, marginTop: 4}}>
            {Math.round(durationInSeconds * fps)} frames @ {fps}fps
          </div>
        </div>

        {/* Copy slots — persisted to the post's videoCopy. */}
        <SectionHeader>Video copy</SectionHeader>
        {COPY_SLOTS.map(({key, label, multiline}) => (
          <div key={key} style={{marginBottom: 12}}>
            <label style={labelStyle}>{label}</label>
            {multiline ? (
              <textarea
                value={videoCopy?.[key] ?? ''}
                onChange={(e) => setSlot(key, e.target.value)}
                rows={3}
                style={{...inputStyle, resize: 'vertical'}}
              />
            ) : (
              <input
                type="text"
                value={videoCopy?.[key] ?? ''}
                onChange={(e) => setSlot(key, e.target.value)}
                style={inputStyle}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Template button
// -----------------------------------------------------------------------------

function TemplateButton({
  template,
  isActive,
  onClick,
}: {
  template: CompositionMeta
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 14px',
        border: `3px solid ${COLORS.foreground}`,
        backgroundColor: isActive ? COLORS.accent : COLORS.background,
        color: isActive ? '#FFFFFF' : COLORS.foreground,
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: isActive ? `4px 4px 0px ${COLORS.foreground}` : 'none',
        transform: isActive ? 'translate(-2px, -2px)' : 'none',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
      }}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontWeight: 800,
          fontSize: 13,
          textTransform: 'uppercase',
          letterSpacing: '-0.02em',
        }}
      >
        {template.label}
      </div>
      <div style={{fontFamily: fonts.body, fontSize: 11, marginTop: 3, opacity: 0.85}}>
        {template.description}
      </div>
      <div style={{fontFamily: fonts.mono, fontSize: 10, marginTop: 4, opacity: 0.7}}>
        {template.width}×{template.height}
      </div>
    </button>
  )
}

// -----------------------------------------------------------------------------
// Editor body (has the selected post's projection)
// -----------------------------------------------------------------------------

function VideoEditorInner({handle}: {handle: DocumentHandle}) {
  const [activeId, setActiveId] = useState<CompositionId>(TEMPLATES[0]!.id)
  const [renderState, setRenderState] = useState<RenderState>({status: 'idle'})

  const {data} = useDocumentProjection<EditorProjection>({
    ...handle,
    projection: `{
      title,
      excerpt,
      publishedAt,
      "authorName": author->name,
      "mainImageUrl": mainImage.asset->url,
      videoCopy{ kicker, headline, subhead, pullQuote, ctaPrimary, ctaSecondary }
    }`,
  })

  const template = useMemo(
    () => TEMPLATES.find((t) => t.id === activeId) ?? TEMPLATES[0]!,
    [activeId],
  )

  // Duration is preview-only (local state). It resets when the template changes.
  const [durationInSeconds, setDurationInSeconds] = useState(
    template.defaultDurationFrames / template.fps,
  )
  const [prevId, setPrevId] = useState<CompositionId>(activeId)
  if (activeId !== prevId) {
    setPrevId(activeId)
    const next = TEMPLATES.find((t) => t.id === activeId) ?? TEMPLATES[0]!
    setDurationInSeconds(next.defaultDurationFrames / next.fps)
  }
  const durationInFrames = Math.round(durationInSeconds * template.fps)

  // Build the canonical props contract from the live projection.
  const videoCopy = data?.videoCopy ?? null
  const inputProps: ArticleVideoProps = useMemo(
    () => ({
      title: data?.title ?? 'Untitled',
      authorName: data?.authorName ?? 'Unknown author',
      publishedAt: data?.publishedAt ?? new Date().toISOString(),
      excerpt: data?.excerpt ?? '',
      mainImageUrl: data?.mainImageUrl ?? undefined,
      videoCopy: videoCopy ?? undefined,
    }),
    [data?.title, data?.authorName, data?.publishedAt, data?.excerpt, data?.mainImageUrl, videoCopy],
  )

  const handleRender = useCallback(async () => {
    const renderUrl = process.env.SANITY_APP_RENDER_API_URL
    const renderSecret = process.env.SANITY_APP_RENDER_SECRET
    if (!renderUrl || !renderSecret) {
      setRenderState({
        status: 'error',
        message: 'Render not configured (set SANITY_APP_RENDER_API_URL and SANITY_APP_RENDER_SECRET)',
      })
      return
    }

    // Validate against the shared schema before sending; the route re-validates.
    const parsed = ArticleVideoPropsSchema.safeParse(inputProps)
    if (!parsed.success) {
      setRenderState({status: 'error', message: 'Invalid props for this post'})
      return
    }

    setRenderState({status: 'rendering'})
    try {
      const res = await fetch(renderUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${renderSecret}`,
        },
        body: JSON.stringify({
          compositionId: activeId,
          inputProps: parsed.data,
          postId: handle.documentId,
        }),
      })

      const payload = (await res.json().catch(() => null)) as
        | {
            success?: boolean
            documentId?: string
            status?: string
            cloudinaryUrl?: string
            idempotent?: boolean
            error?: string
          }
        | null

      if (!res.ok || !payload?.success || !payload.documentId) {
        setRenderState({
          status: 'error',
          message: payload?.error ?? `Render failed (${res.status})`,
        })
        return
      }

      setRenderState({
        status: 'ready',
        documentId: payload.documentId,
        cloudinaryUrl: payload.cloudinaryUrl ?? null,
        idempotent: payload.idempotent ?? false,
      })
    } catch (e) {
      setRenderState({status: 'error', message: e instanceof Error ? e.message : 'Network error'})
    }
  }, [inputProps, activeId, handle.documentId])

  const Composition = getComponent(activeId)
  const isRendering = renderState.status === 'rendering'

  return (
    <div style={{display: 'flex', height: '100%'}}>
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
        {/* Template selector */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: `3px solid ${COLORS.foreground}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {TEMPLATES.map((t) => (
            <TemplateButton
              key={t.id}
              template={t}
              isActive={activeId === t.id}
              onClick={() => setActiveId(t.id)}
            />
          ))}
        </div>

        {/* Live preview */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            backgroundColor: '#ECEAE3',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              border: `3px solid ${COLORS.foreground}`,
              boxShadow: `6px 6px 0px ${COLORS.foreground}`,
              lineHeight: 0,
            }}
          >
            <Player
              component={Composition}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              fps={template.fps}
              compositionWidth={template.width}
              compositionHeight={template.height}
              style={{
                width: template.isVertical ? 260 : 440,
                height: template.isVertical ? 462 : 440,
              }}
              controls
              autoPlay
              loop
              acknowledgeRemotionLicense
            />
          </div>
        </div>

        {/* Action bar */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: `3px solid ${COLORS.foreground}`,
            backgroundColor: COLORS.foreground,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{minWidth: 0}}>
            <span
              style={{
                fontFamily: fonts.mono,
                fontWeight: 800,
                fontSize: 14,
                color: COLORS.accent,
                textTransform: 'uppercase',
                maxWidth: 320,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
                verticalAlign: 'bottom',
              }}
            >
              {inputProps.title}
            </span>
            <span style={{fontFamily: fonts.mono, fontSize: 12, color: COLORS.muted, marginLeft: 12}}>
              {durationInSeconds}s · {template.width}×{template.height} · MP4
            </span>
          </div>

          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            {renderState.status === 'ready' && (
              <span
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  color: COLORS.highlight,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{renderState.idempotent ? 'Already rendered' : 'Video ready'}</span>
                {renderState.cloudinaryUrl && (
                  <a
                    href={renderState.cloudinaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '4px 10px',
                      border: `2px solid ${COLORS.highlight}`,
                      color: COLORS.highlight,
                      fontFamily: fonts.mono,
                      fontWeight: 700,
                      fontSize: 10,
                      textTransform: 'uppercase',
                      textDecoration: 'none',
                      letterSpacing: '0.05em',
                    }}
                  >
                    View
                  </a>
                )}
              </span>
            )}
            {renderState.status === 'error' && (
              <span
                title={renderState.message}
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 11,
                  color: '#FF6B6B',
                  maxWidth: 220,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {renderState.message}
              </span>
            )}
            <button
              type="button"
              onClick={handleRender}
              disabled={isRendering}
              style={{
                padding: '8px 20px',
                border: `3px solid ${COLORS.highlight}`,
                backgroundColor: isRendering ? COLORS.muted : COLORS.highlight,
                fontFamily: fonts.mono,
                fontWeight: 800,
                fontSize: 13,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: COLORS.foreground,
                cursor: isRendering ? 'wait' : 'pointer',
              }}
            >
              {isRendering ? 'Rendering…' : 'Render'}
            </button>
          </div>
        </div>
      </div>

      {/* Props panel */}
      <aside
        style={{
          width: PANEL_WIDTH,
          flex: 'none',
          borderLeft: `3px solid ${COLORS.foreground}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: COLORS.background,
        }}
      >
        <VideoCopyPanel
          handle={handle}
          videoCopy={videoCopy}
          durationInSeconds={durationInSeconds}
          onDurationChange={setDurationInSeconds}
          fps={template.fps}
        />
      </aside>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Public component
// -----------------------------------------------------------------------------

function EmptyState() {
  return (
    <Flex
      align="center"
      justify="center"
      direction="column"
      gap={4}
      style={{height: '100%'}}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontWeight: 800,
          fontSize: 48,
          color: COLORS.foreground,
          opacity: 0.1,
          textTransform: 'uppercase',
        }}
      >
        Video
      </div>
      <Text muted>Select a post to preview a video</Text>
    </Flex>
  )
}

export function VideoEditor({handle}: {handle: DocumentHandle | null}) {
  if (!handle) return <EmptyState />

  return (
    <Suspense
      // documentId as key: remount the editor (and reset render/duration state)
      // when a different post is selected.
      key={handle.documentId}
      fallback={
        <Flex align="center" justify="center" style={{height: '100%'}}>
          <Spinner muted />
        </Flex>
      }
    >
      <VideoEditorInner handle={handle} />
    </Suspense>
  )
}
