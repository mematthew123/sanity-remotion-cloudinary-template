# The apps

The workspace has three apps plus one shared package:

- **`apps/web`** (`@template/web`) — the Next.js site and the `/api/video/render` route.
- **`apps/studio`** (`@template/studio`) — the Sanity Studio: schemas, the "Render" document action, Assist + brand voice.
- **`apps/blueprint`** (`@template/blueprint`) — optional. A Sanity Blueprint declaring the Sanity Context Knowledge Base and MCP endpoints behind the site's `/ask` page.

## `apps/web` — the site + render route

The Next.js site reads `video` docs where `status == "ready"` and plays them from Cloudinary (`apps/web/components/VideoPlayer.tsx`). It also hosts `/api/video/render` — the only server-side mutator — which renders a composition (in a **Vercel Sandbox**, or with **headless Chromium on the local machine** when no Blob store is configured), uploads to Cloudinary, and patches the `video` doc. See [architecture.md](./architecture.md) and [vercel-sandbox.md](./vercel-sandbox.md).

It also serves a **`/playground`** route (`apps/web/app/playground/page.tsx`) — an interactive Cloudinary transform explorer that demonstrates the variant system live, independent of any rendered video. Every transform a visitor applies creates a derived asset on your Cloudinary account (counted against your transformation quota). If that's a concern on a public deployment, remove the route, or enable **Strict Transformations** in Cloudinary's security settings — and then allow the template's non-eager variants (e.g. `site-mp4`), which are generated on first request.

The optional **`/ask`** route (`apps/web/app/ask/page.tsx`, `apps/web/app/api/ask/route.ts`) answers visitor questions from Sanity Context: Claude Haiku 4.5 via the Vercel AI Gateway, reading a Knowledge Base for facts and a GROQ-mode endpoint for real post and video links. The page and its nav link return 404 / stay hidden until it's configured. See [sanity-context.md](./sanity-context.md).

Run it locally with `pnpm dev:web` (http://localhost:3000).

## `apps/studio` — the editing surface

The Sanity Studio is where editors trigger and review renders:

- **Publish (auto-promo)** — the built-in Publish action is wrapped (`apps/studio/src/actions/autoPromoOnPublish.tsx`): when a post has **Auto-generate promo on publish** enabled, publishing fires a promo (1:1) render in the background. Render failures surface as a toast and never block the publish.
- **Render** — "Render" document actions on a published `post` POST `{compositionId, inputProps, postId}` to the render route, authenticated with the logged-in editor's Sanity session token (see [configuration.md → The render trigger's auth](./configuration.md#the-render-triggers-auth)), and show rendering/ready/error state.
- **Preview** — a "Preview" view tab on the `video` document plays the finished render.
- **Variants** — a "Variants" view tab on the `video` document shows the Cloudinary derivatives (a gallery of the generated variants plus a live transform preview, built entirely from public Cloudinary delivery URLs — no secret in the Studio). See [architecture.md](./architecture.md#the-cloudinary-variant-system).

Run it locally with `pnpm dev:studio` (http://localhost:3333).

## `apps/blueprint` — Sanity Context as code (optional)

`apps/blueprint/sanity.blueprint.ts` declares an organization-scoped stack: the `site-knowledge` Knowledge Base, the `site-assistant` endpoint (Knowledge Base mode), and the `video-catalog` endpoint (GROQ mode over posts, authors, and ready videos). `pnpm --filter @template/blueprint docs:sync` imports the repo's Markdown docs into the Knowledge Base. It isn't part of `pnpm dev` or `pnpm build`; you deploy it yourself with the Blueprints CLI. Nothing in the render loop depends on it. See [sanity-context.md](./sanity-context.md).

## Cloudinary lives in the Studio (not a separate app)

There's no standalone Cloudinary app. The Cloudinary integration surfaces in two places the core template already owns: the **render pipeline** (upload + eager variants), and the **Variants** view on each `video` document described above.
