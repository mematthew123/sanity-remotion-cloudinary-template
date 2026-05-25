import {useState} from 'react'
import {SanityApp, type SanityConfig} from '@sanity/sdk-react'
import {ThemeProvider, Flex, Spinner, Text, Stack} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import type {DocumentHandle} from '@sanity/sdk-react'
import {COLORS, fonts} from '@template/video-core'
import {PostList} from './components/PostList'
import {VideoEditor} from './components/VideoEditor'

const theme = buildTheme()

// Project + dataset come from the environment only (no hardcoded fallbacks).
// The App SDK inlines these SANITY_APP_* values at build time.
const PROJECT_ID = process.env.SANITY_APP_PROJECT_ID
const DATASET = process.env.SANITY_APP_DATASET

const config: SanityConfig[] = [
  {
    projectId: PROJECT_ID,
    dataset: DATASET,
  },
]

function Loading({label}: {label: string}) {
  return (
    <Flex align="center" justify="center" height="fill" style={{minHeight: '100dvh'}}>
      <Stack space={4} style={{alignItems: 'center'}}>
        <Spinner muted />
        <Text muted size={1}>
          {label}
        </Text>
      </Stack>
    </Flex>
  )
}

function VideoApp() {
  // Selection is the one piece of genuinely local UI state (which post the
  // editor targets). Document content itself is read/written via App SDK hooks.
  const [selected, setSelected] = useState<DocumentHandle | null>(null)

  return (
    <Flex
      direction="column"
      style={{
        height: '100dvh',
        backgroundColor: COLORS.background,
        fontFamily: fonts.body,
      }}
    >
      {/* Top bar */}
      <Flex
        align="center"
        justify="space-between"
        paddingX={4}
        style={{
          height: 56,
          flex: 'none',
          backgroundColor: COLORS.foreground,
          borderBottom: `3px solid ${COLORS.foreground}`,
        }}
      >
        <Flex align="center" gap={3}>
          <span
            style={{
              fontFamily: fonts.mono,
              fontWeight: 800,
              fontSize: 20,
              color: COLORS.accent,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Video
          </span>
          <span
            style={{
              fontFamily: fonts.mono,
              fontWeight: 700,
              fontSize: 11,
              color: COLORS.highlight,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              padding: '4px 8px',
              border: `2px solid ${COLORS.highlight}`,
            }}
          >
            Editor
          </span>
        </Flex>
        <span
          style={{
            fontFamily: fonts.body,
            fontSize: 13,
            color: COLORS.muted,
          }}
        >
          Preview and render videos from your posts
        </span>
      </Flex>

      {/* Main layout: left post list, main editor */}
      <Flex flex={1} style={{overflow: 'hidden'}}>
        <aside
          style={{
            width: 360,
            flex: 'none',
            borderRight: `3px solid ${COLORS.foreground}`,
            backgroundColor: COLORS.background,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <PostList selected={selected} onSelect={setSelected} />
        </aside>

        <main style={{flex: 1, overflow: 'hidden'}}>
          <VideoEditor handle={selected} />
        </main>
      </Flex>
    </Flex>
  )
}

export default function App() {
  if (!PROJECT_ID || !DATASET) {
    return (
      <ThemeProvider theme={theme}>
        <Flex align="center" justify="center" height="fill" style={{minHeight: '100dvh'}} padding={5}>
          <Stack space={3} style={{maxWidth: 420, textAlign: 'center'}}>
            <Text weight="semibold">Missing configuration</Text>
            <Text muted size={1}>
              Set SANITY_APP_PROJECT_ID and SANITY_APP_DATASET (see .env.example) and restart the dev
              server.
            </Text>
          </Stack>
        </Flex>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <SanityApp config={config} fallback={<Loading label="Loading video editor…" />}>
        <VideoApp />
      </SanityApp>
    </ThemeProvider>
  )
}
