import {secureCompare} from './secureCompare'

// Shared request authorization for the editor-triggered routes (render +
// voiceover). The interactive trigger in the Studio sends the logged-in
// editor's own Sanity token; this module validates it server-side as a
// write-capable member of THIS project. A static VIDEO_RENDER_SECRET is still
// accepted as an optional server-to-server fallback (CI / automation), but it
// is no longer bundled into the Studio's client JS.
//
// Everything fails closed: any network error, non-2xx, or unexpected shape
// results in a rejected request.

const API_VERSION = 'v2021-06-07'

// Default Sanity roles that grant no write access. Add custom read-only role
// names here if your project defines them.
const READ_ONLY_ROLES = new Set(['viewer'])

// Opt-in diagnostics for debugging a 401 (set DEBUG_RENDER_AUTH=true). Silent
// otherwise. Never logs the token itself.
const DEBUG = process.env.DEBUG_RENDER_AUTH === 'true'
function debug(...args: unknown[]) {
  if (DEBUG) console.warn('[render-auth]', ...args)
}

// The current user as returned by the project-scoped `/users/me`: the caller's
// own roles in THIS project. `roles` is current; `role` is the legacy field.
type CurrentUser = {
  id?: string
  role?: string
  roles?: {name?: string}[]
}

function roleNamesOf(user: CurrentUser): string[] {
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return user.roles.map((r) => r.name).filter((n): n is string => Boolean(n))
  }
  return user.role ? [user.role] : []
}

/**
 * True iff `userToken` belongs to a member of this project who holds at least
 * one write-granting role.
 *
 * Validates against the PROJECT-scoped `/users/me` (`<projectId>.api.sanity.io`),
 * which returns the caller's own roles in this project and is callable by any
 * member about themselves. We deliberately avoid listing `/projects/<id>`
 * members — that needs the admin-only `sanity-project-members.read` permission,
 * so it would wrongly reject a plain Editor. A non-member's token yields 401
 * here (→ null → false). No separate/org token is required: we use the caller's
 * own token.
 */
async function isWriteCapableMember(userToken: string): Promise<boolean> {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  if (!projectId || !userToken) {
    debug('reject: missing', {hasProjectId: Boolean(projectId), hasToken: Boolean(userToken)})
    return false
  }

  let user: CurrentUser | null = null
  try {
    const res = await fetch(`https://${projectId}.api.sanity.io/${API_VERSION}/users/me`, {
      headers: {Authorization: `Bearer ${userToken}`},
    })
    if (!res.ok) {
      debug(`users/me → ${res.status} ${res.statusText}`, (await res.text()).slice(0, 300))
      return false
    }
    user = (await res.json()) as CurrentUser
  } catch (err) {
    debug('users/me threw', err instanceof Error ? err.message : err)
    return false
  }

  const roles = roleNamesOf(user)
  const ok = roles.length > 0 && roles.some((name) => !READ_ONLY_ROLES.has(name))
  debug('role check', {roles, ok})
  return ok
}

/**
 * Authorize an incoming request from the Studio. Accepts, in order:
 *  1. the static server-side secret (timing-safe), if one is configured, or
 *  2. a Sanity user token belonging to a write-capable project member.
 * Returns false when no Authorization header is present. The secret is optional:
 * when unset, only the user-token path is available.
 */
export async function authorizeStudioRequest(
  authHeader: string | null,
  secret: string | undefined,
): Promise<boolean> {
  if (!authHeader) return false

  // Server-to-server fallback: exact match against the static secret (if set).
  if (secret && secureCompare(authHeader, `Bearer ${secret}`)) return true

  // Otherwise treat the bearer value as the editor's Sanity token.
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token || token === authHeader) return false
  return isWriteCapableMember(token)
}
