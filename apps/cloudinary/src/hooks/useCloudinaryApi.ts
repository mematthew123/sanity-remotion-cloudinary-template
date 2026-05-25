import {useState, useEffect, useCallback} from 'react'
import {API_BASE} from '../constants'
import type {CloudinaryAsset, CloudinaryFolder, SearchResponse, TransformResponse} from '../types'

export function useCloudinarySearch(
  query: string,
  resourceType: string,
  cursor?: string,
  folder?: string,
) {
  const [resources, setResources] = useState<CloudinaryAsset[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (query) params.set('query', query)
    if (resourceType) params.set('resource_type', resourceType)
    if (cursor) params.set('next_cursor', cursor)
    if (folder) params.set('folder', folder)
    params.set('max_results', '30')

    fetch(`${API_BASE}/api/cloudinary/search?${params}`)
      .then((res) => res.json())
      .then((data: SearchResponse & {error?: string}) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error)
        } else {
          if (cursor) {
            setResources((prev) => [...prev, ...data.resources])
          } else {
            setResources(data.resources)
          }
          setNextCursor(data.next_cursor)
          setTotalCount(data.total_count)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Search failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [query, resourceType, cursor, folder])

  return {resources, nextCursor, totalCount, loading, error}
}

export function useCloudinaryFolders(path: string) {
  const [folders, setFolders] = useState<CloudinaryFolder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (path) params.set('path', path)

    fetch(`${API_BASE}/api/cloudinary/folders?${params}`)
      .then((res) => res.json())
      .then((data: {folders: CloudinaryFolder[]; error?: string}) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error)
        } else {
          setFolders(data.folders)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load folders')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [path])

  return {folders, loading, error}
}

export function useCloudinaryAsset(publicId: string | null, resourceType: string) {
  const [asset, setAsset] = useState<CloudinaryAsset | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!publicId) {
      setAsset(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      public_id: publicId,
      resource_type: resourceType,
    })

    fetch(`${API_BASE}/api/cloudinary/asset?${params}`)
      .then((res) => res.json())
      .then((data: CloudinaryAsset & {error?: string}) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error as string)
        } else {
          setAsset(data)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load asset')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [publicId, resourceType])

  return {asset, loading, error}
}

export function useTransformAsset() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TransformResponse | null>(null)

  const transform = useCallback(
    async (publicId: string, resourceType: string, transformation: Record<string, unknown>) => {
      setLoading(true)
      setError(null)
      setResult(null)

      try {
        const res = await fetch(`${API_BASE}/api/cloudinary/transform`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            public_id: publicId,
            resource_type: resourceType,
            transformation,
          }),
        })
        const data = await res.json()
        if (data.error) {
          setError(data.error)
        } else {
          setResult(data)
        }
        return data
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transform failed'
        setError(msg)
        return {error: msg}
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return {transform, loading, error, result}
}
