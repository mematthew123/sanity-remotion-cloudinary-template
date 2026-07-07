# The apps

The workspace has two apps plus one shared package:

- **`apps/web`** (`@template/web`) — the Next.js site and the `/api/video/render` route.
- **`apps/studio`** (`@template/studio`) — the Sanity Studio: schemas, the "Render" document action, Assist + brand voice.

## `apps/web` — the site + render route

The Next.js site reads `video` docs where `status == "ready"` and plays them from Cloudinary (`apps/web/components/VideoPlayer.tsx`). It also hosts `/api/video/render` — the only server-side mutator — which renders a composition (in a **Vercel Sandbox**, or with **headless Chromium on the local machine** when no Blob store is configured), uploads to Cloudinary, and patches the `video` doc. See [architecture.md](./architecture.md) and [vercel-sandbox.md](./vercel-sandbox.md).

It also serves a **`/playground`** route (`apps/web/app/playground/page.tsx`) — an interactive Cloudinary transform explorer that demonstrates the variant system live, independent of any rendered video.

Run it locally with `pnpm dev:web` (http://localhost:3000).

## `apps/studio` — the editing surface

The Sanity Studio is where editors trigger and review renders:

- **Publish (auto-promo)** — the built-in Publish action is wrapped (`apps/studio/src/actions/autoPromoOnPublish.tsx`): when a post has **Auto-generate promo on publish** enabled, publishing fires a promo (1:1) render in the background. Render failures surface as a toast and never block the publish.
- **Render** — "Render" document actions on a published `post` POST `{compositionId, inputProps, postId}` to the render route, authenticated with the logged-in editor's Sanity session token (see [configuration.md → The render trigger's auth](./configuration.md#the-render-triggers-auth)), and show rendering/ready/error state.
- **Preview** — a "Preview" view tab on the `video` document plays the finished render.
- **Variants** — a "Variants" view tab on the `video` document shows the Cloudinary derivatives (a gallery of the generated variants plus a live transform preview, built entirely from public Cloudinary delivery URLs — no secret in the Studio). See [architecture.md](./architecture.md#the-cloudinary-variant-system).

Run it locally with `pnpm dev:studio` (http://localhost:3333).

## Cloudinary lives in the Studio (not a separate app)

There's no standalone Cloudinary app. The Cloudinary integration surfaces in two places the core template already owns: the **render pipeline** (upload + eager variants), and the **Variants** view on each `video` document described above.
