# Configuration

## Prerequisites

- **Node 20+** and **pnpm 10+**
- A **Sanity** project + dataset, and an **Editor** API token (see [Sanity token](#sanity-token) — this is the #1 setup pitfall)
- A Sanity **organization id** — only if you run/deploy the App SDK app (`apps/video`)
- A **Cloudinary** account (cloud name + API key + API secret)
- An **AWS** account for Remotion Lambda rendering — see [lambda.md](./lambda.md) for the one-time setup

## Three env prefixes (don't mix them)

Each surface reads env differently:

| Surface | Files | Prefix | How it's read |
| --- | --- | --- | --- |
| Web (Next.js) | `apps/web/.env.local` | `NEXT_PUBLIC_*` (client) + plain (server) | `process.env.*` |
| Studio (Vite) | `apps/studio/.env` | `SANITY_STUDIO_*` | `import.meta.env.*` (bundled to client) |
| App SDK app | `apps/video/.env` | `SANITY_APP_*` | `process.env.*` (bundled to client) |

Only the prefixed vars reach each client bundle. A `NEXT_PUBLIC_*` var won't appear in the Studio; a `SANITY_APP_*` var won't appear in the web app.

## Env reference

### `apps/web/.env.local`
| Var | Notes |
| --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | public |
| `NEXT_PUBLIC_SANITY_DATASET` | e.g. `production`; public |
| `SANITY_API_WRITE_TOKEN` | **Editor** token — the render route creates `video` docs. Server-only. |
| `VIDEO_RENDER_SECRET` | bearer the render trigger must send |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | server-only |
| `REMOTION_AWS_ACCESS_KEY_ID` / `REMOTION_AWS_SECRET_ACCESS_KEY` | AWS creds for the Remotion IAM user; server-only. See [lambda.md](./lambda.md). |
| `REMOTION_LAMBDA_FUNCTION_NAME` | deployed function name — output of `pnpm deploy:lambda:fn` |
| `REMOTION_LAMBDA_SERVE_URL` | site bundle serve URL — output of `pnpm deploy:lambda:site` |
| `REMOTION_LAMBDA_REGION` | optional — AWS region (defaults to `us-east-1`); must match where the function + site are deployed |

### `apps/studio/.env`
| Var | Notes |
| --- | --- |
| `SANITY_STUDIO_PROJECT_ID` / `SANITY_STUDIO_DATASET` | same project/dataset |
| `SANITY_STUDIO_RENDER_API_URL` | full render URL, e.g. `http://localhost:3000/api/video/render` |
| `SANITY_STUDIO_RENDER_SECRET` | == web `VIDEO_RENDER_SECRET` |

### `apps/video/.env`
| Var | Notes |
| --- | --- |
| `SANITY_APP_PROJECT_ID` / `SANITY_APP_DATASET` | same project/dataset |
| `SANITY_APP_ORGANIZATION_ID` | your Sanity org id |
| `SANITY_APP_RENDER_API_URL` | full render URL |
| `SANITY_APP_RENDER_SECRET` | == web `VIDEO_RENDER_SECRET` |

## The shared render secret

`VIDEO_RENDER_SECRET` is a value **you invent** (any long random string). Mirror the **same** value into:
`apps/web` `VIDEO_RENDER_SECRET` · `apps/studio` `SANITY_STUDIO_RENDER_SECRET` · `apps/video` `SANITY_APP_RENDER_SECRET`.

> ⚠️ It is bundled into the Studio and video-app client JS. Fine for local/demo or auth-gated use; for a public production Studio/app, proxy the render call through a route that authenticates the Sanity session instead. See [apps.md](./apps.md#security).

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
