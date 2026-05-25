import React from 'react'
import type {CloudinaryAsset} from '../types'

interface AssetDetailProps {
  asset: CloudinaryAsset | null
  onTransform: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function InfoRow({label, value}: {label: string; value: string | React.ReactNode}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid #f0f0f0',
        fontSize: 13,
      }}
    >
      <span style={{color: '#888', fontWeight: 500}}>{label}</span>
      <span style={{color: '#333', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all'}}>
        {value}
      </span>
    </div>
  )
}

export function AssetDetail({asset, onTransform}: AssetDetailProps) {
  if (!asset) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#aaa',
          fontSize: 14,
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <span>Select an asset to view details</span>
      </div>
    )
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(asset.secure_url)
  }

  const cloudinaryUrl = `https://console.cloudinary.com/console/media_library/search/asset/${asset.resource_type}/upload/${asset.public_id}`

  return (
    <div style={{height: '100%', overflowY: 'auto', padding: 20}}>
      {/* Preview */}
      <div
        style={{
          backgroundColor: '#f5f5f5',
          borderRadius: 8,
          padding: 12,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
        }}
      >
        {asset.resource_type === 'video' ? (
          <video src={asset.secure_url} controls style={{maxWidth: '100%', maxHeight: 400, borderRadius: 4}} />
        ) : asset.resource_type === 'image' ? (
          <img
            src={asset.secure_url}
            alt={asset.public_id}
            style={{maxWidth: '100%', maxHeight: 400, borderRadius: 4}}
          />
        ) : (
          <div style={{textAlign: 'center', color: '#888'}}>
            <div style={{fontSize: 13}}>{asset.format?.toUpperCase()} file</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{display: 'flex', gap: 8, marginBottom: 20}}>
        <button
          onClick={onTransform}
          style={{
            flex: 1,
            padding: '10px',
            background: '#1a73e8',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Transform
        </button>
        <button
          onClick={copyUrl}
          style={{
            flex: 1,
            padding: '10px',
            background: '#fff',
            color: '#333',
            border: '1px solid #ccc',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Copy URL
        </button>
      </div>

      {/* Metadata */}
      <div>
        <h3
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#888',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Details
        </h3>
        <InfoRow label="Public ID" value={asset.public_id} />
        <InfoRow label="Type" value={asset.resource_type} />
        <InfoRow label="Format" value={asset.format?.toUpperCase()} />
        {asset.width && asset.height && (
          <InfoRow label="Dimensions" value={`${asset.width} × ${asset.height}`} />
        )}
        <InfoRow label="Size" value={formatBytes(asset.bytes)} />
        {asset.duration !== undefined && (
          <InfoRow label="Duration" value={`${asset.duration.toFixed(1)}s`} />
        )}
        {asset.folder && <InfoRow label="Folder" value={asset.folder} />}
        <InfoRow label="Created" value={formatDate(asset.created_at)} />
        {asset.tags && asset.tags.length > 0 && (
          <InfoRow
            label="Tags"
            value={
              <div style={{display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end'}}>
                {asset.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{fontSize: 10, padding: '2px 6px', background: '#f0f0f0', borderRadius: 3}}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            }
          />
        )}
      </div>

      {/* Open in Cloudinary */}
      <div style={{marginTop: 20}}>
        <a
          href={cloudinaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '10px',
            color: '#1a73e8',
            fontSize: 13,
            textDecoration: 'none',
            border: '1px solid #e0e0e0',
            borderRadius: 6,
          }}
        >
          Open in Cloudinary Console
        </a>
      </div>
    </div>
  )
}
