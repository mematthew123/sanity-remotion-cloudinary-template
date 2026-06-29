# Vercel Sandbox (rendering backend)

The render route has **two backends**, picked at request time by `useLocalRender = !process.env.VERCEL && (LOCAL_RENDER === 'true' || !BLOB_READ_WRITE_TOKEN)` in `apps/web/app/api/video/render/route.ts`:

- **Vercel Sandbox** (default, and the only path on a Vercel deployment) — an ephemeral Linux VM Vercel spins up on demand, via [`@remotion/vercel`](https://www.remotion.dev/docs/vercel/api). The route spawns a sandbox per render, runs the Remotion renderer inside it, stages the MP4 in **Vercel Blob**, and uploads it to **Cloudinary** (the canonical store). The Vercel function itself carries no Chromium / compositor binary. **This page documents that path.**
- **Local fallback** — renders with headless Chromium *on your machine* (`@remotion/renderer`, `renderLocally()` in `helpers.ts`) and uploads straight to Cloudinary. No Sandbox, no Blob store. This is what lets you run the template with only Sanity + Cloudinary configured — see [§3 Local development](#3-local-development) and [plans-and-costs.md → Vercel](./plans-and-costs.md#vercel--only-for-the-hosted-deployment).

The Sandbox setup below is done once per Vercel project, then never touched again — bumps to compositions or to Remotion get picked up automatically by the next deploy. **Skip it entirely if you only render locally.**

## 1. Install

The deps are already in `apps/web/package.json`: `@remotion/vercel`, `@vercel/sandbox`, `@vercel/blob`, `@remotion/renderer` (the local-fallback renderer), and the Remotion CLI. `pnpm install` from the repo root is enough.

You also need the **Vercel CLI** installed on your machine — that's what generates the [OIDC token](https://vercel.com/docs/sandbox/concepts/authentication) the Sandbox SDK uses to authenticate from your laptop:

```bash
npm i -g vercel
```

On a Vercel deployment, OIDC auth is handled automatically — the CLI is only needed for local dev.

## 2. Connect a Vercel Blob store

The Blob store does two jobs:

- holds each render's MP4 briefly so Cloudinary can fetch it by URL, then it's deleted
- holds the sandbox **snapshot id** (a JSON blob keyed by `VERCEL_DEPLOYMENT_ID`) that the render route uses to skip cold-start setup

In your Vercel dashboard:

1. Open the project (project root `apps/web`).
2. **Storage → Create → Blob**, name it (e.g. `remotion-renders`), attach it to the project.
3. Redeploy once so Vercel injects `BLOB_READ_WRITE_TOKEN` into the runtime.

That's it for production — `BLOB_READ_WRITE_TOKEN` is auto-injected on Vercel; no manual env step.

## 3. Local development

**You don't need any of this to render locally.** With no `BLOB_READ_WRITE_TOKEN` in `apps/web/.env.local` (or with `LOCAL_RENDER=true`), the route renders with headless Chromium on your machine and uploads straight to Cloudinary — Chromium downloads once on the first render (~1 min, one-time). `pnpm dev:web` + Sanity + Cloudinary is a complete render loop with no Vercel account. The rest of this section is only for exercising the **Vercel Sandbox** path locally.

`vercel env pull` does two things at once: it gives the Sandbox SDK an OIDC token to authenticate with (per the [Vercel Sandbox quickstart](https://vercel.com/docs/sandbox/quickstart)), and it pulls `BLOB_READ_WRITE_TOKEN` from the connected Blob store.

> ⚠️ Run `vercel link` from **`apps/web/`**, not the repo root. The Vercel project root is `apps/web`, and the Next.js dev server only reads `apps/web/.env.local` — linking from the repo root drops the env file in the wrong place.

```bash
vercel login                  # one-time
cd apps/web
vercel link                   # pick the deployed project
vercel env pull               # writes apps/web/.env.local
```

After that, `pnpm dev:web` (from the repo root) can spawn sandboxes and stage renders in Blob.

> ⚠️ If `vercel env pull` only shows `VERCEL_OIDC_TOKEN` and nothing else, the Blob store from step 2 isn't connected yet. Vercel only injects `BLOB_READ_WRITE_TOKEN` once a Blob store is attached to the project — go back to **Storage → Create → Blob** and attach it, then re-run `vercel env pull`.

> First local render is slow (~30–90 s): the sandbox boots cold and the Remotion bundle is uploaded into it per request. Production renders skip this via the build-time snapshot below.

## 4. The build-time snapshot

`apps/web/vercel.json` overrides the build command to:

```
cd ../.. && pnpm --filter @template/web vercel-build
```

The `cd ../..` is required: Vercel runs the build from `apps/web/` (the project root), but the pnpm workspace filter must run from the monorepo root. The command then runs `next build && tsx scripts/create-snapshot.mts`. The snapshot script:

1. Spawns a fresh Vercel Sandbox.
2. Bundles the Remotion entry (`apps/web/remotion/index.ts`) with `remotion bundle`.
3. Uploads the bundle into the sandbox with `addBundleToSandbox`.
4. Takes a non-expiring sandbox snapshot.
5. Stores its id in `snapshot-cache/<VERCEL_DEPLOYMENT_ID>.json` on Vercel Blob.

At request time, `restore-snapshot.ts` reads that id and calls `Sandbox.create({source: {type: 'snapshot', snapshotId}})` — bringing sandbox boot down to ~seconds, with the Remotion bundle already inside.

Each deploy gets a new `VERCEL_DEPLOYMENT_ID`, so each deploy gets its own snapshot. Old snapshots stay in Blob until you delete them.

## 5. Render

With a Blob store connected and the project deployed, trigger a render from Studio (`Render Promo (1:1)` / `Render Teaser (9:16)` actions on a published `post`). On the **Sandbox path**, the route:

1. `createSandbox()` (local dev) or `restoreSnapshot()` (Vercel) → returns a running sandbox.
2. (local dev only) `bundleRemotionProject(...)` + `addBundleToSandbox(...)`.
3. `renderMediaOnVercel({sandbox, compositionId, inputProps, codec: 'h264'})` → renders inside the sandbox.
4. `uploadToVercelBlob({sandbox, ...})` → public URL on Vercel Blob.
5. `cloudinary.uploader.upload(blobUrl, {eager: …, eager_async: false})` → canonical MP4 + eager variants on Cloudinary.
6. `del(blobUrl)` → drops the Blob staging copy.
7. `sandbox.stop()` (`finally`) → releases the slot.

The route stays synchronous: callers get `status: 'ready'` + `cloudinaryUrl` back in the response.

## Keeping it in sync

- **Changed a composition?** Just deploy — `vercel-build` rebuilds the bundle and writes a fresh snapshot.
- **Bumped Remotion?** Same — the snapshot is rebuilt every deploy. Make sure all `@remotion/*` packages stay on the same version (see `apps/web/package.json` and `packages/video-core/package.json`).

## Limits & costs

- Vercel Sandbox concurrency: **10** simultaneous renders on Hobby, **2000** on Pro/Enterprise.
- Sandbox runtime: 45 min on Hobby, 5 h on Pro/Enterprise (this template stays well under).
- The Vercel function calling into the sandbox itself can run up to 800 s; the route is capped at `maxDuration = 800` (narrated renders take 5–7 min).
- Blob, function, and sandbox usage are all billed by Vercel. Enable [Vercel Spend Management](https://vercel.com/docs/accounts/spend-management) before exposing the render trigger publicly.

## Notes & tradeoffs

- **Public output, briefly.** Cloudinary needs a public URL to fetch the render; `access: 'public'` on `uploadToVercelBlob` provides one. The route deletes the Blob object right after Cloudinary uploads, so the public exposure is brief. If your security model can't tolerate that gap, buffer the MP4 into the Node process and stream it into Cloudinary instead.
- **Cloudinary is canonical.** Variants (`eagerTransformsFor`, `snapshotVariants`) all derive from the Cloudinary copy. Vercel Blob is staging only.

See [troubleshooting.md](./troubleshooting.md) for common Vercel Sandbox failure modes.
