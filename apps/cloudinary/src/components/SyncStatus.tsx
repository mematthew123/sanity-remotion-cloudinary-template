import React, {Suspense, useEffect, useReducer, useRef} from 'react'
import {useDocuments, useDocumentProjection} from '@sanity/sdk-react'
import type {DocumentHandle} from '@sanity/sdk'
import {COLORS, fonts} from '@template/video-core'

/**
 * Counts are aggregated from the `video` documents using the App SDK
 * (`useDocuments` for handles + `useDocumentProjection` per item). Rather than a
 * raw GROQ `useQuery`, each probe reports its projected fields up to a reducer.
 * This keeps one data hook per component and a Suspense boundary per fetcher,
 * per App SDK best practice.
 */

interface VideoFacts {
  status?: string
  format?: string
  cloudinaryPublicId?: string
}

interface AggState {
  byId: Record<string, VideoFacts>
}

type AggAction = {type: 'set'; id: string; facts: VideoFacts} | {type: 'remove'; id: string}

function aggReducer(state: AggState, action: AggAction): AggState {
  switch (action.type) {
    case 'set':
      return {byId: {...state.byId, [action.id]: action.facts}}
    case 'remove': {
      const next = {...state.byId}
      delete next[action.id]
      return {byId: next}
    }
    default:
      return state
  }
}

const StatCard: React.FC<{label: string; value: number; color: string}> = ({
  label,
  value,
  color,
}) => (
  <div style={{padding: '16px 14px', border: `3px solid ${COLORS.foreground}`, backgroundColor: COLORS.background}}>
    <div style={{fontFamily: fonts.mono, fontWeight: 800, fontSize: 28, color}}>{value}</div>
    <div
      style={{
        fontFamily: fonts.mono,
        fontWeight: 700,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: COLORS.muted,
        marginTop: 4,
      }}
    >
      {label}
    </div>
  </div>
)

/** Invisible probe: projects the few fields we count and reports them upward. */
const VideoStatProbe: React.FC<{
  handle: DocumentHandle
  onFacts: (id: string, facts: VideoFacts) => void
}> = ({handle, onFacts}) => {
  const {data} = useDocumentProjection<VideoFacts>({
    ...handle,
    projection: `{status, format, cloudinaryPublicId}`,
  })

  useEffect(() => {
    onFacts(handle.documentId, {
      status: data.status,
      format: data.format,
      cloudinaryPublicId: data.cloudinaryPublicId,
    })
  }, [handle.documentId, data.status, data.format, data.cloudinaryPublicId, onFacts])

  return null
}

const SyncStatusInner: React.FC = () => {
  const {data: handles, hasMore, loadMore, isPending} = useDocuments({
    documentType: 'video',
    batchSize: 100,
  })

  // Pull the whole set so counts reflect every video, not just the first page.
  useEffect(() => {
    if (hasMore && !isPending) loadMore()
  }, [hasMore, isPending, loadMore])

  const [agg, dispatch] = useReducer(aggReducer, {byId: {}})
  const onFacts = useRef((id: string, facts: VideoFacts) => dispatch({type: 'set', id, facts})).current

  const facts = handles.map((h) => agg.byId[h.documentId]).filter((f): f is VideoFacts => Boolean(f))

  const total = handles.length
  const ready = facts.filter((f) => f.status === 'ready').length
  const failed = facts.filter((f) => f.status === 'failed').length
  const onCloudinary = facts.filter((f) => f.cloudinaryPublicId).length
  const mp4 = facts.filter((f) => f.format === 'mp4').length
  const gif = facts.filter((f) => f.format === 'gif').length
  const missingCdn = facts.filter(
    (f) => f.status === 'ready' && f.format !== 'gif' && !f.cloudinaryPublicId,
  ).length

  const stats = [
    {label: 'Total Videos', value: total, color: COLORS.foreground},
    {label: 'Ready', value: ready, color: COLORS.accent},
    {label: 'On Cloudinary', value: onCloudinary, color: COLORS.accent},
    {label: 'Failed', value: failed, color: failed > 0 ? '#E03131' : COLORS.foreground},
    {label: 'MP4s', value: mp4, color: COLORS.foreground},
    {label: 'GIFs', value: gif, color: COLORS.foreground},
    {label: 'Missing CDN', value: missingCdn, color: missingCdn > 0 ? '#E03131' : COLORS.accent},
  ]

  return (
    <div style={{padding: 24, overflow: 'auto', height: '100%'}}>
      {/* Hidden probes feed the reducer */}
      {handles.map((handle) => (
        <Suspense key={handle.documentId} fallback={null}>
          <VideoStatProbe handle={handle} onFacts={onFacts} />
        </Suspense>
      ))}

      <h2
        style={{
          fontFamily: fonts.mono,
          fontWeight: 800,
          fontSize: 18,
          textTransform: 'uppercase',
          color: COLORS.foreground,
          margin: '0 0 4px',
        }}
      >
        Sync Status
      </h2>
      <p style={{fontFamily: fonts.body, fontSize: 13, color: COLORS.muted, margin: '0 0 20px'}}>
        {facts.length < total
          ? `Counting ${facts.length} / ${total} videos...`
          : `Across ${total} videos.`}
      </p>

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 30,
        }}
      >
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} color={stat.color} />
        ))}
      </div>

      {missingCdn > 0 ? (
        <div style={{padding: 20, border: `3px solid #E03131`}}>
          <div
            style={{
              fontFamily: fonts.mono,
              fontWeight: 800,
              fontSize: 14,
              textTransform: 'uppercase',
              color: '#E03131',
            }}
          >
            {missingCdn} video{missingCdn === 1 ? '' : 's'} missing from Cloudinary
          </div>
          <div style={{fontFamily: fonts.body, fontSize: 13, color: COLORS.muted, marginTop: 4}}>
            These are marked ready but have no Cloudinary public ID. They may need a re-render.
          </div>
        </div>
      ) : (
        total > 0 && (
          <div style={{padding: 20, border: `3px solid ${COLORS.accent}`, textAlign: 'center'}}>
            <div
              style={{
                fontFamily: fonts.mono,
                fontWeight: 800,
                fontSize: 14,
                textTransform: 'uppercase',
                color: COLORS.accent,
              }}
            >
              All synced
            </div>
            <div style={{fontFamily: fonts.body, fontSize: 13, color: COLORS.muted, marginTop: 4}}>
              Every ready video has a Cloudinary URL.
            </div>
          </div>
        )
      )}
    </div>
  )
}

export const SyncStatus: React.FC = () => (
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
        Loading sync status...
      </div>
    }
  >
    <SyncStatusInner />
  </Suspense>
)
