import React, {useState} from 'react'
import {useCloudinaryFolders} from '../hooks/useCloudinaryApi'
import type {CloudinaryFolder} from '../types'

interface FolderTreeProps {
  onSelectFolder: (path: string) => void
  selectedFolder: string
}

function FolderItem({
  folder,
  onSelect,
  selectedFolder,
}: {
  folder: CloudinaryFolder
  onSelect: (path: string) => void
  selectedFolder: string
}) {
  const [expanded, setExpanded] = useState(false)
  const isSelected = selectedFolder === folder.path

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            fontSize: 10,
            color: '#666',
            flexShrink: 0,
          }}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <button
          onClick={() => onSelect(folder.path)}
          style={{
            background: isSelected ? '#e8f0fe' : 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
            fontSize: 13,
            color: isSelected ? '#1a73e8' : '#333',
            fontWeight: isSelected ? 600 : 400,
            textAlign: 'left',
            flex: 1,
            borderRadius: 4,
          }}
        >
          {folder.name}
        </button>
      </div>
      {expanded && (
        <div style={{paddingLeft: 16}}>
          <SubFolders parentPath={folder.path} onSelect={onSelect} selectedFolder={selectedFolder} />
        </div>
      )}
    </div>
  )
}

function SubFolders({
  parentPath,
  onSelect,
  selectedFolder,
}: {
  parentPath: string
  onSelect: (path: string) => void
  selectedFolder: string
}) {
  const {folders, loading} = useCloudinaryFolders(parentPath)

  if (loading) {
    return <div style={{padding: '4px 8px', fontSize: 12, color: '#999'}}>Loading...</div>
  }

  if (folders.length === 0) {
    return (
      <div style={{padding: '4px 8px', fontSize: 12, color: '#999', fontStyle: 'italic'}}>
        No subfolders
      </div>
    )
  }

  return (
    <div>
      {folders.map((folder) => (
        <FolderItem
          key={folder.path}
          folder={folder}
          onSelect={onSelect}
          selectedFolder={selectedFolder}
        />
      ))}
    </div>
  )
}

export function FolderTree({onSelectFolder, selectedFolder}: FolderTreeProps) {
  const {folders, loading, error} = useCloudinaryFolders('')

  return (
    <div
      style={{
        borderBottom: '1px solid #e0e0e0',
        padding: '8px 0',
        maxHeight: 200,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px 6px',
        }}
      >
        <span style={{fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase'}}>
          Folders
        </span>
        {selectedFolder && (
          <button
            onClick={() => onSelectFolder('')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              color: '#1a73e8',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <div style={{padding: '8px 12px', fontSize: 12, color: '#999'}}>Loading folders...</div>
      )}
      {error && <div style={{padding: '8px 12px', fontSize: 12, color: '#d32f2f'}}>{error}</div>}

      <button
        onClick={() => onSelectFolder('')}
        style={{
          display: 'block',
          width: '100%',
          background: selectedFolder === '' ? '#e8f0fe' : 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 12px',
          fontSize: 13,
          color: selectedFolder === '' ? '#1a73e8' : '#333',
          fontWeight: selectedFolder === '' ? 600 : 400,
          textAlign: 'left',
        }}
      >
        All Assets
      </button>

      {folders.map((folder) => (
        <div key={folder.path} style={{paddingLeft: 8}}>
          <FolderItem folder={folder} onSelect={onSelectFolder} selectedFolder={selectedFolder} />
        </div>
      ))}
    </div>
  )
}
