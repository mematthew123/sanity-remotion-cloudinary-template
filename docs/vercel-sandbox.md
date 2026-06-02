# Vercel Sandbox (rendering backend)

Rendering runs in a [**Vercel Sandbox**](https://vercel.com/docs/functions/sandbox) — an ephemeral Linux VM that Vercel spins up on demand — via [`@remotion/vercel`](https://www.remotion.dev/docs/vercel/api). The Next.js render route (`apps/web/app/api/video/render/route.ts`) spawns a sandbox per render, runs the Remotion renderer inside it, stages the resulting MP4 in **Vercel Blob**, and uploads it to **Cloudinary** (the canonical store). The Vercel function itself carries no Chromium / compositor binary.

You do this once per Vercel project, then never touch it again — bumps to compositions or to Remotion get picked up automatically by the next deploy.

## 1. Install

The deps are already in `apps/web/package.json`: `@remotion/vercel`, `@vercel/sandbox`, `@vercel/blob`, and the Remotion CLI/renderer. `pnpm install` from the repo root is enough.

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

`vercel env pull` does two things at once: it gives the Sandbox SDK an OIDC token to authenticate with (per the [Vercel Sandbox quickstart](https://vercel.com/docs/sandbox/quickstart)), and it pulls `BLOB_READ_WRITE_TOKEN` from the connected Blob store.

```bash
vercel login                                # one-time
vercel link                                 # run from apps/web/; pick the deployed project
vercel env pull apps/web/.env.local         # writes BLOB_READ_WRITE_TOKEN + the Sandbox OIDC vars
```

After that, `pnpm dev:web` can spawn sandboxes and stage renders in Blob.

> First local render is slow (~30–90 s): the sandbox boots cold and the Remotion bundle is uploaded into it per request. Production renders skip this via the build-time snapshot below.

## 4. The build-time snapshot

`apps/web/vercel.json` overrides the build command to:

```
pnpm --filter @template/web vercel-build
```

which runs `next build && tsx scripts/create-snapshot.ts`. The snapshot script:

1. Spawns a fresh Vercel Sandbox.
2. Bundles the Remotion entry (`apps/web/remotion/index.ts`) with `remotion bundle`.
3. Uploads the bundle into the sandbox with `addBundleToSandbox`.
4. Takes a non-expiring sandbox snapshot.
5. Stores its id in `snapshot-cache/<VERCEL_DEPLOYMENT_ID>.json` on Vercel Blob.

At request time, `restore-snapshot.ts` reads that id and calls `Sandbox.create({source: {type: 'snapshot', snapshotId}})` — bringing sandbox boot down to ~seconds, with the Remotion bundle already inside.

Each deploy gets a new `VERCEL_DEPLOYMENT_ID`, so each deploy gets its own snapshot. Old snapshots stay in Blob until you delete them.

## 5. Render

With a Blob store connected and the project deployed, trigger a render from Studio (`Render Promo (1:1)` / `Render Teaser (9:16)` actions on a published `post`) or from the video editor app. The route:

1. `createSandbox()` (local) or `restoreSnapshot()` (Vercel) → returns a running sandbox.
2. (local only) `bundleRemotionProject(...)` + `addBundleToSandbox(...)`.
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
- The Vercel function calling into the sandbox itself can run up to 800 s; we cap the route at `maxDuration = 300`.
- Blob, function, and sandbox usage are all billed by Vercel. Enable [Vercel Spend Management](https://vercel.com/docs/accounts/spend-management) before exposing the render trigger publicly.

## Notes & tradeoffs

- **Public output, briefly.** Cloudinary needs a public URL to fetch the render; `access: 'public'` on `uploadToVercelBlob` provides one. The route deletes the Blob object right after Cloudinary uploads, so the public exposure is brief. If your security model can't tolerate that gap, buffer the MP4 into the Node process and stream it into Cloudinary instead.
- **Cloudinary is canonical.** Variants (`eagerTransformsFor`, `snapshotVariants`) all derive from the Cloudinary copy. Vercel Blob is staging only.

See [troubleshooting.md](./troubleshooting.md) for common Vercel Sandbox failure modes.
