import {useMemo} from 'react'
import type {UserViewComponent} from 'sanity/structure'
import {Badge, Box, Card, Flex, Stack, Text} from '@sanity/ui'
import {findComposition} from '@template/video-core/registry'

// React-free metadata import (`/registry`, not the barrel): the composition
// catalog gives us a human label for the `template` id without dragging Remotion
// into the Studio bundle. The player itself is a plain <video> — no Remotion.

type VideoDoc = {
  title?: string
  status?: 'rendering' | 'uploading' | 'ready' | 'failed'
  template?: string
  duration?: number
  width?: number
  height?: number
  cloudinaryUrl?: string
  errorMessage?: string
}

const previewStyle = {width: '100%', display: 'block', background: '#0b0b0b'} as const

export const VideoPreview: UserViewComponent = ({document}) => {
  const doc = document.displayed as unknown as VideoDoc

  const meta = useMemo(() => (doc.template ? findComposition(doc.template) : undefined), [doc.template])
  const width = doc.width ?? meta?.width ?? 1080
  const height = doc.height ?? meta?.height ?? 1080
  const isPortrait = height > width
  const label = meta?.label ?? doc.template ?? 'Video'

  if (doc.status === 'failed') {
    return (
      <Box padding={4}>
        <Card tone="critical" padding={4} radius={2}>
          <Stack space={3}>
            <Text weight="semibold">Render failed</Text>
            {doc.errorMessage ? (
              <Text size={1} muted>
                {doc.errorMessage}
              </Text>
            ) : null}
          </Stack>
        </Card>
      </Box>
    )
  }

  if (doc.status && doc.status !== 'ready') {
    return (
      <Box padding={4}>
        <Card tone="caution" padding={4} radius={2}>
          <Text>The preview appears once the render completes. Current status: {doc.status}.</Text>
        </Card>
      </Box>
    )
  }

  if (!doc.cloudinaryUrl) {
    return (
      <Box padding={4}>
        <Card tone="transparent" padding={4} radius={2} border>
          <Text muted>No rendered video to preview yet.</Text>
        </Card>
      </Box>
    )
  }

  return (
    <Box padding={4}>
      <Stack space={4}>
        <Box style={{maxWidth: isPortrait ? 360 : 720, margin: '0 auto', width: '100%'}}>
          <Card radius={2} shadow={1} overflow="hidden">
            <video
              key={doc.cloudinaryUrl}
              src={doc.cloudinaryUrl}
              controls
              playsInline
              preload="metadata"
              style={{...previewStyle, aspectRatio: `${width}/${height}`}}
            />
          </Card>
        </Box>

        <Flex gap={2} align="center" justify="center" wrap="wrap">
          <Text size={1} weight="semibold">
            {label}
          </Text>
          <Badge tone="primary" mode="outline" fontSize={0}>
            {width}×{height}
          </Badge>
          {typeof doc.duration === 'number' ? (
            <Badge tone="default" mode="outline" fontSize={0}>
              {doc.duration}s
            </Badge>
          ) : null}
        </Flex>
      </Stack>
    </Box>
  )
}

export default VideoPreview
