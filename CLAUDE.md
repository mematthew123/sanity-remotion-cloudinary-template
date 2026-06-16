# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root (pnpm workspaces with `pnpm@10.26.2`, Node 20+).

```bash
pnpm install

pnpm dev:web          # Next.js site               http://localhost:3000
pnpm dev:studio       # Sanity Studio              http://localhost:3333

pnpm build            # = pnpm build:web → next build
pnpm lint             # ESLint on apps/web

pnpm deploy:studio

pnpm bundle:remotion      # local: rebuild apps/web/.remotion-bundle/ via remotion bundle CLI

pnpm typegen          # extract Studio schema + regenerate apps/web/sanity.types.ts
```

Run `pnpm typegen` after editing any schema or GROQ query in `apps/web/lib/sanity.queries.ts`. It runs `sanity schema extract` then `sanity typegen generate` (config: `apps/studio/sanity-typegen.json`). The generated `apps/web/sanity.types.ts` is committed (so the web build never depends on the Studio); the intermediate `apps/studio/schema.json` is gitignored. Queries are wrapped in `defineQuery` and `overloadClientMethods` is on, so `client.fetch(query)` is auto-typed — view types in `sanity.queries.ts` are *derived* from the generated result types (`PostListItem`, `SinglePost`, `PostVideo`, `VideoListItem`, `NewsletterForSend`), never hand-written.

Per-package scripts run via `pnpm --filter @template/<name> <script>` (names: `web`, `studio`, `video-core`). No test suite is wired up.

Rendering runs in a **Vercel Sandbox** — see `docs/vercel-sandbox.md` for connecting a Vercel Blob store (auto-injects `BLOB_READ_WRITE_TOKEN`) and how the build-time snapshot is created.

## Architecture

Two apps + one shared package, all driven by a single render pipeline (rendering happens inside an ephemeral Vercel Sandbox).

```
Sanity Studio "Render" actions   ─┐
auto-promo-on-publish (Studio)   ─┴──► POST /api/video/render (apps/web)
                                       1. validate inputProps with composition's Zod schema
                                       2. idempotency: an existing ready/in-flight video for the same post+template short-circuits with that doc
                                       3. create `video` doc       (status: rendering, renderStartedAt)
                                       4. createSandbox / restoreSnapshot → renderMediaOnVercel inside it
                                       5. uploadToVercelBlob → Cloudinary upload + eager variants → delete Blob copy  (status: uploading)
                                       6. patch doc cloudinaryUrl + variants[] (status: ready)
                                     ──► Next.js site reads ready video docs and plays them
```

Renders are triggered two ways, both from Studio: the manual **Render** document actions (`apps/studio/src/actions/renderVideo.tsx`), and **auto-promo-on-publish** — publishing a post with `autoGenerateVideoOnPublish` ON fires a background `article-promo` render (see "Auto-generate promo on publish" below).

The route stays **synchronous** — the sandbox render completes inside the request (bounded by `maxDuration = 800`) — so the Studio action keeps reading `status: ready` + `cloudinaryUrl` straight from the response, with no caller changes. A **soft timeout** fires ~80s before `maxDuration` so the catch block can mark the doc `failed` and clean up Blob staging before the platform hard-kills the function — without it, docs would stay stuck in `rendering` forever.

The render route (`apps/web/app/api/video/render/route.ts`) is the largest server-side mutator of Sanity content. Two narrower mutators landed alongside the fanout extensions:

- `apps/web/app/api/newsletter/send/route.ts` writes only to the `newsletter` doc (`status`, `sentAt`, `recipientCount`, `resendBroadcastId`) — never touches video docs. Its sibling `newsletter/preview/route.tsx` is read-only (GET, secret as query param so the Studio iframe can load it).
- `apps/web/app/api/voiceover/generate/route.ts` writes only `post.voiceoverChunks` — the TTS pre-step for narrated renders (see below).

Each mutator owns a non-overlapping slice of the data model, so `SANITY_API_WRITE_TOKEN` still stays out of every client bundle. Studio and the site only trigger these routes or read what they produced.

### The React-free registry boundary (the load-bearing invariant)

`packages/video-core` has two entry points enforced by its `exports` field:

- `@template/video-core` — barrel exporting the Remotion components. Importing it evaluates Remotion hooks (`useCurrentFrame`, `loadFont`) at module load.
- `@template/video-core/registry` — pure metadata: composition ids, dimensions, Zod input schemas, the variant catalog. **No React.**

Rules:

- The render route and `apps/studio/src/schemaTypes/video.ts` must import only `@template/video-core/registry`. Pulling the barrel into a server route or Studio bundle breaks with "Remotion requires React.createContext" / Turbopack export errors.
- Only `apps/web/remotion/Root.tsx` (which runs inside the Remotion bundle) may import the barrel.

### Cloudinary variants (no re-renders)

A variant is a Cloudinary *derivation* of the one canonical MP4. Defined in `packages/video-core/src/registry.ts`:

- `VARIANTS` — site delivery (`site-mp4`/`site-poster-jpg`/`site-preview-gif`) plus a long-form pair (`youtube-1080p-mp4` upscale + `podcast-mp3`) used by `article-narrated`. The catalog is trimmed to only variants with a real consumer; the `VariantSurface` union is `'site' | 'youtube' | 'podcast'`. (Unconsumed entries — the YouTube thumbnail, social-platform MP4 crops, the longform short-form clips, and the square `social-1x1` — were removed; the canonical `cloudinaryUrl` covers the site player.)
- Each composition opts into a `variantIds[]` set. `eagerTransformsFor(ids)` → Cloudinary `eager` array (materialized at upload). `snapshotVariants(cloudName, publicId, ids)` → the `{variantId, surface, format, url, width, height}[]` written to `video.variants[]`.
- `variantUrl(cloudName, …)` takes the cloud name as a parameter so `video-core` never imports Cloudinary env. The render route passes `CLOUDINARY_CLOUD_NAME` in.

The catalog is the fanout spine: the site player reads the canonical `cloudinaryUrl`, the newsletter embeds `site-preview-gif` as the email hero (`<Img>` straight from Cloudinary — no re-host; falls back to `site-poster-jpg`), and the narrated post page exposes an audio player + MP3 download fed by `podcast-mp3` while editors grab `youtube-1080p-mp4` from the Studio VariantViewer for full-res YouTube upload. Adding a surface usually means consuming a different variant id, not changing the render.

### The narrated composition (long-form, TTS-driven)

`article-narrated` reads the whole post body aloud (Remotion guidance it leaned on: `.agents/skills/remotion-best-practices/`). It differs from promo/teaser in every dimension that matters:

- **Voiceover is a precondition.** Per-paragraph ElevenLabs MP3s must exist on `post.voiceoverChunks` before rendering. Generate them via the Studio **Generate voiceover** action → `POST /api/voiceover/generate` (deliberately reuses `VIDEO_RENDER_SECRET`), or the CLI: `pnpm --filter @template/web generate-voiceover -- --post-id=<id>`. Both run the same shared logic in `apps/web/lib/voiceoverGenerate.ts`; MP3s are hosted on Cloudinary and cached per chunk.
- **Duration is computed, not declared** — `calculateMetadata` in the registry sums chunk `durationSeconds`.
- **It renders at 720p, not 1080p** — frames are CPU-bound in the sandbox and 720p is ~2.25× cheaper; the `youtube-1080p-mp4` Cloudinary variant upscales the canonical render for full-res delivery. Don't "fix" the resolution.
- **The render route special-cases it**: 8 vCPUs on the sandbox (`restoreSnapshot({vcpus})`), `sandbox.extendTimeout(25 min)`, and the soft timeout described above. Renders take 5–7 min; promo/teaser stay on defaults and finish in <60s.

### Where rendered video surfaces

GROQ in `apps/web/lib/sanity.queries.ts`. A post's videos come from a **back-reference** subquery (`*[_type=="video" && post._ref==^._id && status=="ready" ...]`) — the render route never writes a `videos[]` array back onto the post. `components/VideoPlayer.tsx` plays `cloudinaryUrl` or a variant URL. The narrated post page additionally surfaces an audio player + MP3 download backed by the `podcast-mp3` variant.

Inside Studio, the `video` document has two custom view tabs (registered in `apps/studio/src/structure/index.ts`): **Preview** (`components/VideoPreview.tsx` — a plain `<video>` of the canonical `cloudinaryUrl`, with status guards) and **Variants** (`components/VariantViewer.tsx` — the Cloudinary derivation gallery + live-transform playground). Both import only `@template/video-core/registry` for labels, never the Remotion barrel.

### Adding a newsletter

The `newsletter` doc (`apps/studio/src/schemaTypes/newsletter.ts`) is a Studio surface for sending a Resend email built around one rendered video. Editors pick a `video` (filtered to ready + variants-defined) and optionally a `post` for the CTA link. The schema's `recipientSelection` switches between `test` (typed-in addresses, looped via `resend.emails.send`) and `audience` (one `resend.broadcasts.create` + `send` against `RESEND_AUDIENCE_ID`). The send route guards against double-sends with `ifRevisionID` on the `draft → sending` patch — concurrent clicks 409 instead of double-billing Resend. Studio's send/preview document actions live in `apps/studio/src/plugins/newsletter/`; preview embeds `GET /api/newsletter/preview` (the rendered `@react-email` template) in an iframe.

### Auto-generate promo on publish

`post` has a boolean `autoGenerateVideoOnPublish` (in the **Video** field group, default off). The Studio wraps the built-in Publish action — `withAutoPromoOnPublish` in `apps/studio/src/actions/autoPromoOnPublish.tsx`, registered in `apps/studio/sanity.config.ts`'s `document.actions`. When a post with the toggle ON is published, it fires a background `article-promo` render via `POST /api/video/render`. It's **idempotent** (the route short-circuits an existing ready/in-flight video for that post+template) and **non-blocking** — a render failure shows a warning toast and never blocks or undoes the publish. Manual renders are still triggered by the **Render** document actions in `apps/studio/src/actions/renderVideo.tsx`.

### Adding a composition

1. Create `packages/video-core/src/compositions/Foo.tsx`.
2. Register metadata in `registry.ts` (`COMPOSITIONS`) and the component in `registry-components.ts` (`COMPOSITION_COMPONENTS`); export from `index.ts`.
3. Add a render action (or extend existing) in `apps/studio/src/actions/renderVideo.tsx`.
4. `pnpm bundle:remotion` to rebuild the local bundle, or redeploy to refresh the build-time snapshot on Vercel.

### Source content shape

Compositions render from `ArticleVideoProps` (in `packages/video-core/src/types.ts`). To change the source content type you must change that Zod schema, the `post` schema (`apps/studio/src/schemaTypes/post.ts`), and the field mapping in the Studio render action **together** — the render route itself is content-agnostic.

## Env: two prefixes, one shared secret

Each surface reads env differently — vars without the right prefix don't reach that surface's client bundle:

| Surface | File | Prefix |
| --- | --- | --- |
| Next.js web | `apps/web/.env.local` | `NEXT_PUBLIC_*` (client) + plain (server) |
| Sanity Studio (Vite) | `apps/studio/.env` | `SANITY_STUDIO_*` |

`VIDEO_RENDER_SECRET` is a value you invent and **mirror identically** into two places: `VIDEO_RENDER_SECRET` (web) and `SANITY_STUDIO_RENDER_SECRET` (studio). It is bundled into the Studio client JS — fine for local/demo, but for public production you must move the trigger behind a session-authenticated proxy instead.

`NEWSLETTER_SEND_SECRET` follows the same mirror pattern (web + `SANITY_STUDIO_NEWSLETTER_SECRET` in the studio). The blast radius is bigger than render — anyone with the bundled secret can send to your Resend audience — so the send route also enforces a server-side guard (`status === 'draft'` precondition + `ifRevisionID` on the `sending` patch) and requires `confirmAudienceSend: true` on any audience-mode send (the Studio action sets it after a confirm dialog); test-mode sends to typed-in addresses don't need it. There is no recipient-count cap — Resend Broadcasts don't expose a count pre-send.

Resend env (web only): `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `RESEND_FROM_EMAIL`, optional `RESEND_FROM_NAME`. The audience id must already exist in Resend before any audience send. Sender domain must be verified or test sends land in spam.

ElevenLabs env (web only): `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`. Required for the voiceover generation route/script that feeds the `article-narrated` composition (see "The narrated composition" above); the other compositions don't need them.

The site reads published content with **no token** (`useCdn: true`, `perspective: 'published'`) — requires a **public** dataset. If kept private, add a read token in `apps/web/lib/sanity.client.ts`. Writes always use the write token regardless.

## Sanity Assist + brand voice

Studio's "Brand AI" field menu exposes **one action per voice doc** in the dataset — `Rewrite as <voice>` on any text-like field, and `Generate video copy as <voice>` on `post.videoCopy`. Voices are `sanity.agentContext` docs. Each markdown file in `apps/studio/voices/` seeds one voice doc whose id is the filename stem (e.g. `brand-voice.md` → id `brand-voice`, `dead-head.md` → id `dead-head`). Bootstrap with:

```bash
cd apps/studio && npx sanity exec ./scripts/seed-agent-context.ts --with-user-token
```

The seed uses `createIfNotExists`, so once a voice doc exists, Studio is the source of truth — edit voices in Studio under **Brand Voices**, not in the markdown. To re-bootstrap a voice from its markdown, delete the doc in Studio first and reseed.

Each `post` has an optional `voice` reference under the **Settings** group. It's the post's *preferred* voice — `preferredVoiceId()` in `apps/studio/sanity.config.ts` reads it to bubble that voice to the top of the Assist menu (fallback: `brand-voice`). All voices remain selectable per action; the field is a sort hint, not a gate.

## Deploy specifics

- `apps/web` deploys to Vercel with project root set to `apps/web`. `/api/video/render` is set to `maxDuration = 800` (Vercel Pro's function-execution ceiling) — long-form narrated renders need 5–7 min, well under the cap, while promo/teaser finish in <60s. The `buildCommand` in `apps/web/vercel.json` runs `next build && tsx scripts/create-snapshot.ts`, which bundles Remotion, boots a sandbox, snapshots it, and stores the snapshot id in Vercel Blob keyed by `VERCEL_DEPLOYMENT_ID`.
- **Rendering is in a Vercel Sandbox** — see `docs/vercel-sandbox.md`. One-time setup: deploy the project, then **Storage → Create → Blob** in the Vercel dashboard and attach the store. `BLOB_READ_WRITE_TOKEN` is auto-injected. Locally, `vercel link && vercel env pull apps/web/.env.local`.
- The Vercel function carries no Chromium or compositor binary — `@vercel/sandbox` and `@remotion/vercel` are marked `serverExternalPackages` in `apps/web/next.config.ts`. `outputFileTracingIncludes` ships the local bundle output (`apps/web/.remotion-bundle/`) with the function for the dev-fallback path.
- The sandbox writes its output to a path inside the VM; `uploadToVercelBlob({access: 'public'})` stages it on Vercel Blob just long enough for Cloudinary to fetch it by URL; the route then `del()`s the Blob staging copy, so the canonical copy lives only in Cloudinary.

## React version pinning

`react` and `react-dom` are pinned via `pnpm.overrides` in the root `package.json` (currently `19.2.3`). If peer warnings reappear after a dependency bump, realign the override.

## Further reading

`docs/` has deeper guides: `architecture.md`, `configuration.md`, `apps.md`, `assist.md`, `vercel-sandbox.md`, `troubleshooting.md`. Troubleshooting covers the common failure modes verbatim (token errors, "Remotion requires React.createContext", Vercel Sandbox not configured / missing snapshot, hosted-app-calling-localhost).
