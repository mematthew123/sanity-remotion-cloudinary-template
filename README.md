# Sanity + Remotion + Cloudinary video template

Render videos from your **Sanity** content with **Remotion**, then publish them to a **Next.js** site through **Cloudinary** — triggered with one click from the CMS.

Write a post in Sanity Studio, hit **Render**, and a few moments later an MP4 is rendered in a **Vercel Sandbox**, uploaded to Cloudinary, and playing on your site.

On top of that core loop the template ships the full showcase: a **Sanity App SDK** dashboard app (a video editor with a live Remotion preview), **Sanity Assist** AI copy generation backed by an editable brand-voice doc, and automatic **Cloudinary variants** (site + social derivatives) generated at render time. The Cloudinary integration is also surfaced inside the Studio as a **Variants** view on each `video` document (gallery + live transform preview). The minimal core (Studio document action → render → playback) still works on its own if you don't want the extras.

## How it works

```
Sanity Studio (post)
   │  click "Render Promo / Teaser"  (document action)
   ▼
POST /api/video/render  (Next.js route, bearer-authed)
   │  1. create a `video` doc  → status: rendering
   │  2. spawn a Vercel Sandbox (restored from a build-time snapshot in prod)
   │     and renderMediaOnVercel inside it
   │  3. uploadToVercelBlob → public URL → upload to Cloudinary → delete Blob copy
   │       → status: uploading
   │  4. patch the doc with cloudinaryUrl  → status: ready
   ▼
Next.js site
   reads `video` docs where status == "ready" and plays them from the Cloudinary URL
```

The render runs inside the sandbox synchronously, so the route returns the finished `cloudinaryUrl` in its response — the Studio action and video editor app are unchanged.

## Monorepo layout

```
apps/web/            @template/web        — Next.js 16 site + /api/video/render (spawns a Vercel Sandbox) + Remotion site entry
apps/studio/         @template/studio     — Sanity Studio v5: schemas, "Render" actions, Assist + brand voice
apps/video/          @template/video      — Sanity App SDK app: the video editor (live preview + render trigger)
packages/video-core/ @template/video-core — Remotion compositions, registry, Cloudinary variant catalog
```

**The React-free registry boundary.** `packages/video-core` exposes two entry points: the barrel `@template/video-core` (the actual Remotion components) and `@template/video-core/registry` (pure metadata — composition ids, dimensions, Zod schemas, no React). The server render route and the Sanity schema import only from `/registry`, so Remotion's render-time hooks never evaluate in a server or Studio bundle. Only `apps/web/remotion/Root.tsx` imports the barrel.

## Documentation

Deeper guides live in [`docs/`](./docs/):

- [Architecture](./docs/architecture.md) — pipeline, registry boundary, variant system
- [Configuration](./docs/configuration.md) — env prefixes, full env reference, the Sanity token
- [Vercel Sandbox](./docs/vercel-sandbox.md) — connecting a Blob store, the build-time snapshot, local dev
- [App SDK app](./docs/apps.md) — the video editor app, and deploying it
- [Assist + brand voice](./docs/assist.md) — AI field actions and the brand-voice doc
- [Troubleshooting](./docs/troubleshooting.md) — the common gotchas, with fixes

## Prerequisites

- Node 20+
- pnpm 10+
- A [Sanity](https://www.sanity.io/) project + dataset, and an **Editor** API token (write access)
- A Sanity **organization id** — required to run/deploy the App SDK app (`apps/video`). Find it in [sanity.io/manage](https://www.sanity.io/manage); skip if you only use the Studio + site.
- A [Cloudinary](https://cloudinary.com/) account (cloud name + API key/secret)
- A [Vercel](https://vercel.com/) account — deploy `apps/web` and connect a [Blob store](https://vercel.com/docs/storage/vercel-blob) for the sandbox renderer. See [docs/vercel-sandbox.md](./docs/vercel-sandbox.md)

## Setup

```bash
pnpm install

cp apps/web/.env.local.example apps/web/.env.local
cp apps/studio/.env.example apps/studio/.env
# App SDK app (optional — only if you use the dashboard app)
cp apps/video/.env.example apps/video/.env
```

Fill in the env files:

**`apps/web/.env.local`**

| Var | What |
| --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Sanity project id |
| `NEXT_PUBLIC_SANITY_DATASET` | dataset (e.g. `production`) |
| `SANITY_API_WRITE_TOKEN` | Editor+ token — the render route creates/updates `video` docs |
| `VIDEO_RENDER_SECRET` | any random string; the Studio must send this as a bearer token |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary credentials |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token — auto-injected on Vercel; for local dev, `vercel link && vercel env pull apps/web/.env.local`. See [docs/vercel-sandbox.md](./docs/vercel-sandbox.md). |

**`apps/studio/.env`**

| Var | What |
| --- | --- |
| `SANITY_STUDIO_PROJECT_ID` / `SANITY_STUDIO_DATASET` | same project/dataset as the web app |
| `SANITY_STUDIO_RENDER_API_URL` | `http://localhost:3000/api/video/render` locally |
| `SANITY_STUDIO_RENDER_SECRET` | **must equal** the web app's `VIDEO_RENDER_SECRET` |

**`apps/video/.env`** (App SDK app — env vars use the `SANITY_APP_` prefix)

| Var | What |
| --- | --- |
| `SANITY_APP_PROJECT_ID` / `SANITY_APP_DATASET` | same project/dataset |
| `SANITY_APP_ORGANIZATION_ID` | your Sanity organization id |
| `SANITY_APP_RENDER_API_URL` | (video app) full render URL, e.g. `http://localhost:3000/api/video/render` |
| `SANITY_APP_RENDER_SECRET` | (video app) **must equal** the web app's `VIDEO_RENDER_SECRET` |

> The render secret is one value you invent; mirror the **same** string into `VIDEO_RENDER_SECRET` (web), `SANITY_STUDIO_RENDER_SECRET` (studio), and `SANITY_APP_RENDER_SECRET` (video app).

## Run

```bash
pnpm dev:web        # http://localhost:3000
pnpm dev:studio     # http://localhost:3333
pnpm dev:video      # the video editor app (App SDK)      — needs SANITY_APP_ORGANIZATION_ID
```

Rendering runs in a Vercel Sandbox. The one-time setup is just *connect a Vercel Blob store to the deployed project*; the build-time snapshot is created automatically by `vercel-build`. Full walkthrough in [docs/vercel-sandbox.md](./docs/vercel-sandbox.md). For local dev, pull the same `BLOB_READ_WRITE_TOKEN`:

```bash
vercel link
vercel env pull apps/web/.env.local
```

Then:

1. In Studio, create an **Author**, then a **Post** (title, slug, author, excerpt, main image, body) and publish it.
2. Open the post and use the document action menu → **Render Promo (1:1)** or **Render Teaser (9:16)**.
3. Watch the **Videos** list: the new doc moves `rendering → uploading → ready`.
4. Visit `http://localhost:3000/posts/<slug>` — the video plays from Cloudinary. `/videos` lists every rendered video.

> Changing compositions or bumping Remotion just means redeploying — the build refreshes the snapshot every time.

## The dashboard app, Assist & Cloudinary variants

**Video editor app (`apps/video`).** A Sanity App SDK app: pick a post, choose a composition, watch a live `@remotion/player` preview, edit the `videoCopy` captions (which persist back to the post), and hit **Render**. It POSTs to the same `/api/video/render` route as the Studio action. Run with `pnpm dev:video`; deploy with `pnpm deploy:video` (requires `SANITY_APP_ORGANIZATION_ID` + a `sanity login`).

**Cloudinary in the Studio.** Each `video` document gains a **Variants** view (next to the form): a gallery of the Cloudinary derivatives generated at render time, plus an interactive transform preview — all from public delivery URLs, no secret in the Studio. See [docs/apps.md](docs/apps.md).

**Sanity Assist + brand voice.** The Studio adds two AI field actions — **Rewrite in brand voice** (on text fields) and **Generate video copy in brand voice** (on a post's `videoCopy` object). Both reference a `sanity.agentContext` doc surfaced in the Studio as **Brand Voice**. Bootstrap it once:

```bash
cd apps/studio && npx sanity exec ./scripts/seed-agent-context.ts --with-user-token
```

Then tune the voice by editing the **Brand Voice** doc in the Studio — that's the source of truth (the AI reads it live). The markdown + seed are only the initial bootstrap (`createIfNotExists`, won't overwrite Studio edits). No external API key is needed (Sanity-hosted AI), but the AI field actions call **Agent Actions** (Transform/Generate) — a **paid Growth-plan feature** that consumes usage — and require the schema to be deployed (`npx sanity schema deploy`). See [docs/assist.md](docs/assist.md).

**Cloudinary variants.** Each composition opts into a set of variants (site MP4/poster/preview-GIF + square/vertical social crops) in `packages/video-core/src/registry.ts`. At render time the route eager-generates them on Cloudinary and stores their URLs on `video.variants[]` — no extra Remotion renders. `variantUrl(cloudName, …)` takes the cloud name as a parameter, so `video-core` stays free of Cloudinary config.

## Deploy

Deploy `apps/web` to Vercel with the project root set to `apps/web` (the included `vercel.json` installs and builds from the monorepo root, including the build-time sandbox snapshot). In the Vercel dashboard, **Storage → Create → Blob** and attach the store to the project — `BLOB_READ_WRITE_TOKEN` is then auto-injected at runtime. Set the Function max duration to **300s** for `/api/video/render`, and add all `apps/web` env vars (Sanity, Cloudinary, render secret). Point `SANITY_STUDIO_RENDER_API_URL` (and `SANITY_APP_RENDER_API_URL`) at the deployed URL. Deploy the Studio with `pnpm deploy:studio`, and the App SDK app with `pnpm deploy:video` (needs `SANITY_APP_ORGANIZATION_ID` and a `sanity login`) — it then appears in your Sanity dashboard.

## ⚠️ Security note

The render secret (`SANITY_STUDIO_RENDER_SECRET` in the Studio, `SANITY_APP_RENDER_SECRET` in the video app) is bundled into client-side JavaScript — that's how the browser-side render trigger authenticates to the route. This is fine for local development or behind authentication, but **for a public production Studio/app it leaks the secret**. To harden: instead of a shared bearer token, proxy the render call through a route that authenticates the user's Sanity session, or move the trigger server-side (e.g. a Sanity webhook / scheduled function).

## Customizing

- **Add a composition:** create `packages/video-core/src/compositions/Foo.tsx`, register it in `COMPOSITIONS` (`registry.ts`) and `COMPOSITION_COMPONENTS` (`registry-components.ts`), export it from `index.ts`, then add a render action (or extend the existing ones) in `apps/studio/src/actions/renderVideo.tsx`. Locally, restart `pnpm dev:web` so the next render rebundles. On Vercel, redeploy — the build-time snapshot refreshes automatically.
- **Change the look:** edit the palette in `packages/video-core/src/types.ts` (`COLORS`) and the style helpers in `styles.ts`.
- **Change the source content:** the compositions render from `ArticleVideoProps` (`types.ts`). Adjust that schema, the `post` schema, and the field mapping in the Studio render action together.
