import * as sanity from 'sanity'

// Pinned API version for all Studio-side client calls — keep document actions on
// one date so a Sanity API bump can't silently change their behavior.
const STUDIO_API_VERSION = '2024-12-27'

/**
 * The Studio's configured Sanity client. Wraps `useClient` with a fixed
 * apiVersion so callers import one hook instead of repeating the date at every
 * call site. Uses a namespace import because a named `{useClient}` import is
 * flagged deprecated (its zero-arg overload is) even though the apiVersion call
 * below is the supported one.
 */
export function useStudioClient() {
  return sanity.useClient({apiVersion: STUDIO_API_VERSION})
}

/**
 * The logged-in editor's Sanity session token. The render/voiceover routes
 * authenticate the interactive trigger with this token (validated server-side
 * as a write-capable project member) instead of a static secret bundled into
 * client JS.
 *
 */
export function useStudioUserToken(): string | undefined {
  const {token, projectId} = useStudioClient().config()
  if (token) return token
  if (typeof localStorage === 'undefined' || !projectId) return undefined
  try {
    const raw = localStorage.getItem(`__studio_auth_token_${projectId}`)
    return raw ? (JSON.parse(raw)?.token as string | undefined) : undefined
  } catch {
    return undefined
  }
}
