# Sanity + Remotion + Cloudinary video template

Render videos from your **Sanity** content with **Remotion**, then publish them to a **Next.js** site through **Cloudinary** — triggered with one click from the CMS.

Write a post in Sanity Studio, hit **Render**, and a few moments later an MP4 is rendered in a **Vercel Sandbox**, uploaded to Cloudinary, and playing on your site.

On top of that core loop the template ships the full showcase: **Sanity Assist** AI copy generation backed by an editable brand-voice doc, and automatic **Cloudinary variants** (site derivatives) generated at render time. The Cloudinary integration is surfaced inside the Studio as a **Preview** view (a plain player of the canonical render) and a **Variants** view on each `video` document (gallery + live transform preview). The minimal core (Studio document action → render → playback) still works on its own if you don't want the extras.

## What's included

On top of the core render loop, the template ships three fanout surfaces, all driven by the one canonical render:

1. **Site — render once.** Studio render action → Vercel Sandbox → Cloudinary → site playback (promo + teaser compositions, site variants).
2. **Newsletter — fan out to email.** A Resend-backed `newsletter` doc that embeds the `site-preview-gif` variant as the email hero.
3. **Narrated — long-form TTS.** The `article-narrated` composition: ElevenLabs voiceover, computed duration, and the long-form variant family (YouTube 1080p, podcast MP3).

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

The render runs inside the sandbox synchronously, so the route returns the finished `cloudinaryUrl` in its response — the Studio action keeps reading `status: ready` straight from it. The finished render is previewed in a **Preview** view tab on the `video` document (a plain player of the canonical `cloudinaryUrl`); a **Variants** tab shows the Cloudinary derivations.

## Monorepo layout

pnpm workspaces, orchestrated with [Turborepo](https://turbo.build/) (`turbo.json`) —
`pnpm dev` runs both apps at once, and `build`/`lint`/`typegen` are cached.

```
apps/web/            @template/web        — Next.js 16 site + /api/video/render (spawns a Vercel Sandbox) + Remotion site entry
apps/studio/         @template/studio     — Sanity Studio v5: schemas, "Render" actions, Assist + brand voice
packages/video-core/ @template/video-core — Remotion compositions, registry, Cloudinary variant catalog
```

**The React-free registry boundary.** `packages/video-core` exposes two entry points: the barrel `@template/video-core` (the actual Remotion components) and `@template/video-core/registry` (pure metadata — composition ids, dimensions, Zod schemas, no React). The server render route and the Sanity schema import only from `/registry`, so Remotion's render-time hooks never evaluate in a server or Studio bundle. Only `apps/web/remotion/Root.tsx` imports the barrel.

## Documentation

Deeper guides live in [`docs/`](./docs/):

- [Architecture](./docs/architecture.md) — pipeline, registry boundary, variant system
- [Configuration](./docs/configuration.md) — env prefixes, full env reference, the Sanity token
- [Vercel Sandbox](./docs/vercel-sandbox.md) — connecting a Blob store, the build-time snapshot, local dev
- [Assist + brand voice](./docs/assist.md) — AI field actions and the brand-voice doc
- [Troubleshooting](./docs/troubleshooting.md) — the common gotchas, with fixes

## Prerequisites

- Node 20+
- pnpm 10+
- A [Sanity](https://www.sanity.io/) project + dataset, and an **Editor** API token (write access)
- A [Cloudinary](https://cloudinary.com/) account (cloud name + API key/secret)
- A [Vercel](https://vercel.com/) account — deploy `apps/web` and connect a [Blob store](https://vercel.com/docs/storage/vercel-blob) for the sandbox renderer. See [docs/vercel-sandbox.md](./docs/vercel-sandbox.md)

## Getting Started

Follow these steps to get the template running locally. (See [Prerequisites](#prerequisites) above for the accounts and tooling you'll need first.)

**1. Install dependencies and create your env files**

```bash
pnpm install

cp apps/web/.env.local.example apps/web/.env.local
cp apps/studio/.env.example apps/studio/.env
```

**2. Fill in the env files**

**`apps/web/.env.local`**

| Var | What |
| --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Sanity project id |
| `NEXT_PUBLIC_SANITY_DATASET` | dataset (e.g. `production`) |
| `SANITY_API_WRITE_TOKEN` | Editor+ token — the render route creates/updates `video` docs |
| `VIDEO_RENDER_SECRET` | any random string; the Studio must send this as a bearer token |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary credentials |
| `NEXT_PUBLIC_SITE_URL` | public origin, e.g. `https://renderonce.dev` (falls back to `http://localhost:3000`) — drives OG tags, sitemap, RSS |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token — auto-injected on Vercel; for local dev, `vercel link && vercel env pull apps/web/.env.local`. See [docs/vercel-sandbox.md](./docs/vercel-sandbox.md). |

> Newsletter (Resend) and narrated-video (ElevenLabs) features need a few more vars — and the custom-domain / verified-sender setup — see [docs/configuration.md](./docs/configuration.md#custom-domain--resend-sender).

**`apps/studio/.env`**

| Var | What |
| --- | --- |
| `SANITY_STUDIO_PROJECT_ID` / `SANITY_STUDIO_DATASET` | same project/dataset as the web app |
| `SANITY_STUDIO_RENDER_API_URL` | `http://localhost:3000/api/video/render` locally; `https://renderonce.dev/api/video/render` in production |
| `SANITY_STUDIO_RENDER_SECRET` | **must equal** the web app's `VIDEO_RENDER_SECRET` |
| `SANITY_STUDIO_ENABLE_NARRATED` | optional; `true` enables the paid ElevenLabs-backed narrated composition (default off) |

> The render secret is one value you invent; mirror the **same** string into `VIDEO_RENDER_SECRET` (web) and `SANITY_STUDIO_RENDER_SECRET` (studio).

> **Two features lean on paid third-party plans** — Sanity Assist (Growth plan, for the Brand AI menu) and narrated video (ElevenLabs). Both are handled so a free-tier clone never hits a confusing failure: Assist stays visible but fails with an explanatory toast, and narrated video is hidden until you set `SANITY_STUDIO_ENABLE_NARRATED=true`. See [docs/configuration.md → Optional / paid features](./docs/configuration.md#optional--paid-features). For what *every* service costs — including the Vercel Pro requirement — see [docs/plans-and-costs.md](./docs/plans-and-costs.md).

**3. Run the apps**

```bash
pnpm dev            # both apps at once (Turborepo) — site :3000 + studio :3333
```

Or run them individually: `pnpm dev:web` (http://localhost:3000) and
`pnpm dev:studio` (http://localhost:3333).

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

## Studio views, Assist & Cloudinary variants

**Cloudinary in the Studio.** Each `video` document gains a **Preview** view (a plain player of the canonical `cloudinaryUrl`) and a **Variants** view: a gallery of the Cloudinary derivatives generated at render time, plus an interactive transform preview — all from public delivery URLs, no secret in the Studio.

**Sanity Assist + brand voice.** The Studio adds two AI field actions — **Rewrite in brand voice** (on text fields) and **Generate video copy in brand voice** (on a post's `videoCopy` object). Both reference a `sanity.agentContext` doc surfaced in the Studio as **Brand Voice**. Bootstrap it once:

```bash
cd apps/studio && npx sanity exec ./scripts/seed-agent-context.ts --with-user-token
```

Then tune the voice by editing the **Brand Voice** doc in the Studio — that's the source of truth (the AI reads it live). The markdown + seed are only the initial bootstrap (`createIfNotExists`, won't overwrite Studio edits). No external API key is needed (Sanity-hosted AI), but the AI field actions call **Agent Actions** (Transform/Generate) — a **paid Growth-plan feature** that consumes usage — and require the schema to be deployed (`npx sanity schema deploy`). See [docs/assist.md](docs/assist.md).

**Cloudinary variants.** Each composition opts into a set of variants (site MP4/poster/preview-GIF, plus the long-form family — YouTube 1080p and podcast MP3 — for the narrated composition) in `packages/video-core/src/registry.ts`. At render time the route eager-generates them on Cloudinary and stores their URLs on `video.variants[]` — no extra Remotion renders. `variantUrl(cloudName, …)` takes the cloud name as a parameter, so `video-core` stays free of Cloudinary config.

## Deploy

Deploy `apps/web` to Vercel with the project root set to `apps/web` (the included `vercel.json` installs and builds from the monorepo root, including the build-time sandbox snapshot). In the Vercel dashboard, **Storage → Create → Blob** and attach the store to the project — `BLOB_READ_WRITE_TOKEN` is then auto-injected at runtime. Set the Function max duration to **800s** for `/api/video/render`, and add all `apps/web` env vars (Sanity, Cloudinary, render secret). Point `SANITY_STUDIO_RENDER_API_URL` at the deployed URL. Deploy the Studio with `pnpm deploy:studio`.

## ⚠️ Security note

The render secret (`SANITY_STUDIO_RENDER_SECRET` in the Studio) is bundled into client-side JavaScript — that's how the browser-side render trigger authenticates to the route. This is fine for local development or behind authentication, but **for a public production Studio it leaks the secret**. To harden: instead of a shared bearer token, proxy the render call through a route that authenticates the user's Sanity session, or move the trigger server-side (e.g. a Sanity webhook / scheduled function).

## Customizing

- **Add a composition:** create `packages/video-core/src/compositions/Foo.tsx`, register it in `COMPOSITIONS` (`registry.ts`) and `COMPOSITION_COMPONENTS` (`registry-components.ts`), export it from `index.ts`, then add a render action (or extend the existing ones) in `apps/studio/src/actions/renderVideo.tsx`. Locally, restart `pnpm dev:web` so the next render rebundles. On Vercel, redeploy — the build-time snapshot refreshes automatically.
- **Change the look:** edit the palette in `packages/video-core/src/types.ts` (`COLORS`) and the style helpers in `styles.ts`.
- **Change the source content:** the compositions render from `ArticleVideoProps` (`types.ts`). Adjust that schema, the `post` schema, and the field mapping in the Studio render action together.
