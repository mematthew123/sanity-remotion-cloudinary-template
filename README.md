# Sanity + Remotion + Cloudinary video template

Render videos from your **Sanity** content with **Remotion**, then publish them to a **Next.js** site through **Cloudinary** — triggered with one click from the CMS.

This is a minimal, production-shaped starter. Write a post in Sanity Studio, hit **Render**, and a few moments later an MP4 is rendered server-side, uploaded to Cloudinary, and playing on your site.

## How it works

```
Sanity Studio (post)
   │  click "Render Promo / Teaser"  (document action)
   ▼
POST /api/video/render  (Next.js route, bearer-authed)
   │  1. create a `video` doc  → status: rendering
   │  2. render the Remotion composition server-side
   │       (@remotion/renderer + @sparticuz/chromium on Vercel, system Chrome locally)
   │  3. upload the MP4 to Cloudinary  → status: uploading
   │  4. patch the doc with cloudinaryUrl  → status: ready
   ▼
Next.js site
   reads `video` docs where status == "ready" and plays them from the Cloudinary URL
```

## Monorepo layout

```
apps/web/            @template/web     — Next.js 16 site + the /api/video/render route + Remotion bundle
apps/studio/         @template/studio  — Sanity Studio v5 + the "Render" document actions
packages/video-core/ @template/video-core — Remotion compositions + a React-free composition registry
```

**The React-free registry boundary.** `packages/video-core` exposes two entry points: the barrel `@template/video-core` (the actual Remotion components) and `@template/video-core/registry` (pure metadata — composition ids, dimensions, Zod schemas, no React). The server render route and the Sanity schema import only from `/registry`, so Remotion's render-time hooks never evaluate in a server or Studio bundle. Only `apps/web/remotion/Root.tsx` imports the barrel.

## Prerequisites

- Node 20+
- pnpm 10+
- A [Sanity](https://www.sanity.io/) project + dataset, and a write token
- A [Cloudinary](https://cloudinary.com/) account (cloud name + API key/secret)

## Setup

```bash
pnpm install

cp apps/web/.env.local.example apps/web/.env.local
cp apps/studio/.env.example apps/studio/.env
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

**`apps/studio/.env`**

| Var | What |
| --- | --- |
| `SANITY_STUDIO_PROJECT_ID` / `SANITY_STUDIO_DATASET` | same project/dataset as the web app |
| `SANITY_STUDIO_RENDER_API_URL` | `http://localhost:3000/api/video/render` locally |
| `SANITY_STUDIO_RENDER_SECRET` | **must equal** the web app's `VIDEO_RENDER_SECRET` |

## Run

```bash
pnpm dev:web      # http://localhost:3000
pnpm dev:studio   # http://localhost:3333
```

Then:

1. In Studio, create an **Author**, then a **Post** (title, slug, author, excerpt, main image, body) and publish it.
2. Open the post and use the document action menu → **Render Promo (1:1)** or **Render Teaser (9:16)**.
3. Watch the **Videos** list: the new doc moves `rendering → uploading → ready`.
4. Visit `http://localhost:3000/posts/<slug>` — the video plays from Cloudinary. `/videos` lists every rendered video.

> The first local render downloads a headless Chrome the first time; subsequent renders are fast.

The Remotion bundle (`apps/web/.remotion-bundle/`) is produced by `pnpm build:remotion`, which also runs automatically before `next build`. The dev render route expects it to exist — run `pnpm build:remotion` once if you render in `dev`.

## Deploy

Deploy `apps/web` to Vercel with the project root set to `apps/web` (the included `vercel.json` installs and builds from the monorepo root). Set the Function max duration to **300s** for `/api/video/render`, and add all `apps/web` env vars. Point `SANITY_STUDIO_RENDER_API_URL` at the deployed URL. Deploy the Studio with `pnpm deploy:studio` (or host it anywhere).

## ⚠️ Security note

`SANITY_STUDIO_RENDER_SECRET` is bundled into the Studio's client-side JavaScript (that's how the browser-side document action authenticates to the render route). This is fine for local development or a Studio behind authentication, but **for a public production Studio it leaks the secret**. To harden: instead of a shared bearer token, proxy the render call through a route that authenticates the user's Sanity session, or move the trigger server-side (e.g. a Sanity webhook / scheduled function).

## Customizing

- **Add a composition:** create `packages/video-core/src/compositions/Foo.tsx`, register it in `COMPOSITIONS` (`registry.ts`) and `COMPOSITION_COMPONENTS` (`registry-components.ts`), export it from `index.ts`, then add a render action (or extend the existing ones) in `apps/studio/src/actions/renderVideo.tsx`. Rebuild the bundle with `pnpm build:remotion`.
- **Change the look:** edit the palette in `packages/video-core/src/types.ts` (`COLORS`) and the style helpers in `styles.ts`.
- **Change the source content:** the compositions render from `ArticleVideoProps` (`types.ts`). Adjust that schema, the `post` schema, and the field mapping in the Studio render action together.
