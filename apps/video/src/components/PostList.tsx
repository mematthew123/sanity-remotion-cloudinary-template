import {Suspense} from 'react'
import {useDocuments, useDocumentProjection, type DocumentHandle} from '@sanity/sdk-react'
import {Flex, Stack, Text, Spinner} from '@sanity/ui'
import {COLORS, fonts} from '@template/video-core'

interface PostListProps {
  selected: DocumentHandle | null
  onSelect: (handle: DocumentHandle) => void
}

interface PostListProjection {
  title: string | null
  authorName: string | null
  publishedAt: string | null
}

function formatDate(value: string | null): string {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})
  } catch {
    return ''
  }
}

/**
 * One row. Owns a single `useDocumentProjection` and is therefore wrapped in its
 * own <Suspense> by the parent — per the App SDK "one fetching hook per
 * component / wrap in Suspense" rule.
 */
function PostListItem({
  handle,
  isSelected,
  onSelect,
}: {
  handle: DocumentHandle
  isSelected: boolean
  onSelect: (handle: DocumentHandle) => void
}) {
  const {data} = useDocumentProjection<PostListProjection>({
    ...handle,
    projection: `{
      title,
      "authorName": author->name,
      publishedAt
    }`,
  })

  const date = formatDate(data?.publishedAt ?? null)

  return (
    <button
      type="button"
      onClick={() => onSelect(handle)}
      style={{
        display: 'block',
        width: '100%',
        padding: '16px 18px',
        border: `3px solid ${COLORS.foreground}`,
        backgroundColor: isSelected ? COLORS.highlight : COLORS.background,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
        boxShadow: isSelected ? `4px 4px 0px ${COLORS.foreground}` : 'none',
        transform: isSelected ? 'translate(-2px, -2px)' : 'none',
      }}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontWeight: 800,
          fontSize: 14,
          color: COLORS.foreground,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {data?.title ?? 'Untitled'}
      </div>
      <div
        style={{
          fontFamily: fonts.body,
          fontSize: 12,
          color: COLORS.muted,
          marginTop: 3,
        }}
      >
        {data?.authorName ? `by ${data.authorName}` : 'Unknown author'}
        {date ? ` · ${date}` : ''}
      </div>
    </button>
  )
}

function PostListInner({selected, onSelect}: PostListProps) {
  const {data: handles, hasMore, loadMore, isPending} = useDocuments({
    documentType: 'post',
    batchSize: 20,
    orderings: [{field: 'publishedAt', direction: 'desc'}],
  })

  return (
    <Flex direction="column" style={{height: '100%'}}>
      <div style={{padding: '20px 18px 14px', borderBottom: `3px solid ${COLORS.foreground}`}}>
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
          Posts
        </h2>
        <p style={{fontFamily: fonts.body, fontSize: 12, color: COLORS.muted, margin: '4px 0 0'}}>
          Select a post to preview and render a video
        </p>
      </div>

      <div style={{flex: 1, overflow: 'auto', padding: 14}}>
        {handles.length === 0 ? (
          <Text muted size={1} style={{padding: 8}}>
            No posts yet.
          </Text>
        ) : (
          <Stack space={2}>
            {handles.map((handle) => (
              <Suspense
                key={handle.documentId}
                fallback={
                  <div
                    style={{
                      padding: '16px 18px',
                      border: `3px solid ${COLORS.foreground}`,
                      backgroundColor: COLORS.background,
                      opacity: 0.5,
                      fontFamily: fonts.mono,
                      fontSize: 13,
                      color: COLORS.muted,
                    }}
                  >
                    Loading…
                  </div>
                }
              >
                <PostListItem
                  handle={handle}
                  isSelected={selected?.documentId === handle.documentId}
                  onSelect={onSelect}
                />
              </Suspense>
            ))}

            {hasMore && (
              <button
                type="button"
                onClick={() => loadMore()}
                disabled={isPending}
                style={{
                  padding: 12,
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
                {isPending ? 'Loading…' : 'Load more'}
              </button>
            )}
          </Stack>
        )}
      </div>
    </Flex>
  )
}

export function PostList(props: PostListProps) {
  return (
    <Suspense
      fallback={
        <Flex align="center" justify="center" style={{height: '100%'}}>
          <Spinner muted />
        </Flex>
      }
    >
      <PostListInner {...props} />
    </Suspense>
  )
}
