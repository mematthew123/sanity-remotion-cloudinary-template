# How it maps to your stack

This template lives at a seam that no single vendor ships on its own: **turn modeled content into a rendered video asset, then deliver that asset everywhere.** Three products each own one stage of that loop. This page explains what each one does *here* — so if you came in through Sanity, Cloudinary, or Remotion, you can find your product's role instantly.

```
Sanity  ──authors──►  Remotion  ──renders──►  Cloudinary  ──delivers──►  site · email · YouTube · podcast
(content)             (one MP4)               (∞ derivations)
```

The one-line thesis — and the reason for the name **renderonce.dev**: you render once, then derive infinitely. Rendering is the expensive step (CPU-bound frames in a sandbox), so it happens exactly once per post+template; every other surface is a cheap Cloudinary transform of that single canonical asset.

---

## What Sanity does here

Sanity is the **system of record and the control surface**. Nothing renders or sends without originating from a Sanity document.

- **Content modeling** — `post` carries the article body, the `videoCopy` block compositions render from, the `voice` reference, and the `autoGenerateVideoOnPublish` toggle. The `video`, `newsletter`, and `welcomeEmail` documents model the *outputs* of the pipeline. See `apps/studio/src/schemaTypes/`.
- **Triggering renders** — the **Render** document actions (`apps/studio/src/actions/renderVideo.tsx`) and **auto-promo-on-publish** (`apps/studio/src/actions/autoPromoOnPublish.tsx`) are the only ways a render starts. Editors stay in Studio; the action POSTs to the render route and reads `status: ready` straight back.
- **Reviewing outputs** — the `video` document has custom **Preview** and **Variants** view tabs (`apps/studio/src/structure/index.ts`), so editors watch the canonical render and grab Cloudinary derivations without leaving the editor.
- **Distribution surfaces** — the `newsletter` doc and the `welcomeEmail` singleton turn a rendered video into a Resend email, again entirely from Studio.
- **AI authoring** — Sanity Assist + brand-voice docs (`sanity.agentContext`) power "Rewrite as <voice>" and "Generate video copy as <voice>" field actions.

**What Sanity does *not* do:** it never holds a media binary and never gets a write from the browser. The render route is the sole server-side mutator of pipeline content, so `SANITY_API_WRITE_TOKEN` stays off the client.

## What Remotion does here

Remotion is the **renderer** — the stage that actually creates a video from content. This is the part that's genuinely hard to build and the part neither Sanity nor Cloudinary provides.

- **Compositions** — `packages/video-core/src/compositions/` holds the React-driven video templates (`article-promo`, `teaser`, `article-narrated`). They render from the `ArticleVideoProps` Zod schema, fed by the Studio render action's field mapping.
- **The React-free registry boundary** — `@template/video-core/registry` exposes composition ids, dimensions, Zod schemas, and the variant catalog with **no React**, so the server route and Studio can import metadata without evaluating Remotion hooks. Only `apps/web/remotion/Root.tsx` imports the component barrel. This invariant is enforced by the package's `exports` field.
- **Sandboxed rendering** — renders run inside an ephemeral **Vercel Sandbox** (`apps/web/app/api/video/render/route.ts`), restored from a build-time snapshot. The narrated composition special-cases 8 vCPUs and an extended timeout; promo/teaser finish in <60s on defaults.
- **Computed metadata** — `article-narrated` sums per-chunk voiceover durations in `calculateMetadata` rather than declaring a fixed length.

**What Remotion does *not* do:** it doesn't store or deliver the output. It writes one MP4 to the sandbox VM; from there the asset's life belongs to Cloudinary.

## What Cloudinary does here

Cloudinary is the **delivery and derivation layer** — the home of the canonical asset and the engine behind "render once."

- **Canonical storage** — the sandbox stages the MP4 on Vercel Blob just long enough for Cloudinary to fetch it by URL; the route then deletes the Blob copy, so the one canonical render lives only in Cloudinary (`cloudinaryUrl` on the `video` doc).
- **Eager variants (no re-renders)** — the variant catalog in `packages/video-core/src/registry.ts` is the fanout spine. `eagerTransformsFor(ids)` materializes derivations at upload; `snapshotVariants(...)` records them on `video.variants[]`. One render feeds:
  - the **site player** (canonical `cloudinaryUrl`),
  - the **newsletter** email hero (`site-preview-gif`, falling back to `site-poster-jpg`),
  - **YouTube** (`youtube-1080p-mp4`, an upscale of the 720p narrated render),
  - the **podcast** surface (`podcast-mp3` audio + download).
- **Live transforms** — `variantUrl(cloudName, …)` builds delivery URLs; the public `/playground` (`TransformPlayground.tsx`) and the Studio Variants tab let you mutate transform strings against a real render and watch derivations appear.

**What Cloudinary does *not* do:** it doesn't create the video — it transforms the one Remotion already produced. Adding a new surface usually means *consuming a different variant id*, not running another render.

---

## Why this is the unique slot

Each vendor owns its stage cleanly, and the template's value is the *wiring between them*:

| Stage | Owner | Could the others do it? |
| --- | --- | --- |
| Model + trigger + review | Sanity | No — Cloudinary/Remotion have no content model or editor |
| Generate the asset | Remotion | No — neither Sanity nor Cloudinary renders video from content |
| Store + derive + deliver | Cloudinary | No — Remotion stops at one file; Sanity holds no binaries |

Off-the-shelf Cloudinary tooling (e.g. the `next-cloudinary` component library) operates entirely in the third column — it *delivers* assets that already exist. This template is the part *before* that: producing the asset from modeled content, then handing Cloudinary a single source of truth to fan out. The two are complementary — a delivery library would *consume* this template's variant catalog, never replace it.
