import React, {Suspense} from 'react'
import {useDocumentProjection} from '@sanity/sdk-react'
import {COLORS, fonts} from '@template/video-core'

interface VideoProjection {
  title?: string
  template?: string
  format?: string
  status?: string
  cloudinaryPublicId?: string
  cloudinaryUrl?: string
  duration?: number
  width?: number
  height?: number
  renderedAt?: string
  errorMessage?: string
  sourceName?: string
}

const TEMPLATE_LABELS: Record<string, string> = {
  'article-promo': 'Article Promo',
  'article-teaser': 'Article Teaser',
}

const STATUS_COLORS: Record<string, string> = {
  ready: COLORS.accent,
  rendering: COLORS.highlight,
  uploading: COLORS.highlight,
  failed: '#E03131',
}

const InfoRow: React.FC<{label: string; value: string | undefined}> = ({label, value}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: `1px solid ${COLORS.foreground}20`,
    }}
  >
    <span
      style={{
        fontFamily: fonts.mono,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: COLORS.muted,
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontFamily: fonts.mono,
        fontSize: 12,
        color: COLORS.foreground,
        maxWidth: '60%',
        textAlign: 'right',
        wordBreak: 'break-all',
      }}
    >
      {value ?? '—'}
    </span>
  </div>
)

const VideoDetailInner: React.FC<{videoId: string}> = ({videoId}) => {
  const handle = {documentId: videoId, documentType: 'video'} as const
  const {data: video} = useDocumentProjection<VideoProjection>({
    ...handle,
    projection: `{
      title,
      template,
      format,
      status,
      cloudinaryPublicId,
      cloudinaryUrl,
      duration,
      width,
      height,
      renderedAt,
      errorMessage,
      "sourceName": post->title
    }`,
  })

  if (!video) {
    return (
      <div style={{padding: 40, textAlign: 'center', fontFamily: fonts.mono, color: COLORS.muted}}>
        Video not found
      </div>
    )
  }

  const isPortrait = (video.height ?? 1080) > (video.width ?? 1080)
  const statusColor = STATUS_COLORS[video.status ?? ''] ?? COLORS.muted

  return (
    <div style={{display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto'}}>
      {/* Video preview */}
      {video.cloudinaryUrl && video.format !== 'gif' && (
        <div
          style={{
            padding: 24,
            backgroundColor: COLORS.foreground,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              border: `3px solid ${COLORS.background}20`,
              maxWidth: isPortrait ? 300 : 500,
              width: '100%',
            }}
          >
            <video
              src={video.cloudinaryUrl}
              controls
              style={{
                width: '100%',
                aspectRatio: `${video.width ?? 1080}/${video.height ?? 1080}`,
                display: 'block',
              }}
            />
          </div>
        </div>
      )}

      {/* Details panel */}
      <div style={{padding: 24}}>
        {/* Title */}
        <h2
          style={{
            fontFamily: fonts.mono,
            fontWeight: 800,
            fontSize: 18,
            color: COLORS.foreground,
            textTransform: 'uppercase',
            margin: '0 0 4px',
          }}
        >
          {video.title ?? 'Untitled Video'}
        </h2>

        {/* Status badges */}
        <div style={{display: 'flex', gap: 8, marginBottom: 20}}>
          <span
            style={{
              fontFamily: fonts.mono,
              fontWeight: 700,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              padding: '4px 10px',
              border: `2px solid ${statusColor}`,
              color: statusColor,
            }}
          >
            {video.status ?? 'unknown'}
          </span>
          {video.cloudinaryPublicId && (
            <span
              style={{
                fontFamily: fonts.mono,
                fontWeight: 700,
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '4px 10px',
                border: `2px solid ${COLORS.accent}`,
                color: COLORS.accent,
              }}
            >
              On Cloudinary
            </span>
          )}
        </div>

        {video.errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              border: `2px solid #E03131`,
              fontFamily: fonts.mono,
              fontSize: 12,
              color: '#E03131',
              marginBottom: 16,
            }}
          >
            {video.errorMessage}
          </div>
        )}

        {/* Info table */}
        <div style={{marginBottom: 20}}>
          <InfoRow
            label="Template"
            value={video.template ? (TEMPLATE_LABELS[video.template] ?? video.template) : undefined}
          />
          <InfoRow label="Format" value={video.format?.toUpperCase()} />
          <InfoRow
            label="Dimensions"
            value={video.width && video.height ? `${video.width}x${video.height}` : undefined}
          />
          <InfoRow label="Duration" value={video.duration ? `${video.duration}s` : undefined} />
          <InfoRow label="Source" value={video.sourceName ?? undefined} />
          <InfoRow
            label="Rendered"
            value={
              video.renderedAt
                ? new Date(video.renderedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : undefined
            }
          />
        </div>

        {/* Cloudinary details */}
        {video.cloudinaryPublicId && (
          <div style={{marginBottom: 20}}>
            <h3
              style={{
                fontFamily: fonts.mono,
                fontWeight: 800,
                fontSize: 13,
                textTransform: 'uppercase',
                color: COLORS.foreground,
                margin: '0 0 10px',
              }}
            >
              Cloudinary
            </h3>
            <InfoRow label="Public ID" value={video.cloudinaryPublicId} />
            {video.cloudinaryUrl && (
              <div style={{marginTop: 12}}>
                <a
                  href={video.cloudinaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    border: `3px solid ${COLORS.foreground}`,
                    backgroundColor: COLORS.foreground,
                    color: COLORS.background,
                    fontFamily: fonts.mono,
                    fontWeight: 700,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    textDecoration: 'none',
                  }}
                >
                  Open in Cloudinary
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const VideoDetail: React.FC<{videoId: string | null}> = ({videoId}) => {
  if (!videoId) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            fontFamily: fonts.mono,
            fontWeight: 800,
            fontSize: 48,
            color: COLORS.foreground,
            opacity: 0.1,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Assets
        </div>
        <div style={{fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 20, color: COLORS.muted}}>
          Select a video to view details
        </div>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: fonts.mono,
            color: COLORS.muted,
          }}
        >
          Loading video...
        </div>
      }
    >
      <VideoDetailInner videoId={videoId} />
    </Suspense>
  )
}
