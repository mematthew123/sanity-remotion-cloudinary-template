# Troubleshooting

Real issues you're likely to hit, with the actual fix.

## Render returns 401 `Session not found`

```json
{"errorCode":"SIO-401-ANF","error":"Unauthorized","message":"Session not found"}
```

`SANITY_API_WRITE_TOKEN` isn't a valid Sanity API token (a name, a partial paste, or some other credential). Create a real one at **Manage → project → API → Tokens** (role **Editor**). Verify:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://<projectId>.api.sanity.io/v2024-01-01/data/query/<dataset>?query=count(*)"
```

## Render returns 401 `projectUserNotFoundError`

```json
{"type":"projectUserNotFoundError","description":"project user not found for user ID \"…\" in project \"…\""}
```

The token authenticates but its identity **isn't a member of this project** — typically a personal, CLI, or org-admin token. Fix: create the token **from that project's** API → Tokens screen (which mints a project robot member with the chosen role), not from elsewhere. The same value must pass the `count(*)` check above.

## Site shows no content / queries return nothing

The web client reads published content with **no token**, which requires a **public** dataset. Either make the dataset public (Manage → API → Datasets) or add a read token to `apps/web/lib/sanity.client.ts`.

## A variant URL returns 400

Video crops using `g_auto` (content-aware gravity) require Cloudinary's AI add-on; without it the derived URL 400s (image crops are fine). If you add a video-crop variant in `video-core/src/registry.ts`, prefer `g_center` (or another fixed gravity) over `g_auto` unless your account has the add-on. Note: the `eager` upload array must use `raw_transformation` (not `transformation`) for raw transformation strings, or Cloudinary 400s with "Unknown transformation".

## Render returns `Vercel Sandbox not configured`

You only hit this on a **Vercel deployment** that has no Blob store: the deployed app always uses the Vercel Sandbox, which needs `BLOB_READ_WRITE_TOKEN`. Fix: connect a Blob store to the project (**Storage → Create → Blob**) — the var is auto-injected. Full walkthrough in [vercel-sandbox.md](./vercel-sandbox.md).

**Locally you won't see this error** — with no `BLOB_READ_WRITE_TOKEN`, the route falls back to rendering with headless Chromium on your machine (set `LOCAL_RENDER=true` to force that path even when a Blob token is present). To use the Sandbox locally instead, pull a Blob token: `vercel link && vercel env pull apps/web/.env.local`.

## `Remotion requires React.createContext` / Turbopack export errors

Something imported the `@template/video-core` **barrel** into a server route or the Studio. Server route + Studio schema must import `@template/video-core/registry` (React-free). Only `apps/web/remotion/Root.tsx` may import the barrel. See [architecture.md](./architecture.md#the-react-free-registry-boundary).

## `react` / `react-dom` peer warnings on install

Pinned to a single version via `pnpm.overrides` in the root `package.json`. If warnings reappear after a dependency bump, align `react` and `react-dom` to the same exact version there.

## Render fails with `No sandbox snapshot found`

The render route resumes a sandbox from a snapshot id stored in Vercel Blob during the build. If it's missing, the build step didn't run — confirm `apps/web/vercel.json`'s `buildCommand` is `pnpm --filter @template/web vercel-build`, and that the Vercel build log shows a line like `[snapshot] saved: <id>`. If that line is missing, the snapshot script errored — scroll up in the build log for the cause (most often a missing `BLOB_READ_WRITE_TOKEN` at build time, meaning the Blob store isn't connected yet).

## First render after a deploy is slow

Each new deployment gets a new `VERCEL_DEPLOYMENT_ID`, so each gets its own snapshot. The first render after a deploy resumes that fresh snapshot (~seconds), but the very first request can still take ~10–15 s while Vercel warms the sandbox. Subsequent renders within the same deploy reuse the same warm snapshot.

## Cloudinary upload fails to fetch the Vercel Blob output

The route stages with `access: 'public'` so Cloudinary can fetch the Blob URL directly, then deletes the staging blob right after. If you see a Cloudinary fetch error before the delete step, double-check that the Blob store is the same one tied to `BLOB_READ_WRITE_TOKEN` and that the URL it returned is reachable from the public internet. The route deletes the Blob object after upload, so the public exposure is brief.

## Sandbox creation times out / hits concurrency limit

Vercel Sandbox concurrency is 10 on Hobby and 2000 on Pro/Enterprise. If renders block for a long time before starting, you're likely hitting the concurrency cap (each render holds a slot until `sandbox.stop()` runs in the `finally`). Set up [Vercel Spend Management](https://vercel.com/docs/accounts/spend-management) and either rate-limit the trigger or upgrade the plan.
