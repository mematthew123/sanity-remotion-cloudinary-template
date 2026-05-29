# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root (pnpm workspaces with `pnpm@10.26.2`, Node 20+).

```bash
pnpm install

pnpm dev:web          # Next.js site               http://localhost:3000
pnpm dev:studio       # Sanity Studio              http://localhost:3333
pnpm dev:video        # Sanity App SDK app — video editor      (needs SANITY_APP_ORGANIZATION_ID)

pnpm build            # = pnpm build:web → next build
pnpm lint             # ESLint on apps/web

pnpm deploy:studio
pnpm deploy:video         # first run is INTERACTIVE — needs a TTY for the title prompt; appId then pinned in sanity.cli.ts

pnpm deploy:lambda:fn     # deploy/update the Remotion Lambda render function (per region + Remotion version)
pnpm deploy:lambda:site   # bundle apps/web/remotion/index.ts and upload it to S3 (the "serve URL")
```

Per-package scripts run via `pnpm --filter @template/<name> <script>` (names: `web`, `studio`, `video`, `video-core`). No test suite is wired up.

Rendering runs on **AWS Lambda**, not in the Next.js function — see `docs/lambda.md` for first-time AWS/IAM setup and capturing the function name + serve URL into env.

## Architecture

Three apps + one shared package, all driven by a single render pipeline (rendering offloaded to AWS Lambda).

```
Sanity Studio "Render" action  ─┐
Sanity App SDK video editor    ─┴──► POST /api/video/render (apps/web)
                                       1. validate inputProps with composition's Zod schema
                                       2. create `video` doc       (status: rendering)
                                       3. renderMediaOnLambda → poll getRenderProgress → MP4 on S3
                                       4. Cloudinary upload (from S3 URL) + eager variants  (status: uploading)
                                       5. patch doc cloudinaryUrl + variants[] (status: ready)
                                     ──► Next.js site reads ready video docs and plays them
```

The route stays **synchronous** — it polls the Lambda render to completion inside the request (bounded by `maxDuration = 300`) — so the Studio action and video editor app keep reading `status: ready` + `cloudinaryUrl` straight from the response, with no caller changes.

The render route (`apps/web/app/api/video/render/route.ts`) is **the only server-side mutator** of Sanity content. Everything else (Studio, video editor app, site) triggers it or reads what it produced. That keeps `SANITY_API_WRITE_TOKEN` out of every client bundle.

### The React-free registry boundary (the load-bearing invariant)

`packages/video-core` has two entry points enforced by its `exports` field:

- `@template/video-core` — barrel exporting the Remotion components. Importing it evaluates Remotion hooks (`useCurrentFrame`, `loadFont`) at module load.
- `@template/video-core/registry` — pure metadata: composition ids, dimensions, Zod input schemas, the variant catalog. **No React.**

Rules:

- The render route and `apps/studio/src/schemaTypes/video.ts` must import only `@template/video-core/registry`. Pulling the barrel into a server route or Studio bundle breaks with "Remotion requires React.createContext" / Turbopack export errors.
- Only `apps/web/remotion/Root.tsx` (which runs inside the Remotion bundle) and the App SDK video editor app may import the barrel.

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
| App SDK app | `apps/video/.env` | `SANITY_APP_*` |

`VIDEO_RENDER_SECRET` is a value you invent and **mirror identically** into three places: `VIDEO_RENDER_SECRET` (web), `SANITY_STUDIO_RENDER_SECRET` (studio), `SANITY_APP_RENDER_SECRET` (video app). It is bundled into the Studio/video-app client JS — fine for local/demo, but for public production you must move the trigger behind a session-authenticated proxy instead.

`SANITY_APP_*` vars are baked into the App SDK bundle **at build time**. A deployed app with `SANITY_APP_RENDER_API_URL=http://localhost:3000` will call the user's local machine — rebuild and redeploy after pointing it at the deployed web URL.

The site reads published content with **no token** (`useCdn: true`, `perspective: 'published'`) — requires a **public** dataset. If kept private, add a read token in `apps/web/lib/sanity.client.ts`. Writes always use the write token regardless.

## Sanity Assist + brand voice

Studio adds two AI field actions ("Rewrite in brand voice", "Generate video copy in brand voice") backed by `sanity.agentContext` docs. Multiple voices are supported: each markdown file in `apps/studio/voices/` seeds one voice doc whose id is the filename stem (e.g. `brand-voice.md` → id `brand-voice`, `dead-head.md` → id `dead-head`). Bootstrap with:

```bash
cd apps/studio && npx sanity exec ./scripts/seed-agent-context.ts --with-user-token
```

The seed uses `createIfNotExists`, so once a voice doc exists, Studio is the source of truth — edit voices in Studio under **Brand Voices**, not in the markdown. To re-bootstrap a voice from its markdown, delete the doc in Studio first and reseed.

Each `post` has an optional `voice` reference under the **Settings** group. The Assist actions read it via `resolveVoiceDocId()` in `apps/studio/sanity.config.ts` and fall back to the default `brand-voice` doc when unset (and for non-post document types).

## Deploy specifics

- `apps/web` deploys to Vercel with project root set to `apps/web`. Set `/api/video/render` max duration to **300s** (the route polls the Lambda render to completion within the request).
- **Rendering is on AWS Lambda** — see `docs/lambda.md` for the one-time setup (IAM user, `npx remotion lambda policies user|role|validate`, `REMOTION_AWS_*` creds). Deploy/update the renderer with `pnpm deploy:lambda:fn` (one function per region + Remotion version) and upload the site bundle with `pnpm deploy:lambda:site`; set `REMOTION_LAMBDA_FUNCTION_NAME` + `REMOTION_LAMBDA_SERVE_URL` (+ optional `REMOTION_LAMBDA_REGION`) on the web app from their output. Bump Remotion → redeploy both.
- Because rendering is off-box, the Vercel function carries no Chromium or compositor binary, so there's no 250 MB packaging concern and no `outputFileTracingIncludes` for the render route. The render route only imports `@remotion/lambda/client` (marked `serverExternalPackages` in `apps/web/next.config.ts`).
- The Lambda render output is written to S3 with `privacy: 'public'` so Cloudinary can fetch it by URL; the route deletes that S3 object (`deleteRender`) right after the Cloudinary upload, so the canonical copy lives only in Cloudinary.
- App SDK first deploy is interactive (free-text title prompt; `-y` won't answer it). After the first run, pin `deployment.appId` in the app's `sanity.cli.ts` — subsequent deploys are non-interactive.

## React version pinning

`react` and `react-dom` are pinned via `pnpm.overrides` in the root `package.json` (currently `19.2.3`). If peer warnings reappear after a dependency bump, realign the override.

## Further reading

`docs/` has deeper guides: `architecture.md`, `configuration.md`, `apps.md`, `assist.md`, `lambda.md`, `troubleshooting.md`. Troubleshooting covers the common failure modes verbatim (token errors, "Remotion requires React.createContext", Lambda not configured / version mismatch, hosted-app-calling-localhost).
