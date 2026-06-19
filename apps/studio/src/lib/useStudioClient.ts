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
