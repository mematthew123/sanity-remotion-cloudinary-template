import {useMemo, useState} from 'react'
import type {UserViewComponent} from 'sanity/structure'
import {
  Badge,
  Box,
  Button,
  Card,
  Code,
  Flex,
  Grid,
  Stack,
  Text,
  TextInput,
  useToast,
} from '@sanity/ui'
import {CopyIcon, LaunchIcon} from '@sanity/icons'
import {VARIANTS} from '@template/video-core/registry'
import type {VariantFormat, VariantId, VariantSurface} from '@template/video-core/registry'

type VariantRow = {
  _key?: string
  variantId: VariantId
  surface: VariantSurface
  format: VariantFormat
  url: string
  width?: number
  height?: number
}

type VideoDoc = {
  status?: 'rendering' | 'uploading' | 'ready' | 'failed'
  cloudinaryPublicId?: string
  cloudinaryUrl?: string
  errorMessage?: string
  variants?: VariantRow[]
}

// Cloudinary delivery URLs are public, and the cloud name is already baked into
// every stored URL (https://res.cloudinary.com/<cloud>/video/upload/…). Reading
// it from the doc avoids shipping a Studio env var for the live preview.
function cloudNameFromUrl(url?: string): string | null {
  if (!url) return null
  try {
    const [cloud] = new URL(url).pathname.split('/').filter(Boolean)
    return cloud ?? null
  } catch {
    return null
  }
}

const isVideoFormat = (format: VariantFormat) => format === 'mp4' || format === 'webm'

const previewStyle = {width: '100%', display: 'block', background: '#0b0b0b'} as const

function Preview({url, format}: {url: string; format: VariantFormat}) {
  return isVideoFormat(format) ? (
    <video src={url} controls preload="metadata" playsInline style={previewStyle} />
  ) : (
    <img src={url} loading="lazy" alt="" style={previewStyle} />
  )
}

function VariantCard({variant, onCopy}: {variant: VariantRow; onCopy: (url: string) => void}) {
  const label = VARIANTS[variant.variantId]?.label ?? variant.variantId
  const dims = variant.width && variant.height ? `${variant.width}×${variant.height}` : null
  return (
    <Card radius={2} shadow={1} overflow="hidden">
      <Stack space={3}>
        <Preview url={variant.url} format={variant.format} />
        <Box paddingX={3}>
          <Stack space={2}>
            <Text size={1} weight="semibold">
              {label}
            </Text>
            <Flex gap={2}>
              <Badge tone="primary" mode="outline" fontSize={0}>
                {variant.format.toUpperCase()}
              </Badge>
              {dims ? (
                <Badge tone="default" mode="outline" fontSize={0}>
                  {dims}
                </Badge>
              ) : null}
            </Flex>
          </Stack>
        </Box>
        <Flex gap={2} padding={3} paddingTop={2}>
          <Button
            fontSize={1}
            mode="ghost"
            icon={CopyIcon}
            text="Copy URL"
            onClick={() => onCopy(variant.url)}
          />
          <Button
            fontSize={1}
            mode="ghost"
            icon={LaunchIcon}
            text="Open"
            onClick={() => window.open(variant.url, '_blank', 'noopener,noreferrer')}
          />
        </Flex>
      </Stack>
    </Card>
  )
}

function VariantGroup({
  title,
  variants,
  onCopy,
}: {
  title: string
  variants: VariantRow[]
  onCopy: (url: string) => void
}) {
  return (
    <Stack space={3}>
      <Text size={1} weight="semibold" muted>
        {title}
      </Text>
      <Grid columns={[1, 2, 3]} gap={3}>
        {variants.map((v) => (
          <VariantCard key={v._key ?? v.variantId} variant={v} onCopy={onCopy} />
        ))}
      </Grid>
    </Stack>
  )
}

function LiveTransform({cloudName, publicId}: {cloudName: string; publicId: string}) {
  // Registry-consistent defaults: adaptive format/quality + a fixed-gravity crop.
  // Never g_auto — content-aware gravity needs Cloudinary's paid AI add-on.
  const [transform, setTransform] = useState('f_auto,q_auto,w_640,h_640,c_fill,g_center')
  const url = `https://res.cloudinary.com/${cloudName}/video/upload/${transform}/${publicId}.mp4`
  return (
    <Card padding={4} radius={2} border tone="transparent">
      <Stack space={4}>
        <Stack space={2}>
          <Text size={1} weight="semibold">
            Try a transform
          </Text>
          <Text size={1} muted>
            Cloudinary derives this on the fly from the same source asset — no re-render. Edit the
            transformation string to preview live.
          </Text>
        </Stack>
        <TextInput
          value={transform}
          onChange={(e) => setTransform(e.currentTarget.value)}
          fontSize={1}
        />
        <Box style={{maxWidth: 420}}>
          <video key={url} src={url} controls preload="metadata" playsInline style={previewStyle} />
        </Box>
        <Code size={0}>{url}</Code>
      </Stack>
    </Card>
  )
}

export const VariantViewer: UserViewComponent = ({document}) => {
  const toast = useToast()
  const doc = document.displayed as unknown as VideoDoc
  const variants = useMemo(() => doc.variants ?? [], [doc.variants])
  const cloudName = useMemo(
    () => cloudNameFromUrl(doc.cloudinaryUrl) ?? cloudNameFromUrl(variants[0]?.url),
    [doc.cloudinaryUrl, variants],
  )

  const copy = (url: string) => {
    navigator.clipboard?.writeText(url).then(
      () => toast.push({status: 'success', title: 'URL copied'}),
      () => toast.push({status: 'error', title: 'Could not copy URL'}),
    )
  }

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
          <Text>Variants appear once the render completes. Current status: {doc.status}.</Text>
        </Card>
      </Box>
    )
  }

  if (!variants.length) {
    return (
      <Box padding={4}>
        <Card tone="transparent" padding={4} radius={2} border>
          <Text muted>No Cloudinary variants recorded for this render.</Text>
        </Card>
      </Box>
    )
  }

  const site = variants.filter((v) => v.surface === 'site')
  const other = variants.filter((v) => v.surface !== 'site')

  return (
    <Box padding={4}>
      <Stack space={5}>
        <Card tone="primary" padding={4} radius={2}>
          <Stack space={3}>
            <Text size={3} weight="bold">
              1 render → {variants.length} Cloudinary derivations, zero re-renders
            </Text>
            <Text size={1}>
              Every tile is a pure Cloudinary delivery-URL transform of one canonical MP4.
            </Text>
            {doc.cloudinaryPublicId ? (
              <Text size={1} muted>
                Source: <Code size={0}>{doc.cloudinaryPublicId}</Code>
              </Text>
            ) : null}
          </Stack>
        </Card>

        {site.length ? <VariantGroup title="Site delivery" variants={site} onCopy={copy} /> : null}
        {other.length ? (
          <VariantGroup title="Long-form formats" variants={other} onCopy={copy} />
        ) : null}

        {doc.cloudinaryPublicId && cloudName ? (
          <LiveTransform cloudName={cloudName} publicId={doc.cloudinaryPublicId} />
        ) : null}
      </Stack>
    </Box>
  )
}

export default VariantViewer
