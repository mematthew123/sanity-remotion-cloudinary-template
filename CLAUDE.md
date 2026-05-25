# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root (pnpm workspaces with `pnpm@10.26.2`, Node 20+).

```bash
pnpm install

pnpm dev:web          # Next.js site               http://localhost:3000
pnpm dev:studio       # Sanity Studio              http://localhost:3333
pnpm dev:video        # Sanity App SDK app — video editor      (needs SANITY_APP_ORGANIZATION_ID)
pnpm dev:cloudinary   # Sanity App SDK app — Cloudinary asset  (needs SANITY_APP_ORGANIZATION_ID)

pnpm build            # = pnpm build:web (which runs build:remotion → next build)
pnpm build:remotion   # bundles Remotion compositions into apps/web/.remotion-bundle/
pnpm lint             # ESLint on apps/web

pnpm deploy:studio
pnpm deploy:video         # first run is INTERACTIVE — needs a TTY for the title prompt
pnpm deploy:cloudinary    # ditto; after first deploy the appId is pinned in sanity.cli.ts
```

Per-package scripts run via `pnpm --filter @template/<name> <script>` (names: `web`, `studio`, `video`, `cloudinary`, `video-core`). No test suite is wired up.

If the render route reports `Remotion bundle not found`, run `pnpm build:remotion`. `next build` runs it automatically; `next dev` does not.

## Architecture

Four apps + one shared package, all driven by a single server-side render pipeline.

```
Sanity Studio "Render" action  ─┐
Sanity App SDK video editor    ─┴──► POST /api/video/render (apps/web)
                                       1. validate inputProps with composition's Zod schema
                                       2. create `video` doc       (status: rendering)
                                       3. @remotion/renderer → MP4 in /tmp
                                       4. Cloudinary upload + eager variants  (status: uploading)
                                       5. patch doc cloudinaryUrl + variants[] (status: ready)
                                     ──► Next.js site reads ready video docs and plays them
```

The render route (`apps/web/app/api/video/render/route.ts`) is **the only server-side mutator** of Sanity content. Everything else (Studio, video editor app, site) triggers it or reads what it produced. That keeps `SANITY_API_WRITE_TOKEN` out of every client bundle.

### The React-free registry boundary (the load-bearing invariant)

`packages/video-core` has two entry points enforced by its `exports` field:

- `@template/video-core` — barrel exporting the Remotion components. Importing it evaluates Remotion hooks (`useCurrentFrame`, `loadFont`) at module load.
- `@template/video-core/registry` — pure metadata: composition ids, dimensions, Zod input schemas, the variant catalog. **No React.**

Rules:

- The render route and `apps/studio/src/schemaTypes/video.ts` must import only `@template/video-core/registry`. Pulling the barrel into a server route or Studio bundle breaks with "Remotion requires React.createContext" / Turbopack export errors.
- Only `apps/web/remotion/Root.tsx` (which runs inside the Remotion bundle) and the App SDK React apps may import the barrel.

### Cloudinary variants (no re-renders)

A variant is a Cloudinary *derivation* of the one canonical MP4. Defined in `packages/video-core/src/registry.ts`:

- `VARIANTS` — site (mp4/poster/gif) + social crops (1:1, 9:16) + a YouTube thumb.
- Each composition opts into a `variantIds[]` set. `eagerTransformsFor(ids)` → Cloudinary `eager` array (materialized at upload). `snapshotVariants(cloudName, publicId, ids)` → the `{variantId, surface, format, url, width, height}[]` written to `video.variants[]`.
- `variantUrl(cloudName, …)` takes the cloud name as a parameter so `video-core` never imports Cloudinary env. The render route passes `CLOUDINARY_CLOUD_NAME` in.

### Where rendered video surfaces

GROQ in `apps/web/lib/sanity.queries.ts`. A post's videos come from a **back-reference** subquery (`*[_type=="video" && post._ref==^._id && status=="ready" ...]`) — the render route never writes a `videos[]` array back onto the post. `components/VideoPlayer.tsx` plays `cloudinaryUrl` or a variant URL.

### Adding a composition

1. Create `packages/video-core/src/compositions/Foo.tsx`.
2. Register metadata in `registry.ts` (`COMPOSITIONS`) and the component in `registry-components.ts` (`COMPOSITION_COMPONENTS`); export from `index.ts`.
3. Add a render action (or extend existing) in `apps/studio/src/actions/renderVideo.tsx`.
4. `pnpm build:remotion` to rebuild the bundle.

### Source content shape

Compositions render from `ArticleVideoProps` (in `packages/video-core/src/types.ts`). To change the source content type you must change that Zod schema, the `post` schema (`apps/studio/src/schemaTypes/post.ts`), and the field mapping in the trigger (Studio action / video editor app) **together** — the render route itself is content-agnostic.

## Env: three prefixes, one shared secret

Each surface reads env differently — vars without the right prefix don't reach that surface's client bundle:

| Surface | File | Prefix |
| --- | --- | --- |
| Next.js web | `apps/web/.env.local` | `NEXT_PUBLIC_*` (client) + plain (server) |
| Sanity Studio (Vite) | `apps/studio/.env` | `SANITY_STUDIO_*` |
| App SDK apps | `apps/{video,cloudinary}/.env` | `SANITY_APP_*` |

`VIDEO_RENDER_SECRET` is a value you invent and **mirror identically** into three places: `VIDEO_RENDER_SECRET` (web), `SANITY_STUDIO_RENDER_SECRET` (studio), `SANITY_APP_RENDER_SECRET` (video app). It is bundled into the Studio/video-app client JS — fine for local/demo, but for public production you must move the trigger behind a session-authenticated proxy instead.

`SANITY_APP_*` vars are baked into the App SDK bundle **at build time**. A deployed app with `SANITY_APP_RENDER_API_URL=http://localhost:3000` will call the user's local machine — rebuild and redeploy after pointing it at the deployed web URL.

The site reads published content with **no token** (`useCdn: true`, `perspective: 'published'`) — requires a **public** dataset. If kept private, add a read token in `apps/web/lib/sanity.client.ts`. Writes always use the write token regardless.

## Sanity Assist + brand voice

Studio adds two AI field actions ("Rewrite in brand voice", "Generate video copy in brand voice") backed by a `sanity.agentContext` doc with id `brand-voice`. The voice content's source of truth is `apps/studio/brand-voice-instructions.md`. After editing it, reseed:

```bash
cd apps/studio && npx sanity exec ./scripts/seed-agent-context.ts --with-user-token
```

Do **not** edit the `brand-voice` doc directly in Studio — the next seed will overwrite it.

## Deploy specifics

- `apps/web` deploys to Vercel with project root set to `apps/web`. Set `/api/video/render` max duration to **300s**.
- Vercel functions hard-cap at 250 MB unzipped. This template uses **`@sparticuz/chromium-min`** (≈120 KB) instead of `@sparticuz/chromium` (≈64 MB) — Chromium downloads at runtime from `CHROMIUM_PACK_URL` (defaults to the matching Sparticuz GitHub release). If you bump `@sparticuz/chromium-min`, point `CHROMIUM_PACK_URL` at a pack of the same Chromium version.
- The Remotion Linux compositor binary **is** traced into the function via `outputFileTracingIncludes` in `apps/web/next.config.ts` — both `../../node_modules/@remotion/compositor-linux-x64-gnu/**/*` and `./node_modules/...` paths are listed to cover hoisted vs isolated pnpm layouts.
- App SDK first deploy is interactive (free-text title prompt; `-y` won't answer it). After the first run, pin `deployment.appId` in the app's `sanity.cli.ts` — subsequent deploys are non-interactive.

## React version pinning

`react` and `react-dom` are pinned via `pnpm.overrides` in the root `package.json` (currently `19.2.3`). If peer warnings reappear after a dependency bump, realign the override.

## Further reading

`docs/` has deeper guides: `architecture.md`, `configuration.md`, `apps.md`, `assist.md`, `troubleshooting.md`. Troubleshooting covers the common failure modes verbatim (token errors, missing bundle, "Remotion requires React.createContext", Vercel 250 MB, hosted-app-calling-localhost).
