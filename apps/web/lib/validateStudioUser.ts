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

const SANITY_API = 'https://api.sanity.io/v2021-06-07'

// Default Sanity roles that grant no write access. Add custom read-only role
// names here if your project defines them.
const READ_ONLY_ROLES = new Set(['viewer'])

async function sanityGet<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${SANITY_API}${path}`, {
      headers: {Authorization: `Bearer ${token}`},
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

type Me = {id?: string}
type ProjectMember = {
  id?: string
  isRobot?: boolean
  role?: string
  roles?: {name?: string}[]
}
type Project = {members?: ProjectMember[]}

function roleNamesOf(member: ProjectMember): string[] {
  if (Array.isArray(member.roles) && member.roles.length > 0) {
    return member.roles.map((r) => r.name).filter((n): n is string => Boolean(n))
  }
  return member.role ? [member.role] : []
}

/**
 * True iff `userToken` belongs to a member of this project who holds at least
 * one write-granting role. A Sanity personal token is user-global, so this is
 * scoped to the project: a non-member's token yields 401/403 (→ null → false).
 */
async function isWriteCapableMember(userToken: string): Promise<boolean> {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  if (!projectId || !userToken) return false

  // 1. Resolve the caller's user id from their token. Non-2xx → not a real token.
  const me = await sanityGet<Me>('/users/me', userToken)
  if (!me?.id) return false

  // 2. Read the project with the SAME token. A non-member gets 401/403 → null.
  const project = await sanityGet<Project>(`/projects/${projectId}`, userToken)
  const member = project?.members?.find((m) => m.id === me.id)
  if (!member || member.isRobot) return false

  // 3. Require a non-empty role set with at least one write-granting role.
  const roles = roleNamesOf(member)
  return roles.length > 0 && roles.some((name) => !READ_ONLY_ROLES.has(name))
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
