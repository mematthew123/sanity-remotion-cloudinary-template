# @template/blueprints

Sanity Blueprint functions that run on document mutations. One function ships today: `bluesky-post`, which posts a video's `social-1x1` Cloudinary variant to BlueSky as soon as the video doc flips to `status: "ready"`.

## Setup

1. Install deps from the repo root: `pnpm install`.
2. Copy `.env.example` to `.env` and fill in:
   - **BlueSky credentials** — create an *app password* (not your account password) at https://bsky.app/settings/app-passwords.
   - **Sanity write token** — generate at https://sanity.io/manage → API → tokens with **Editor** scope. The function uses this to patch `video.socialPostedAt` after a successful post; without write access, the function would post repeatedly on every video update.
   - **`SITE_URL`** — the public URL the BlueSky post links back to. Should match `NEXT_PUBLIC_SITE_URL` in `apps/web/.env.local`.

## One-time backfill (required before first deploy on an existing dataset)

```bash
pnpm --filter @template/blueprints backfill
```

This patches `socialPostedAt: "backfill"` onto every already-ready video so the function doesn't fire for historical videos the first time it observes the dataset. Skipping this step on a dataset with N ready videos will fan out N BlueSky posts simultaneously the moment the blueprint deploys. On a fresh dataset with no videos, you can skip this.

## Deploy

```bash
pnpm --filter @template/blueprints deploy
```

Wraps `npx sanity@latest blueprints deploy`. The deploy reads `.env` at definition time and bakes those values into the function's runtime env. Rotating a credential (e.g. `SANITY_WRITE_TOKEN`) requires a redeploy — the function does not pick up new env without one.

## Tail logs

```bash
pnpm --filter @template/blueprints logs
```

## How it works

`sanity.blueprint.ts` declares a `defineDocumentFunction` that listens on `video` document mutations matching:

```
_type == "video" && status == "ready" && defined(variants) && !defined(socialPostedAt)
```

The handler at `functions/bluesky-post/index.ts`:

1. Fetches the `social-1x1` variant URL (falls back to `site-preview-gif`) and downloads the image as a `Uint8Array`.
2. Posts to BlueSky via `@humanwhocodes/crosspost` with `${postTitle}: ${title}\n${SITE_URL}/posts/${postSlug}` as the body.
3. On success, patches `socialPostedAt: <ISO timestamp>` on the video doc. The filter then excludes the doc from future mutations.

## Semantics

**At-most-once, not exactly-once.** Two concurrent updates could fire the function twice before either patch of `socialPostedAt` lands; both would post to BlueSky. The patches are no-ops once one lands and the doc is permanently excluded by the filter on subsequent updates. Acceptable for a template; if you need exactly-once, add a `socialPostInFlightAt` field set before the post and gate the filter on its absence too.

## Adding a new function

1. Create `functions/<name>/index.ts` exporting a handler via `documentEventHandler<EventDataShape>(...)`.
2. Add a second `defineDocumentFunction({...})` to the `resources[]` array in `sanity.blueprint.ts`.
3. Add any new env vars to both `.env.example` and the function's `env: {...}` block.
4. `pnpm --filter @template/blueprints deploy` again.
