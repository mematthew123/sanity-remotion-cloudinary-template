import React, {useState, useEffect, useRef} from 'react'
import {useCloudinarySearch} from '../hooks/useCloudinaryApi'
import {buildThumbnailUrl} from '../utils/cloudinaryUrl'
import {FolderTree} from './FolderTree'
import type {CloudinaryAsset} from '../types'

interface AssetBrowserProps {
  onSelect: (asset: CloudinaryAsset) => void
  selectedAssetId: string | null
}

const TYPE_FILTERS = [
  {id: '', label: 'All'},
  {id: 'image', label: 'Images'},
  {id: 'video', label: 'Videos'},
  {id: 'raw', label: 'Raw'},
] as const

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AssetBrowser({onSelect, selectedAssetId}: AssetBrowserProps) {
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [folder, setFolder] = useState('')
  const [cursor, setCursor] = useState<string | undefined>()
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const {resources, nextCursor, totalCount, loading, error} = useCloudinarySearch(
    query,
    resourceType,
    cursor,
    folder,
  )

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setCursor(undefined)
      setQuery(searchInput)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [searchInput])

  const handleTypeFilter = (type: string) => {
    setResourceType(type)
    setCursor(undefined)
  }

  const handleFolderSelect = (path: string) => {
    setFolder(path)
    setCursor(undefined)
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
      {/* Search */}
      <div style={{padding: '12px', borderBottom: '1px solid #e0e0e0'}}>
        <input
          type="text"
          placeholder="Search assets..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Type filters */}
      <div style={{display: 'flex', padding: '8px 12px', gap: 4, borderBottom: '1px solid #e0e0e0'}}>
        {TYPE_FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => handleTypeFilter(filter.id)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: resourceType === filter.id ? 600 : 400,
              border: '1px solid',
              borderColor: resourceType === filter.id ? '#1a73e8' : '#ccc',
              borderRadius: 12,
              background: resourceType === filter.id ? '#e8f0fe' : '#fff',
              color: resourceType === filter.id ? '#1a73e8' : '#555',
              cursor: 'pointer',
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Folder tree */}
      <FolderTree onSelectFolder={handleFolderSelect} selectedFolder={folder} />

      {/* Results count */}
      <div
        style={{
          padding: '6px 12px',
          fontSize: 11,
          color: '#888',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        {loading ? 'Searching...' : `${totalCount} assets found`}
        {folder && <span style={{marginLeft: 8, color: '#1a73e8'}}>in {folder}</span>}
      </div>

      {/* Error */}
      {error && <div style={{padding: '12px', color: '#d32f2f', fontSize: 13}}>{error}</div>}

      {/* Asset grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 8,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 8,
          alignContent: 'start',
        }}
      >
        {resources.map((asset) => (
          <AssetCard
            key={asset.public_id}
            asset={asset}
            isSelected={selectedAssetId === asset.public_id}
            onClick={() => onSelect(asset)}
          />
        ))}
      </div>

      {/* Load more */}
      {nextCursor && (
        <div style={{padding: '8px 12px', borderTop: '1px solid #e0e0e0'}}>
          <button
            onClick={() => setCursor(nextCursor)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: 4,
              background: '#fff',
              cursor: loading ? 'default' : 'pointer',
              fontSize: 12,
              color: '#555',
            }}
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}

function AssetCard({
  asset,
  isSelected,
  onClick,
}: {
  asset: CloudinaryAsset
  isSelected: boolean
  onClick: () => void
}) {
  const thumbUrl = buildThumbnailUrl(asset.public_id, asset.resource_type, 200)
  const typeBadgeColors: Record<string, {bg: string; text: string}> = {
    image: {bg: '#e8f5e9', text: '#2e7d32'},
    video: {bg: '#e3f2fd', text: '#1565c0'},
    raw: {bg: '#f3e5f5', text: '#7b1fa2'},
  }
  const badge = typeBadgeColors[asset.resource_type] || {bg: '#eee', text: '#666'}
  const filename = asset.public_id.split('/').pop() || asset.public_id

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: isSelected ? '2px solid #1a73e8' : '1px solid #e0e0e0',
        borderRadius: 6,
        overflow: 'hidden',
        cursor: 'pointer',
        background: isSelected ? '#e8f0fe' : '#fff',
        padding: 0,
        textAlign: 'left',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          backgroundColor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {asset.resource_type === 'raw' ? (
          <span style={{fontSize: 24, color: '#999'}}>FILE</span>
        ) : (
          <img
            src={thumbUrl}
            alt={filename}
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
            loading="lazy"
          />
        )}
      </div>

      {/* Info */}
      <div style={{padding: '6px 8px'}}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#333',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {filename}
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 4, marginTop: 4}}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: 3,
              background: badge.bg,
              color: badge.text,
              textTransform: 'uppercase',
            }}
          >
            {asset.resource_type}
          </span>
          <span style={{fontSize: 10, color: '#999'}}>{formatBytes(asset.bytes)}</span>
        </div>
        {asset.width && asset.height && (
          <div style={{fontSize: 10, color: '#aaa', marginTop: 2}}>
            {asset.width}×{asset.height}
          </div>
        )}
      </div>
    </button>
  )
}
