export interface CloudinaryAsset {
  public_id: string
  resource_type: 'image' | 'video' | 'raw'
  format: string
  secure_url: string
  url: string
  bytes: number
  width: number
  height: number
  created_at: string
  folder: string
  duration?: number
  tags?: string[]
  context?: Record<string, unknown>
}

export interface CloudinaryFolder {
  name: string
  path: string
}

export interface TransformPreset {
  name: string
  label: string
  width: number
  height: number
  crop: string
  gravity: string
  platform: string
}

export interface SearchResponse {
  resources: CloudinaryAsset[]
  next_cursor?: string
  total_count: number
}

export interface FoldersResponse {
  folders: CloudinaryFolder[]
}

export interface TransformResponse {
  url: string
  secure_url: string
  width?: number
  height?: number
  format?: string
}

/** Status states a `video` document moves through during a render. */
export type VideoStatus = 'rendering' | 'uploading' | 'ready' | 'failed'
