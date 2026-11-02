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

**Locally you won't see this error** — with no `BLOB_READ_WRITE_TOKEN`, the route falls back to rendering with headless Chromium on your machine (set `LOCAL_RENDER=true` to force that path even when a Blob token is present). To use the Sandbox locally instead, pull a Blob token: `cd apps/web && vercel link && vercel env pull`.

## Render shows `failed` with no obvious error

The render route arms a **soft timeout** at `maxDuration - 80` seconds (~720 s) in `apps/web/app/api/video/render/route.ts`. If a render runs past it, the route stops waiting, patches the `video` doc to `status: failed` with an `errorMessage` noting the timeout, and releases the sandbox. A render that silently lands on `failed` has most likely hit this — narrated renders (the longest) are the usual culprits. Fix: shorten the post body, switch to a faster ElevenLabs voice (Flash/Turbo), or render the narrated composition on a Vercel deploy rather than a slower local machine.

## `Remotion requires React.createContext` / Turbopack export errors

Something imported the `@template/video-core` **barrel** into a server route or the Studio. Server route + Studio schema must import `@template/video-core/registry` (React-free). Only `apps/web/remotion/Root.tsx` may import the barrel. See [architecture.md](./architecture.md#the-react-free-registry-boundary).

## `react` / `react-dom` peer warnings on install

Pinned to a single version via `pnpm.overrides` in the root `package.json`. If warnings reappear after a dependency bump, align `react` and `react-dom` to the same exact version there.

## Render fails with `No sandbox snapshot found`

The render route resumes a sandbox from a snapshot id stored in Vercel Blob during the build. If it's missing, the build step didn't run — confirm `apps/web/vercel.json`'s `buildCommand` is `cd ../.. && pnpm --filter @template/web vercel-build`, and that the Vercel build log shows a line like `[snapshot] saved: <id>`. If that line is missing, the snapshot script errored — scroll up in the build log for the cause (most often a missing `BLOB_READ_WRITE_TOKEN` at build time, meaning the Blob store isn't connected yet).

## First render after a deploy is slow

Each new deployment gets a new `VERCEL_DEPLOYMENT_ID`, so each gets its own snapshot. The first render after a deploy resumes that fresh snapshot (~seconds), but the very first request can still take ~10–15 s while Vercel warms the sandbox. Subsequent renders within the same deploy reuse the same warm snapshot.

## Cloudinary upload fails to fetch the Vercel Blob output

The route stages with `access: 'public'` so Cloudinary can fetch the Blob URL directly, then deletes the staging blob right after. If you see a Cloudinary fetch error before the delete step, double-check that the Blob store is the same one tied to `BLOB_READ_WRITE_TOKEN` and that the URL it returned is reachable from the public internet. The route deletes the Blob object after upload, so the public exposure is brief.

## Sandbox creation times out / hits concurrency limit

Vercel Sandbox concurrency is 10 on Hobby and 2000 on Pro/Enterprise. If renders block for a long time before starting, you're likely hitting the concurrency cap (each render holds a slot until `sandbox.stop()` runs in the `finally`). Set up [Vercel Spend Management](https://vercel.com/docs/accounts/spend-management) and either rate-limit the trigger or upgrade the plan.

## `/ask` returns 404 or the nav link is missing

Ask stays hidden until `SANITY_CONTEXT_TOKEN`, `SANITY_CONTEXT_ASSISTANT_URL`, `SANITY_CONTEXT_CATALOG_URL`, and a gateway credential (OIDC on Vercel, or `AI_GATEWAY_API_KEY`) are all set. The page is prerendered, so rebuild or redeploy after adding them. See [sanity-context.md](./sanity-context.md#setup).

## `/ask` says "Ask is unavailable right now."

The route couldn't connect to a Sanity Context endpoint. Check the server log for the `[ask] setup failed:` line:

- **`organizationAccessDenied` / "Not a member of this organization"**: an endpoint URL still has the `<org-id>` placeholder, or the token belongs to a different organization.
- **Token rejected**: `SANITY_CONTEXT_TOKEN` is a project token. Context endpoints only accept an **organization** token with **Context → Viewer**.

## `/ask` says "Something went wrong answering that."

The model call failed after setup. Check the server log for the `[ask] stream failed:` line. A **403** from the AI Gateway means the free tier, which doesn't serve Claude Haiku 4.5: top up paid credits under Vercel → AI. Locally, the `VERCEL_OIDC_TOKEN` from `vercel env pull` expires after 12 hours: re-pull it in `apps/web`, or set `AI_GATEWAY_API_KEY`.

## `/ask` says it has reached its monthly limit

The AI Gateway project budget is used up. Raise it, or wait for the monthly reset. See [plans-and-costs.md](./plans-and-costs.md#vercel-ai-gateway--optional-pay-per-question).

## Article links in `/ask` show as plain URLs instead of article rows

The blueprint's `SITE_URL` (in `apps/blueprint/.env`) doesn't match the web app's `NEXT_PUBLIC_SITE_URL`, so the links the model writes don't match the site's host. Make them the same origin and redeploy the blueprint.

## Blueprint deploy fails with a 404 or `plan limit for knowledge bases is reached`

- **404**: `SANITY_PROJECT_ID` is set in your shell or `.env`. The Blueprints CLI reads it as a scope override and points the org-scoped stack at the project. Use `CONTEXT_PROJECT_ID` (see `apps/blueprint/.env.example`) and unset the other.
- **Plan limit**: your organization's plan caps Knowledge Bases (some allow one). The template already shares one Knowledge Base between articles and docs; remove any other Knowledge Base in the organization or upgrade.
