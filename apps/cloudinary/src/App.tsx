import React, {useState} from 'react'
import {SanityApp, type SanityConfig} from '@sanity/sdk-react'
import {ThemeProvider} from '@sanity/ui'
import {buildTheme} from '@sanity/ui/theme'
import {COLORS, fonts} from '@template/video-core'
import {VideoList} from './components/VideoList'
import {VideoDetail} from './components/VideoDetail'
import {SyncStatus} from './components/SyncStatus'
import {AssetBrowser} from './components/AssetBrowser'
import {AssetDetail} from './components/AssetDetail'
import {TransformPanel} from './components/TransformPanel'
import type {CloudinaryAsset} from './types'

const theme = buildTheme()

// Project + dataset come from SANITY_APP_* env vars (inlined at build time).
// See .env.example. Falls back to placeholders so the app still type-checks.
const config: SanityConfig[] = [
  {
    projectId: process.env.SANITY_APP_PROJECT_ID || 'your-project-id',
    dataset: process.env.SANITY_APP_DATASET || 'production',
  },
]

type Tab = 'assets' | 'transform' | 'videos' | 'sync'

const TABS: {id: Tab; label: string}[] = [
  {id: 'assets', label: 'Assets'},
  {id: 'transform', label: 'Transform'},
  {id: 'videos', label: 'Videos'},
  {id: 'sync', label: 'Sync Status'},
]

function CloudinaryApp() {
  const [activeTab, setActiveTab] = useState<Tab>('assets')
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<CloudinaryAsset | null>(null)

  const handleTransformAsset = () => {
    if (selectedAsset) setActiveTab('transform')
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        backgroundColor: COLORS.background,
        fontFamily: fonts.body,
      }}
    >
      {/* Top bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: 56,
          backgroundColor: COLORS.foreground,
          borderBottom: `3px solid ${COLORS.foreground}`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
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
            ASSETS
          </span>
          <span
            style={{
              fontFamily: fonts.mono,
              fontWeight: 700,
              fontSize: 12,
              color: COLORS.highlight,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              padding: '4px 8px',
              border: `2px solid ${COLORS.highlight}`,
            }}
          >
            Cloudinary
          </span>
        </div>

        {/* Tab switcher */}
        <div style={{display: 'flex', gap: 0}}>
          {TABS.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 16px',
                border: `2px solid ${COLORS.background}`,
                borderLeft: i > 0 ? 'none' : undefined,
                backgroundColor: activeTab === tab.id ? COLORS.background : 'transparent',
                color: activeTab === tab.id ? COLORS.foreground : COLORS.background,
                fontFamily: fonts.mono,
                fontWeight: 800,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{fontFamily: fonts.serif, fontStyle: 'italic', fontSize: 14, color: COLORS.muted}}>
          Manage assets & media
        </div>
      </header>

      {/* Main layout */}
      {activeTab === 'assets' ? (
        <div style={{display: 'flex', flex: 1, overflow: 'hidden'}}>
          <aside
            style={{
              width: 400,
              borderRight: `3px solid ${COLORS.foreground}`,
              backgroundColor: COLORS.background,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <AssetBrowser onSelect={setSelectedAsset} selectedAssetId={selectedAsset?.public_id ?? null} />
          </aside>
          <main style={{flex: 1, overflow: 'hidden'}}>
            <AssetDetail asset={selectedAsset} onTransform={handleTransformAsset} />
          </main>
        </div>
      ) : activeTab === 'transform' ? (
        <main style={{flex: 1, overflow: 'hidden'}}>
          <TransformPanel asset={selectedAsset} />
        </main>
      ) : activeTab === 'videos' ? (
        <div style={{display: 'flex', flex: 1, overflow: 'hidden'}}>
          <aside
            style={{
              width: 360,
              borderRight: `3px solid ${COLORS.foreground}`,
              backgroundColor: COLORS.background,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <VideoList onSelect={setSelectedVideoId} selectedId={selectedVideoId} />
          </aside>
          <main style={{flex: 1, overflow: 'hidden'}}>
            <VideoDetail videoId={selectedVideoId} />
          </main>
        </div>
      ) : (
        <main style={{flex: 1, overflow: 'hidden'}}>
          <SyncStatus />
        </main>
      )}
    </div>
  )
}

function AppLoading() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        backgroundColor: COLORS.foreground,
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div
        style={{
          fontFamily: fonts.mono,
          fontWeight: 800,
          fontSize: 32,
          color: COLORS.accent,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        ASSETS
      </div>
      <div
        style={{
          fontFamily: fonts.mono,
          fontSize: 14,
          color: COLORS.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Loading Cloudinary Manager...
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <SanityApp config={config} fallback={<AppLoading />}>
        <CloudinaryApp />
      </SanityApp>
    </ThemeProvider>
  )
}
