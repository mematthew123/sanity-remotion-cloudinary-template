import React, {useState} from 'react'
import type {CloudinaryAsset, TransformPreset} from '../types'
import {SOCIAL_PRESETS} from '../constants'
import {buildPresetUrl} from '../utils/cloudinaryUrl'
import {useTransformAsset} from '../hooks/useCloudinaryApi'

interface TransformPanelProps {
  asset: CloudinaryAsset | null
}

const GRAVITY_OPTIONS = [
  {value: 'center', label: 'Center'},
  {value: 'auto', label: 'Auto'},
  {value: 'face', label: 'Face'},
  {value: 'north', label: 'North'},
  {value: 'south', label: 'South'},
  {value: 'east', label: 'East'},
  {value: 'west', label: 'West'},
  {value: 'north_east', label: 'NE'},
  {value: 'north_west', label: 'NW'},
  {value: 'south_east', label: 'SE'},
  {value: 'south_west', label: 'SW'},
]

export function TransformPanel({asset}: TransformPanelProps) {
  const [selectedPreset, setSelectedPreset] = useState<TransformPreset | null>(null)
  const [gravity, setGravity] = useState('auto')
  const [copied, setCopied] = useState(false)
  const {transform, loading: saving, error: saveError, result: saveResult} = useTransformAsset()

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
        <span>Select an asset from the Assets tab to transform</span>
      </div>
    )
  }

  const activePreset = selectedPreset ? {...selectedPreset, gravity} : null

  const previewUrl = activePreset
    ? buildPresetUrl(asset.public_id, asset.resource_type, activePreset)
    : null

  const handleCopyUrl = () => {
    if (previewUrl) {
      navigator.clipboard.writeText(previewUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSaveVariant = async () => {
    if (!activePreset) return
    await transform(asset.public_id, asset.resource_type, {
      width: activePreset.width,
      height: activePreset.height,
      crop: activePreset.crop,
      gravity: activePreset.gravity,
    })
  }

  return (
    <div style={{display: 'flex', height: '100%', overflow: 'hidden'}}>
      {/* Left: Original + preset grid */}
      <div style={{width: 380, borderRight: '1px solid #e0e0e0', overflowY: 'auto', padding: 16}}>
        {/* Original preview */}
        <div style={{marginBottom: 16}}>
          <h3
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#888',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Original
          </h3>
          <div
            style={{
              backgroundColor: '#f5f5f5',
              borderRadius: 6,
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {asset.resource_type === 'video' ? (
              <video src={asset.secure_url} style={{maxWidth: '100%', maxHeight: 160, borderRadius: 4}} muted />
            ) : (
              <img
                src={asset.secure_url}
                alt={asset.public_id}
                style={{maxWidth: '100%', maxHeight: 160, borderRadius: 4}}
              />
            )}
          </div>
          <div style={{fontSize: 11, color: '#999', marginTop: 4, textAlign: 'center'}}>
            {asset.public_id.split('/').pop()} · {asset.width}×{asset.height}
          </div>
        </div>

        {/* Preset grid */}
        <h3
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#888',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Social Presets
        </h3>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8}}>
          {SOCIAL_PRESETS.map((preset) => {
            const thumbUrl = buildPresetUrl(asset.public_id, asset.resource_type, preset)
            const isActive = selectedPreset?.name === preset.name

            return (
              <button
                key={preset.name}
                onClick={() => setSelectedPreset(preset)}
                style={{
                  border: isActive ? '2px solid #1a73e8' : '1px solid #e0e0e0',
                  borderRadius: 6,
                  padding: 0,
                  cursor: 'pointer',
                  background: isActive ? '#e8f0fe' : '#fff',
                  overflow: 'hidden',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    aspectRatio: `${preset.width}/${preset.height}`,
                    maxHeight: 100,
                    backgroundColor: '#f5f5f5',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={thumbUrl}
                    alt={preset.label}
                    style={{width: '100%', height: '100%', objectFit: 'cover'}}
                    loading="lazy"
                  />
                </div>
                <div style={{padding: '6px 8px'}}>
                  <div style={{fontSize: 11, fontWeight: 600, color: '#333'}}>{preset.label}</div>
                  <div style={{fontSize: 10, color: '#999'}}>
                    {preset.width}×{preset.height}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: Selected preset preview + controls */}
      <div style={{flex: 1, overflowY: 'auto', padding: 20}}>
        {activePreset && previewUrl ? (
          <>
            <h3 style={{fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 4}}>
              {selectedPreset?.label}
            </h3>
            <p style={{fontSize: 12, color: '#888', marginBottom: 16}}>
              {activePreset.width}×{activePreset.height} · {activePreset.crop} · g_{gravity}
            </p>

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
              }}
            >
              {asset.resource_type === 'video' ? (
                <video
                  key={previewUrl}
                  src={previewUrl}
                  controls
                  style={{maxWidth: '100%', maxHeight: 500, borderRadius: 4}}
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={`${selectedPreset?.label} preview`}
                  style={{maxWidth: '100%', maxHeight: 500, borderRadius: 4}}
                />
              )}
            </div>

            {/* Gravity selector */}
            <div style={{marginBottom: 16}}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#666',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Gravity
              </label>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 4}}>
                {GRAVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGravity(opt.value)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      border: '1px solid',
                      borderColor: gravity === opt.value ? '#1a73e8' : '#ccc',
                      borderRadius: 4,
                      background: gravity === opt.value ? '#e8f0fe' : '#fff',
                      color: gravity === opt.value ? '#1a73e8' : '#555',
                      cursor: 'pointer',
                      fontWeight: gravity === opt.value ? 600 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
              <button
                onClick={handleCopyUrl}
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
                {copied ? 'Copied' : 'Copy URL'}
              </button>
              <button
                onClick={handleSaveVariant}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: saving ? '#ccc' : '#1a73e8',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save Variant'}
              </button>
              <a
                href={previewUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
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
                  textAlign: 'center',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Download
              </a>
            </div>

            {/* Save result */}
            {saveError && (
              <div
                style={{
                  padding: '10px 12px',
                  background: '#fce4ec',
                  color: '#c62828',
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 12,
                }}
              >
                {saveError}
              </div>
            )}
            {saveResult && (
              <div
                style={{
                  padding: '10px 12px',
                  background: '#e8f5e9',
                  color: '#2e7d32',
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 12,
                }}
              >
                <div style={{fontWeight: 600, marginBottom: 4}}>Variant saved</div>
                <a
                  href={saveResult.secure_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{color: '#1a73e8', wordBreak: 'break-all'}}
                >
                  {saveResult.secure_url}
                </a>
              </div>
            )}

            {/* Transform URL */}
            <div
              style={{
                padding: '10px 12px',
                background: '#f5f5f5',
                borderRadius: 6,
                fontSize: 11,
                color: '#666',
                wordBreak: 'break-all',
              }}
            >
              <div style={{fontWeight: 600, marginBottom: 4, color: '#888'}}>Transform URL</div>
              {previewUrl}
            </div>
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#aaa',
              fontSize: 14,
            }}
          >
            Select a preset to preview
          </div>
        )}
      </div>
    </div>
  )
}
