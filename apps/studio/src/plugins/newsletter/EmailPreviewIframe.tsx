import {useEffect, useState} from 'react'
import {Box, Flex, Spinner, Text} from '@sanity/ui'

// Loads a server-rendered email preview into an iframe WITHOUT putting the
// editor's Sanity token in a URL. We fetch() the route with the token in an
// Authorization header (validated server-side as a write-capable project member)
// and inject the returned HTML via `srcDoc`. The old approach passed a shared
// secret as a `?secret=` query param — that secret was bundled into the Studio's
// client JS and leaked into request logs/history; this avoids both.
export function EmailPreviewIframe({
  url,
  token,
  title,
}: {
  url: string
  token: string | undefined
  title: string
}) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('No Sanity session token available — sign in again.')
      return
    }
    let cancelled = false
    setHtml(null)
    setError(null)
    fetch(url, {headers: {Authorization: `Bearer ${token}`}})
      .then(async (res) => {
        const text = await res.text()
        if (cancelled) return
        if (res.ok) {
          setHtml(text)
          return
        }
        // Error bodies are JSON ({error}); fall back to raw text.
        let message = res.statusText
        try {
          message = (JSON.parse(text) as {error?: string}).error ?? text
        } catch {
          if (text) message = text
        }
        setError(message)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Network error')
      })
    return () => {
      cancelled = true
    }
  }, [url, token])

  if (error) {
    return (
      <Box padding={4}>
        <Text>{error}</Text>
      </Box>
    )
  }

  if (html === null) {
    return (
      <Flex align="center" justify="center" style={{height: '70vh'}}>
        <Spinner muted />
      </Flex>
    )
  }

  return (
    <Box style={{height: '70vh'}}>
      <iframe srcDoc={html} style={{width: '100%', height: '100%', border: 0}} title={title} />
    </Box>
  )
}
