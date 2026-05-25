import React, {Suspense, useRef} from 'react'
import {useDocuments, useDocumentProjection} from '@sanity/sdk-react'
import type {DocumentHandle} from '@sanity/sdk'
import {COLORS, fonts} from '@template/video-core'

interface VideoListProps {
  onSelect: (videoId: string) => void
  selectedId: string | null
}

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
}

const STATUS_COLORS: Record<string, string> = {
  ready: COLORS.accent,
  rendering: COLORS.highlight,
  uploading: COLORS.highlight,
  failed: '#E03131',
}

const VideoListItem: React.FC<{
  handle: DocumentHandle
  isSelected: boolean
  onSelect: (id: string) => void
}> = ({handle, isSelected, onSelect}) => {
  const ref = useRef(null)
  const {data} = useDocumentProjection<VideoProjection>({
    ...handle,
    ref,
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
      renderedAt
    }`,
  })

  const statusColor = STATUS_COLORS[data.status ?? ''] ?? COLORS.muted

  return (
    <button
      ref={ref}
      onClick={() => onSelect(handle.documentId)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '14px 16px',
        border: `3px solid ${COLORS.foreground}`,
        backgroundColor: isSelected ? COLORS.highlight : COLORS.background,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        boxShadow: isSelected ? `4px 4px 0px ${COLORS.foreground}` : 'none',
        transform: isSelected ? 'translate(-2px, -2px)' : 'none',
      }}
    >
      {/* Status dot */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: statusColor,
          flexShrink: 0,
        }}
      />

      {/* Info */}
      <div style={{flex: 1, minWidth: 0}}>
        <div
          style={{
            fontFamily: fonts.mono,
            fontWeight: 800,
            fontSize: 13,
            color: COLORS.foreground,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.title ?? 'Untitled Video'}
        </div>
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 10,
            color: COLORS.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginTop: 3,
          }}
        >
          {data.template ?? ''} &middot; {(data.format ?? 'mp4').toUpperCase()} &middot;{' '}
          {data.duration ? `${data.duration}s` : ''}
        </div>
      </div>

      {/* Cloudinary indicator */}
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 9,
          color: data.cloudinaryPublicId ? COLORS.accent : COLORS.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {data.cloudinaryPublicId ? 'CDN' : data.format === 'gif' ? 'GIF' : '—'}
      </div>
    </button>
  )
}

const VideoListInner: React.FC<VideoListProps> = ({onSelect, selectedId}) => {
  const {data, hasMore, loadMore, isPending} = useDocuments({
    documentType: 'video',
    orderings: [{field: 'renderedAt', direction: 'desc'}],
    batchSize: 20,
  })

  return (
    <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
      {/* Header */}
      <div style={{padding: '20px 20px 16px', borderBottom: `3px solid ${COLORS.foreground}`}}>
        <h2
          style={{
            fontFamily: fonts.mono,
            fontWeight: 800,
            fontSize: 18,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            color: COLORS.foreground,
            margin: 0,
          }}
        >
          Videos
        </h2>
        <p style={{fontFamily: fonts.body, fontSize: 13, color: COLORS.muted, margin: '4px 0 0'}}>
          All rendered video assets
        </p>
      </div>

      {/* List */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: 12,
        }}
      >
        {data.map((handle) => (
          <Suspense
            key={handle.documentId}
            fallback={
              <div
                style={{
                  padding: '14px 16px',
                  border: `3px solid ${COLORS.foreground}`,
                  backgroundColor: COLORS.background,
                  opacity: 0.5,
                  fontFamily: fonts.mono,
                  fontSize: 12,
                  color: COLORS.muted,
                }}
              >
                Loading...
              </div>
            }
          >
            <VideoListItem
              handle={handle}
              isSelected={selectedId === handle.documentId}
              onSelect={onSelect}
            />
          </Suspense>
        ))}

        {data.length === 0 && (
          <div
            style={{
              padding: 24,
              fontFamily: fonts.mono,
              fontSize: 12,
              color: COLORS.muted,
              textAlign: 'center',
            }}
          >
            No videos yet.
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => loadMore()}
            disabled={isPending}
            style={{
              padding: '10px',
              border: `3px solid ${COLORS.foreground}`,
              backgroundColor: COLORS.foreground,
              color: COLORS.background,
              fontFamily: fonts.mono,
              fontWeight: 700,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: isPending ? 'wait' : 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? 'Loading...' : 'Load More'}
          </button>
        )}
      </div>
    </div>
  )
}

export const VideoList: React.FC<VideoListProps> = (props) => (
  <Suspense
    fallback={
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          fontFamily: fonts.mono,
          fontSize: 14,
          color: COLORS.muted,
        }}
      >
        Loading videos...
      </div>
    }
  >
    <VideoListInner {...props} />
  </Suspense>
)
