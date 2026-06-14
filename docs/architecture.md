# Architecture

## The core loop

```
Sanity (post)
   │  trigger: Studio "Render" document action
   ▼
POST /api/video/render            (Next.js route, bearer-authed)
   │  1. validate inputProps (Zod) + idempotency check
   │  2. create a `video` doc            → status: rendering
   │  3. spawn a Vercel Sandbox (restore from build-time snapshot on Vercel;
   │     fresh + addBundleToSandbox locally) and renderMediaOnVercel inside it
   │  4. uploadToVercelBlob → public Blob URL → Cloudinary upload with eager
   │     variants → delete Blob staging copy → sandbox.stop()    → status: uploading
   │  5. patch the doc: cloudinaryUrl + variants[]          → status: ready
   ▼
Next.js site
   reads `video` docs where status == "ready" and plays from Cloudinary
```

The route renders inside the sandbox synchronously (bounded by `maxDuration = 300`), so the Studio action reads `status: ready` + `cloudinaryUrl` straight from the response; the finished render previews in a "Preview" view tab on the `video` document, with a "Variants" tab for the Cloudinary derivations.

The **render route is the only server-side mutator.** Everything else (the Studio action, the site) either triggers it or reads what it produced. That keeps the Sanity write token on the server and out of any browser bundle.

## Packages

| Path | Package | Role |
| --- | --- | --- |
| `apps/web` | `@template/web` | Next.js 16 site, `/api/video/render` (spawns a Vercel Sandbox), the Remotion site entry (`remotion/`) bundled into the sandbox |
| `apps/studio` | `@template/studio` | Sanity Studio v5: schemas, the "Render" document action, the Preview + Variants views, Assist + brand voice |
| `packages/video-core` | `@template/video-core` | Remotion compositions, the registry, the Cloudinary variant catalog |

## The React-free registry boundary

`video-core` has two entry points:

- **`@template/video-core`** (barrel) — the real Remotion components. Importing it evaluates Remotion hooks (`useCurrentFrame`, `loadFont`) at module load.
- **`@template/video-core/registry`** — pure metadata: composition ids, dimensions, Zod schemas, the variant catalog. **No React.**

Rule of thumb:

- The **render route** and the **Studio `video` schema** import only `@template/video-core/registry`. Pulling the barrel into a server route or the Studio bundle breaks page-data collection ("Remotion requires React.createContext").
- Only **`apps/web/remotion/Root.tsx`** (which runs inside the Remotion bundle) imports the barrel.

The `./registry` subpath in `video-core/package.json` `exports` is what enforces this.

## The render pipeline (server)

`apps/web/app/api/video/render/route.ts`:

1. Bearer auth against `VIDEO_RENDER_SECRET`.
2. Lazily builds the Sanity write client (so a not-yet-configured clone returns a clean error instead of crashing at import).
3. `findComposition(id)` → Zod `safeParse(inputProps)`.
4. Idempotency: skip if a `video` for this `(post, template)` is already ready/in-flight.
5. Create the `video` doc (`status: rendering`), back-referencing its `post`.
6. Spawn a Vercel Sandbox: `restoreSnapshot()` on Vercel (resumes a build-time snapshot that already contains the bundle), `createSandbox()` + `addBundleToSandbox()` locally. `renderMediaOnVercel({sandbox, compositionId, inputProps, codec: 'h264'})` renders inside the sandbox. See [`vercel-sandbox.md`](./vercel-sandbox.md).
7. `uploadToVercelBlob({access: 'public'})` stages the MP4 in Vercel Blob with a public URL. Upload to Cloudinary from that URL (`folder: template/videos`) with `eager: eagerTransformsFor(meta.variantIds)`, then `del()` the Blob staging copy (best-effort).
8. Patch the doc: `status: ready`, `cloudinaryUrl`, `cloudinaryPublicId`, `duration`, and `variants[]` from `snapshotVariants(cloudName, publicId, variantIds)`.
9. On any error: patch `status: failed` + `errorMessage`. The `finally` block stops the sandbox so the slot is released immediately.

## The Cloudinary variant system

A **variant** is a Cloudinary *derivation* of the one canonical MP4 — never a re-render. Defined in `video-core/src/registry.ts`:

- `VARIANTS` — site (mp4 / poster jpg / preview gif) + a long-form family for narrated videos (`youtube-1080p-mp4` upscale, `podcast-mp3`).
- Each composition opts into a `variantIds[]` set: `article-promo` and `article-teaser` get the site base; `article-narrated` adds the long-form family.
- `eagerTransformsFor(ids)` → the `eager` array passed to the Cloudinary upload (materialized at upload).
- `snapshotVariants(cloudName, publicId, ids)` → the `{variantId, surface, format, url, width, height}[]` written to `video.variants[]`.
- `variantUrl(cloudName, publicId, id)` takes the **cloud name as a parameter**, so `video-core` never needs Cloudinary env. The render route passes `CLOUDINARY_CLOUD_NAME` and stores full URLs on the doc — clients just read `video.variants[].url`.

## Where rendered video surfaces

- GROQ in `apps/web/lib/sanity.queries.ts`. A post's videos come from a **back-reference** subquery (`*[_type=="video" && post._ref==^._id && status=="ready" ...]`) — the render route never writes a `videos[]` array back onto the post.
- `components/VideoPlayer.tsx` plays `cloudinaryUrl` (or a variant URL).
- `app/posts/[slug]/page.tsx` embeds a post's videos; `app/videos/page.tsx` is the gallery.

## Composition → render data flow

The render route is **content-agnostic**: it validates `inputProps` against the chosen composition's Zod schema (`ArticleVideoProps`) and hands them to Remotion. To change the source content type you change the Zod schema, the `post` schema, and the field mapping in the trigger (the Studio action) together — the route itself doesn't change.
