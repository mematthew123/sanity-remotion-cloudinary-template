# Configuration

## Prerequisites

- **Node 20+** and **pnpm 10+**
- A **Sanity** project + dataset, and an **Editor** API token (see [Sanity token](#sanity-token) — this is the #1 setup pitfall)
- A **Cloudinary** account (cloud name + API key + API secret)
- A **Vercel** account with a [Blob store](https://vercel.com/docs/storage/vercel-blob) connected to the deployed project — that's the entire setup; see [vercel-sandbox.md](./vercel-sandbox.md)

## Two env prefixes (don't mix them)

Each surface reads env differently:

| Surface | Files | Prefix | How it's read |
| --- | --- | --- | --- |
| Web (Next.js) | `apps/web/.env.local` | `NEXT_PUBLIC_*` (client) + plain (server) | `process.env.*` |
| Studio (Vite) | `apps/studio/.env` | `SANITY_STUDIO_*` | `import.meta.env.*` (bundled to client) |

Only the prefixed vars reach each client bundle. A `NEXT_PUBLIC_*` var won't appear in the Studio; a `SANITY_STUDIO_*` var won't appear in the web app.

## Env reference

### `apps/web/.env.local`
| Var | Notes |
| --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | public |
| `NEXT_PUBLIC_SANITY_DATASET` | e.g. `production`; public |
| `SANITY_API_WRITE_TOKEN` | **Editor** token — the render route creates `video` docs. Server-only. |
| `VIDEO_RENDER_SECRET` | bearer the render trigger must send |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | server-only |
| `NEXT_PUBLIC_SITE_URL` | canonical public origin (e.g. `https://renderonce.dev`), no trailing slash — drives OG tags, sitemap, RSS, and newsletter CTA links. Falls back to `http://localhost:3000`. |
| `RESEND_API_KEY` / `RESEND_AUDIENCE_ID` | Resend send + broadcast; server-only |
| `RESEND_FROM_EMAIL` / `RESEND_FROM_NAME` | sender identity, e.g. `hello@renderonce.dev` / `Render Once`. **The from-domain must be verified in Resend** or sends bounce / spam-folder. |
| `NEWSLETTER_SEND_SECRET` | bearer the "Send newsletter" action must send; mirror into Studio's `SANITY_STUDIO_NEWSLETTER_SECRET` |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | only for the `article-narrated` voiceover step; leave blank otherwise |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token — auto-injected on Vercel when a Blob store is connected; for local dev, `vercel link` + `vercel env pull apps/web/.env.local`. See [vercel-sandbox.md](./vercel-sandbox.md). |

### `apps/studio/.env`
| Var | Notes |
| --- | --- |
| `SANITY_STUDIO_PROJECT_ID` / `SANITY_STUDIO_DATASET` | same project/dataset |
| `SANITY_STUDIO_RENDER_API_URL` | full render URL — `http://localhost:3000/api/video/render` locally, `https://renderonce.dev/api/video/render` in production |
| `SANITY_STUDIO_RENDER_SECRET` | == web `VIDEO_RENDER_SECRET` |
| `SANITY_STUDIO_NEWSLETTER_SECRET` | == web `NEWSLETTER_SEND_SECRET` |

## The shared render secret

`VIDEO_RENDER_SECRET` is a value **you invent** (any long random string). Mirror the **same** value into:
`apps/web` `VIDEO_RENDER_SECRET` · `apps/studio` `SANITY_STUDIO_RENDER_SECRET`.

> ⚠️ It is bundled into the Studio client JS. Fine for local/demo or auth-gated use; for a public production Studio, proxy the render call through a route that authenticates the Sanity session instead.

## Sanity token

The render route needs a token that is a **project member with write (Editor) access** to your project. This is the most common failure:

- Create it at **[sanity.io/manage](https://www.sanity.io/manage) → your project → API → Tokens → Add API token**, role **Editor**.
- Verify it before anything else — this must return a number, not an error:
  ```bash
  curl -s -H "Authorization: Bearer $TOKEN" \
    "https://<projectId>.api.sanity.io/v2024-01-01/data/query/<dataset>?query=count(*)"
  ```
- Two errors to recognize (see [troubleshooting](./troubleshooting.md)):
  - `Session not found` → the value isn't a valid API token at all.
  - `projectUserNotFoundError` → the token authenticates but its identity isn't a **project member** (e.g. a personal/CLI/org-admin token). Create the token from **that project's** API → Tokens screen.

## Dataset visibility

The website reads **published** content with **no token** (`useCdn: true`, `perspective: 'published'`). That only works if the dataset is **public**. If you keep it private, add a read token to `apps/web/lib/sanity.client.ts`. The render route's writes work either way (they use the write token).

## Custom domain & Resend sender

The reference deployment uses **`renderonce.dev`**. Two things hang off it: the public origin (`NEXT_PUBLIC_SITE_URL`) and the newsletter's verified sending domain (`RESEND_FROM_EMAIL`). Wire them up in this order — the Resend `from` only works **after** the domain verifies.

1. **Point the domain at Vercel.** Add `renderonce.dev` (+ `www` redirect) under the web project's **Settings → Domains**, then set `NEXT_PUBLIC_SITE_URL=https://renderonce.dev` in Production env and redeploy. This alone fixes OG cards, the sitemap, the podcast RSS self-link, and newsletter CTA links.
2. **Verify the domain in Resend.** **Domains → Add Domain → `renderonce.dev`**, then add the records Resend shows (an `MX` + SPF `TXT` on the `send` subdomain, a DKIM `TXT` at `resend._domainkey`, and a recommended `_dmarc` `TXT`) at your registrar. Wait for **Verified**.
3. **Flip the sender.** Once verified, set `RESEND_FROM_EMAIL=hello@renderonce.dev` and `RESEND_FROM_NAME=Render Once` (web local + Vercel). Until then, sends from an unverified domain bounce or land in spam.

> Mirror local values in `apps/web/.env.local` so previews of OG tags / feeds resolve against the real origin during development.
