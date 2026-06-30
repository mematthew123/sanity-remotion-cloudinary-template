# Setup — next steps

A checklist for taking this template from a fresh clone to a working render →
publish loop.

There are **two render backends**, and you pick one without changing code:

- **Local render (default for a fresh clone)** — headless Chromium on your
  machine, uploading straight to Cloudinary. Needs only **Sanity + Cloudinary**.
  This is what runs whenever you're not on Vercel and no Blob token is present.
- **Vercel Sandbox (production)** — renders in a Vercel Sandbox and stages the
  MP4 in Vercel Blob. This is what runs on a Vercel deployment. See
  [`docs/vercel-sandbox.md`](./docs/vercel-sandbox.md).

The switch is `useLocalRender = !VERCEL && (LOCAL_RENDER === 'true' || !BLOB_READ_WRITE_TOKEN)`
— so locally you get the local path for free, and a Vercel deploy with a Blob
store connected gets the sandbox path. See
[`docs/plans-and-costs.md`](./docs/plans-and-costs.md) for what each backend
costs.

Work top to bottom — each section depends on the ones above it. **Sections 1–5
plus "Run it" are all you need to render locally.** Sections 6–8 (Vercel Sandbox,
Newsletter, Brand voice) are optional / deploy-only.

## 0. Prerequisites

- **Node 20+** and **pnpm 10+**
- A **Sanity** project + dataset, and an **Editor** API token
- A **Cloudinary** account (cloud name + API key + secret)
- A **Vercel** account — **only** to deploy the hosted app, and **Pro is
  required** (the render route runs up to 800 s; Hobby's 300 s cap makes renders
  fail — see [`docs/plans-and-costs.md`](./docs/plans-and-costs.md#vercel--only-for-the-hosted-deployment)).
  **Local rendering needs no Vercel account at all** — it falls back to headless
  Chromium on your machine.

> The first local render downloads a headless Chromium for Remotion (one-time,
> a few hundred MB). Long-form narrated renders are CPU-bound and slow on a
> laptop — see [`docs/plans-and-costs.md`](./docs/plans-and-costs.md).

## 1. Install & scaffold env files

```bash
pnpm install

cp apps/web/.env.local.example apps/web/.env.local
cp apps/studio/.env.example     apps/studio/.env
```

## 2. Sanity

1. Create the project + dataset at [sanity.io/manage](https://www.sanity.io/manage).
2. Create an **Editor** API token (Manage → project → API → Tokens). Verify it
   returns a number, not an error:
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" \
     "https://<projectId>.api.sanity.io/v2024-01-01/data/query/<dataset>?query=count(*)"
   ```
3. Fill the Sanity vars in both env files (`*_PROJECT_ID`, `*_DATASET`,
   and `SANITY_API_WRITE_TOKEN` in web).
4. The site reads **published** content with no token, so make the dataset
   **public** (Manage → API → Datasets) — or add a read token in
   `apps/web/lib/sanity.client.ts`.

See [`docs/configuration.md`](./docs/configuration.md) for the env reference and
the two common token errors.

## 3. Render trigger auth

Nothing to configure. The Studio's "Render" action authenticates with your
logged-in Sanity session token, which the render route validates server-side as
a write-capable project member — no secret is bundled into the Studio.

> `VIDEO_RENDER_SECRET` in `apps/web/.env.local` is **optional**: a server-side
> fallback bearer for CI/automation that POSTs without a Sanity session. Leave it
> unset unless you need that. See [`docs/configuration.md`](./docs/configuration.md#the-render-triggers-auth).

## 4. Cloudinary

Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` to
`apps/web/.env.local`.

## 5. Render backend

**To render locally (default):** do nothing — with no `BLOB_READ_WRITE_TOKEN`
set, the render route uses the local Chromium backend automatically. You can
also force it explicitly by setting `LOCAL_RENDER=true` in `apps/web/.env.local`
(useful if you've pulled a Blob token but still want to render locally).

That's enough to run the loop. Skip to "Run it" (section 9). Set up the Vercel
Sandbox (section 6) when you're ready to deploy.

## 6. (Deploy only) Vercel Sandbox

Full walkthrough: [`docs/vercel-sandbox.md`](./docs/vercel-sandbox.md). Short version:

1. Deploy `apps/web` to Vercel (project root `apps/web`). The first deploy will
   work without the Blob store but the render route will return a configuration
   error — that's expected.
2. In the Vercel dashboard, **Storage → Create → Blob**, name it (e.g.
   `remotion-renders`), and **attach it to the project**. Vercel auto-injects
   `BLOB_READ_WRITE_TOKEN` at runtime; redeploy once for it to take effect.
3. To run the sandbox path in local dev (instead of the local-Chromium backend),
   install the Vercel CLI and pull the env (one command writes both
   `BLOB_READ_WRITE_TOKEN` and the OIDC token the Sandbox SDK uses).
   ⚠️ Run `vercel link` from `apps/web/`, **not** the repo root — that's where
   the Next.js dev server reads `.env.local` from:
   ```bash
   npm i -g vercel
   vercel login
   cd apps/web
   vercel link            # pick the deployed project
   vercel env pull        # → apps/web/.env.local
   ```
   If the pull only writes `VERCEL_OIDC_TOKEN` and not `BLOB_READ_WRITE_TOKEN`,
   the Blob store isn't connected to the project yet — go back to step 2.

> The build-time snapshot (boots a sandbox + uploads the Remotion bundle, caches
> the resulting snapshot id in Blob) runs automatically on every Vercel deploy
> via `apps/web/vercel.json`'s `buildCommand`. Bumping Remotion or changing
> compositions is just a redeploy.

> ⚠️ Deploying the Vercel Sandbox backend requires a **Vercel Pro** plan (the
> render route's `maxDuration = 800` exceeds Hobby's limit). See
> [`docs/plans-and-costs.md`](./docs/plans-and-costs.md).

## 7. (Optional) Newsletter / Resend

The newsletter fan-out (Resend send + broadcast) is off the critical path — skip
it for the core render loop. To enable it, add the Resend vars to
`apps/web/.env.local` (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `RESEND_FROM_EMAIL`,
`RESEND_FROM_NAME`, `NEWSLETTER_SEND_SECRET`) and mirror the send secret into
`apps/studio/.env` as `SANITY_STUDIO_NEWSLETTER_SECRET`. The sender domain must be
**verified in Resend** or sends bounce / land in spam. Full walkthrough:
[`docs/configuration.md`](./docs/configuration.md#custom-domain--resend-sender).

## 8. (Optional) Brand voice for Sanity Assist

```bash
cd apps/studio && npx sanity exec ./scripts/seed-agent-context.ts --with-user-token
```

Then edit the **Brand Voices** docs in Studio (the source of truth). Assist's AI
field actions also need the schema deployed (`npx sanity schema deploy`) and are
a paid Growth-plan feature. See [`docs/assist.md`](./docs/assist.md).

## 9. Run it

```bash
pnpm dev          # both apps at once (Turborepo) — site :3000 + studio :3333
```

Or run them individually:

```bash
pnpm dev:web      # http://localhost:3000
pnpm dev:studio   # http://localhost:3333
```

Then in Studio: create an **Author** → a **Post** (publish it) → document action
**Render Promo (1:1)** or **Render Teaser (9:16)**. Watch the **Videos** list move
`rendering → uploading → ready`, then open `/posts/<slug>` or `/videos` on the site.

## 10. Deploy

1. **Web** → Vercel, project root `apps/web`. Set `/api/video/render` max duration
   to **800s** and add every `apps/web` env var (Sanity, Cloudinary, secret). The
   Blob store you connected in section 6 auto-injects `BLOB_READ_WRITE_TOKEN`; no
   AWS keys needed.
2. Point `SANITY_STUDIO_RENDER_API_URL` at the deployed web URL.
3. **Studio** → `pnpm deploy:studio`.

See [`docs/troubleshooting.md`](./docs/troubleshooting.md) for the failure modes
you're most likely to hit.
