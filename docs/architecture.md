# Architecture

## The core loop

```
Sanity (post)
   │  trigger: Studio "Render" action  OR  the video editor app
   ▼
POST /api/video/render            (Next.js route, bearer-authed)
   │  1. validate inputProps (Zod) + idempotency check
   │  2. create a `video` doc            → status: rendering
   │  3. render the composition on AWS Lambda
   │       renderMediaOnLambda → poll getRenderProgress → MP4 on S3
   │  4. upload MP4 to Cloudinary (from the S3 URL), eager-generate variants → status: uploading
   │  5. patch the doc: cloudinaryUrl + variants[]          → status: ready
   ▼
Next.js site / apps
   read `video` docs where status == "ready" and play from Cloudinary
```

The route polls the Lambda render to completion **inside the request** (bounded by `maxDuration = 300`), so it stays synchronous: the Studio action and video editor app read `status: ready` + `cloudinaryUrl` straight from the response.

The **render route is the only server-side mutator.** Everything else (the Studio action, the video editor app, the site) either triggers it or reads what it produced. That keeps the Sanity write token on the server and out of any browser bundle.

## Packages

| Path | Package | Role |
| --- | --- | --- |
| `apps/web` | `@template/web` | Next.js 16 site, `/api/video/render` (invokes Remotion Lambda), the Remotion site entry (`remotion/`) deployed to S3 |
| `apps/studio` | `@template/studio` | Sanity Studio v5: schemas, "Render" document actions, Assist + brand voice |
| `apps/video` | `@template/video` | Sanity App SDK app — the video editor (live preview + render trigger) |
| `packages/video-core` | `@template/video-core` | Remotion compositions, the registry, the Cloudinary variant catalog |

## The React-free registry boundary

`video-core` has two entry points:

- **`@template/video-core`** (barrel) — the real Remotion components. Importing it evaluates Remotion hooks (`useCurrentFrame`, `loadFont`) at module load.
- **`@template/video-core/registry`** — pure metadata: composition ids, dimensions, Zod schemas, the variant catalog. **No React.**

Rule of thumb:

- The **render route** and the **Studio `video` schema** import only `@template/video-core/registry`. Pulling the barrel into a server route or the Studio bundle breaks page-data collection ("Remotion requires React.createContext").
- Only **`apps/web/remotion/Root.tsx`** (which runs inside the Remotion bundle) and the **video editor App SDK app** import the barrel.

The `./registry` subpath in `video-core/package.json` `exports` is what enforces this.

## The render pipeline (server)

`apps/web/app/api/video/render/route.ts`:

1. Bearer auth against `VIDEO_RENDER_SECRET`.
2. Lazily builds the Sanity write client (so a not-yet-configured clone returns a clean error instead of crashing at import).
3. `findComposition(id)` → Zod `safeParse(inputProps)`.
4. Idempotency: skip if a `video` for this `(post, template)` is already ready/in-flight.
5. Create the `video` doc (`status: rendering`), back-referencing its `post`.
6. `renderMediaOnLambda` (codec h264, `privacy: 'public'`) then poll `getRenderProgress` until `done` — yields a public S3 URL for the MP4. Render runs on the deployed Lambda function against the deployed site (`REMOTION_LAMBDA_FUNCTION_NAME` / `REMOTION_LAMBDA_SERVE_URL`). See `lambda.md`.
7. Upload to Cloudinary from that URL (`folder: template/videos`) with `eager: eagerTransformsFor(meta.variantIds)`, then `deleteRender` the S3 copy (best-effort).
8. Patch the doc: `status: ready`, `cloudinaryUrl`, `cloudinaryPublicId`, `duration`, and `variants[]` from `snapshotVariants(cloudName, publicId, variantIds)`.
9. On any error: patch `status: failed` + `errorMessage`.

## The Cloudinary variant system

A **variant** is a Cloudinary *derivation* of the one canonical MP4 — never a re-render. Defined in `video-core/src/registry.ts`:

- `VARIANTS` — site (mp4 / poster jpg / preview gif) + social crops (square + vertical) + a YouTube thumbnail.
- Each composition opts into a `variantIds[]` set that crops cleanly from its aspect ratio (`article-promo` → square socials; `article-teaser` → vertical socials).
- `eagerTransformsFor(ids)` → the `eager` array passed to the Cloudinary upload (materialized at upload).
- `snapshotVariants(cloudName, publicId, ids)` → the `{variantId, surface, format, url, width, height}[]` written to `video.variants[]`.
- `variantUrl(cloudName, publicId, id)` takes the **cloud name as a parameter**, so `video-core` never needs Cloudinary env. The render route passes `CLOUDINARY_CLOUD_NAME` and stores full URLs on the doc — clients just read `video.variants[].url`.

## Where rendered video surfaces

- GROQ in `apps/web/lib/sanity.queries.ts`. A post's videos come from a **back-reference** subquery (`*[_type=="video" && post._ref==^._id && status=="ready" ...]`) — the render route never writes a `videos[]` array back onto the post.
- `components/VideoPlayer.tsx` plays `cloudinaryUrl` (or a variant URL).
- `app/posts/[slug]/page.tsx` embeds a post's videos; `app/videos/page.tsx` is the gallery.

## Composition → render data flow

The render route is **content-agnostic**: it validates `inputProps` against the chosen composition's Zod schema (`ArticleVideoProps`) and hands them to Remotion. To change the source content type you change the Zod schema, the `post` schema, and the field mapping in the trigger (Studio action / video editor) together — the route itself doesn't change.
