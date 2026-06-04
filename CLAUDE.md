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

pnpm bundle:remotion      # local: rebuild apps/web/.remotion-bundle/ via remotion bundle CLI
```

Per-package scripts run via `pnpm --filter @template/<name> <script>` (names: `web`, `studio`, `video`, `video-core`). No test suite is wired up.

Rendering runs in a **Vercel Sandbox** — see `docs/vercel-sandbox.md` for connecting a Vercel Blob store (auto-injects `BLOB_READ_WRITE_TOKEN`) and how the build-time snapshot is created.

## Architecture

Three apps + one shared package, all driven by a single render pipeline (rendering happens inside an ephemeral Vercel Sandbox).

```
Sanity Studio "Render" action  ─┐
Sanity App SDK video editor    ─┴──► POST /api/video/render (apps/web)
                                       1. validate inputProps with composition's Zod schema
                                       2. create `video` doc       (status: rendering)
                                       3. createSandbox / restoreSnapshot → renderMediaOnVercel inside it
                                       4. uploadToVercelBlob → Cloudinary upload + eager variants → delete Blob copy  (status: uploading)
                                       5. patch doc cloudinaryUrl + variants[] (status: ready)
                                     ──► Next.js site reads ready video docs and plays them
```

The route stays **synchronous** — the sandbox render completes inside the request (bounded by `maxDuration = 300`) — so the Studio action and video editor app keep reading `status: ready` + `cloudinaryUrl` straight from the response, with no caller changes.

The render route (`apps/web/app/api/video/render/route.ts`) is the largest server-side mutator of Sanity content. Two narrower mutators landed alongside the fanout extensions:

- `apps/web/app/api/newsletter/send/route.ts` writes only to the `newsletter` doc (`status`, `sentAt`, `recipientCount`, `resendBroadcastId`) — never touches video docs.
- The BlueSky Blueprint (`apps/blueprints/functions/bluesky-post/`) writes only `video.socialPostedAt` as an idempotency marker — never touches newsletter docs.

Each mutator owns a non-overlapping slice of the data model, so `SANITY_API_WRITE_TOKEN` still stays out of every client bundle. Studio, the video editor app, and the site only trigger these routes or read what they produced.

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

The catalog is the fanout spine: the site reads `cloudinaryUrl`, the newsletter embeds `site-preview-gif` as the email hero (`<Img>` straight from Cloudinary — no re-host), and the BlueSky Blueprint pulls `social-1x1` for timeline-friendly square crops. Adding a surface usually means consuming a different variant id, not changing the render.

### Where rendered video surfaces

GROQ in `apps/web/lib/sanity.queries.ts`. A post's videos come from a **back-reference** subquery (`*[_type=="video" && post._ref==^._id && status=="ready" ...]`) — the render route never writes a `videos[]` array back onto the post. `components/VideoPlayer.tsx` plays `cloudinaryUrl` or a variant URL.

### Adding a newsletter

The `newsletter` doc (`apps/studio/src/schemaTypes/newsletter.ts`) is a Studio surface for sending a Resend email built around one rendered video. Editors pick a `video` (filtered to ready + variants-defined) and optionally a `post` for the CTA link. The schema's `recipientSelection` switches between `test` (typed-in addresses, looped via `resend.emails.send`) and `audience` (one `resend.broadcasts.create` + `send` against `RESEND_AUDIENCE_ID`). The send route guards against double-sends with `ifRevisionID` on the `draft → sending` patch — concurrent clicks 409 instead of double-billing Resend.

### Adding a Blueprint function

`apps/blueprints/` is a separate pnpm workspace member that deploys Sanity Functions via `npx sanity@latest blueprints deploy`. The current function (`bluesky-post`) listens on `video` mutations matching `status == "ready" && defined(variants) && !defined(socialPostedAt)`, posts the `social-1x1` variant to BlueSky, and patches `socialPostedAt` to exclude the doc from future runs. **Before the first deploy on an existing dataset, run a backfill that patches `socialPostedAt: "backfill"` onto every already-ready video** — otherwise the function fires once for every historical video.

### Adding a composition

1. Create `packages/video-core/src/compositions/Foo.tsx`.
2. Register metadata in `registry.ts` (`COMPOSITIONS`) and the component in `registry-components.ts` (`COMPOSITION_COMPONENTS`); export from `index.ts`.
3. Add a render action (or extend existing) in `apps/studio/src/actions/renderVideo.tsx`.
4. `pnpm bundle:remotion` to rebuild the local bundle, or redeploy to refresh the build-time snapshot on Vercel.

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

`NEWSLETTER_SEND_SECRET` follows the same mirror pattern (web + `SANITY_STUDIO_NEWSLETTER_SECRET` in the studio). The blast radius is bigger than render — anyone with the bundled secret can send to your Resend audience — so the send route also enforces a server-side guard (`status === 'draft'` precondition + `ifRevisionID` on the `sending` patch) and a 5000-recipient hard cap unless the request includes `confirmLargeSend: true`.

Resend env (web only): `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `RESEND_FROM_EMAIL`, optional `RESEND_FROM_NAME`. The audience id must already exist in Resend before any audience send. Sender domain must be verified or test sends land in spam.

Blueprint env (`apps/blueprints/.env`, **not** a Studio/web prefix — read at deploy time and forwarded into the function runtime): `BLUESKY_USERNAME`, `BLUESKY_PASSWORD` (app password, not account), `BLUESKY_HOST` (default `bsky.social`), `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_WRITE_TOKEN` (Editor scope — required because the function patches `video.socialPostedAt` after posting).

ElevenLabs env (web only, optional): `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`. Used by the `generate-voiceover` script (`pnpm --filter @template/web generate-voiceover -- --post-id=<id>`) to produce per-paragraph narration MP3s hosted on Cloudinary, stored on `post.voiceoverChunks`. Phase 1 of `PLAN-narrated-videos.md`; the render route doesn't read these yet — they're consumed by the (unbuilt) `article-narrated` composition.

`SANITY_APP_*` vars are baked into the App SDK bundle **at build time**. A deployed app with `SANITY_APP_RENDER_API_URL=http://localhost:3000` will call the user's local machine — rebuild and redeploy after pointing it at the deployed web URL.

The site reads published content with **no token** (`useCdn: true`, `perspective: 'published'`) — requires a **public** dataset. If kept private, add a read token in `apps/web/lib/sanity.client.ts`. Writes always use the write token regardless.

## Sanity Assist + brand voice

Studio's "Brand AI" field menu exposes **one action per voice doc** in the dataset — `Rewrite as <voice>` on any text-like field, and `Generate video copy as <voice>` on `post.videoCopy`. Voices are `sanity.agentContext` docs. Each markdown file in `apps/studio/voices/` seeds one voice doc whose id is the filename stem (e.g. `brand-voice.md` → id `brand-voice`, `dead-head.md` → id `dead-head`). Bootstrap with:

```bash
cd apps/studio && npx sanity exec ./scripts/seed-agent-context.ts --with-user-token
```

The seed uses `createIfNotExists`, so once a voice doc exists, Studio is the source of truth — edit voices in Studio under **Brand Voices**, not in the markdown. To re-bootstrap a voice from its markdown, delete the doc in Studio first and reseed.

Each `post` has an optional `voice` reference under the **Settings** group. It's the post's *preferred* voice — `preferredVoiceId()` in `apps/studio/sanity.config.ts` reads it to bubble that voice to the top of the Assist menu (fallback: `brand-voice`). All voices remain selectable per action; the field is a sort hint, not a gate.

## Deploy specifics

- `apps/web` deploys to Vercel with project root set to `apps/web`. Set `/api/video/render` max duration to **300s**. The `buildCommand` in `apps/web/vercel.json` runs `next build && tsx scripts/create-snapshot.ts`, which bundles Remotion, boots a sandbox, snapshots it, and stores the snapshot id in Vercel Blob keyed by `VERCEL_DEPLOYMENT_ID`.
- **Rendering is in a Vercel Sandbox** — see `docs/vercel-sandbox.md`. One-time setup: deploy the project, then **Storage → Create → Blob** in the Vercel dashboard and attach the store. `BLOB_READ_WRITE_TOKEN` is auto-injected. Locally, `vercel link && vercel env pull apps/web/.env.local`.
- The Vercel function carries no Chromium or compositor binary — `@vercel/sandbox` and `@remotion/vercel` are marked `serverExternalPackages` in `apps/web/next.config.ts`. `outputFileTracingIncludes` ships the local bundle output (`apps/web/.remotion-bundle/`) with the function for the dev-fallback path.
- The sandbox writes its output to a path inside the VM; `uploadToVercelBlob({access: 'public'})` stages it on Vercel Blob just long enough for Cloudinary to fetch it by URL; the route then `del()`s the Blob staging copy, so the canonical copy lives only in Cloudinary.
- App SDK first deploy is interactive (free-text title prompt; `-y` won't answer it). After the first run, pin `deployment.appId` in the app's `sanity.cli.ts` — subsequent deploys are non-interactive.
- Blueprints deploy with `pnpm --filter @template/blueprints deploy` (wraps `npx sanity@latest blueprints deploy`). The deploy reads `apps/blueprints/.env` at definition time and bakes the values into the function's runtime env block. Rotate `SANITY_WRITE_TOKEN` by redeploying — the function does not pick up new env without one.

## React version pinning

`react` and `react-dom` are pinned via `pnpm.overrides` in the root `package.json` (currently `19.2.3`). If peer warnings reappear after a dependency bump, realign the override.

## Further reading

`docs/` has deeper guides: `architecture.md`, `configuration.md`, `apps.md`, `assist.md`, `vercel-sandbox.md`, `troubleshooting.md`. Troubleshooting covers the common failure modes verbatim (token errors, "Remotion requires React.createContext", Vercel Sandbox not configured / missing snapshot, hosted-app-calling-localhost).
