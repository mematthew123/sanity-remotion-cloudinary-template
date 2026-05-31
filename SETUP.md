# Setup — next steps

A checklist for taking this template from a fresh clone to a working render →
publish loop. Rendering runs on **AWS Lambda** (see [`docs/lambda.md`](./docs/lambda.md)).

Work top to bottom — each section depends on the ones above it.

## 0. Prerequisites

- **Node 20+** and **pnpm 10+**
- A **Sanity** project + dataset, and an **Editor** API token
- A **Cloudinary** account (cloud name + API key + secret)
- An **AWS** account (for Remotion Lambda)
- A Sanity **organization id** — only if you'll run/deploy the App SDK video app

## 1. Install & scaffold env files

```bash
pnpm install

cp apps/web/.env.local.example apps/web/.env.local
cp apps/studio/.env.example     apps/studio/.env
cp apps/video/.env.example      apps/video/.env   # optional — App SDK app only
```

## 2. Sanity

1. Create the project + dataset at [sanity.io/manage](https://www.sanity.io/manage).
2. Create an **Editor** API token (Manage → project → API → Tokens). Verify it
   returns a number, not an error:
   ```bash
   curl -s -H "Authorization: Bearer $TOKEN" \
     "https://<projectId>.api.sanity.io/v2024-01-01/data/query/<dataset>?query=count(*)"
   ```
3. Fill the Sanity vars in all three env files (`*_PROJECT_ID`, `*_DATASET`,
   and `SANITY_API_WRITE_TOKEN` in web).
4. The site reads **published** content with no token, so make the dataset
   **public** (Manage → API → Datasets) — or add a read token in
   `apps/web/lib/sanity.client.ts`.

See [`docs/configuration.md`](./docs/configuration.md) for the env reference and
the two common token errors.

## 3. The shared render secret

Invent one random string and mirror the **same** value into three places:

| File | Var |
| --- | --- |
| `apps/web/.env.local` | `VIDEO_RENDER_SECRET` |
| `apps/studio/.env` | `SANITY_STUDIO_RENDER_SECRET` |
| `apps/video/.env` | `SANITY_APP_RENDER_SECRET` |

> ⚠️ It's bundled into client JS — fine for local/demo, but proxy the render call
> behind session auth for a public production Studio/app.

## 4. Cloudinary

Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` to
`apps/web/.env.local`.

## 5. Remotion Lambda (the rendering backend)

Full walkthrough: [`docs/lambda.md`](./docs/lambda.md). Short version:

1. Add AWS creds to `apps/web/.env.local`:
   ```
   REMOTION_AWS_ACCESS_KEY_ID=...
   REMOTION_AWS_SECRET_ACCESS_KEY=...
   REMOTION_LAMBDA_REGION=us-east-1     # optional; default us-east-1
   ```
2. Attach IAM policies and validate (run from `apps/web`):
   ```bash
   npx remotion lambda policies user      # paste as inline user policy
   npx remotion lambda policies role      # create role `remotion-lambda-role`
   npx remotion lambda policies validate  # must pass
   ```
3. Deploy the function and the site bundle, then capture their output into env:
   ```bash
   pnpm deploy:lambda:fn     # → REMOTION_LAMBDA_FUNCTION_NAME
   pnpm deploy:lambda:site   # → REMOTION_LAMBDA_SERVE_URL
   ```

> Re-run `deploy:lambda:site` after changing compositions, and **both** commands
> after bumping Remotion (a function is bound to one Remotion version).

## 6. (Optional) Brand voice for Sanity Assist

```bash
cd apps/studio && npx sanity exec ./scripts/seed-agent-context.ts --with-user-token
```

Then edit the **Brand Voices** docs in Studio (the source of truth). Assist's AI
field actions also need the schema deployed (`npx sanity schema deploy`) and are
a paid Growth-plan feature. See [`docs/assist.md`](./docs/assist.md).

## 7. Run it

```bash
pnpm dev:web      # http://localhost:3000
pnpm dev:studio   # http://localhost:3333
pnpm dev:video    # the App SDK video editor — needs SANITY_APP_ORGANIZATION_ID
```

Then in Studio: create an **Author** → a **Post** (publish it) → document action
**Render Promo (1:1)** or **Render Teaser (9:16)**. Watch the **Videos** list move
`rendering → uploading → ready`, then open `/posts/<slug>` or `/videos` on the site.

## 8. Deploy

1. **Lambda** — already done in step 5 (redeploy on composition/Remotion changes).
2. **Web** → Vercel, project root `apps/web`. Set `/api/video/render` max duration
   to **300s** and add every `apps/web` env var (Sanity, Cloudinary, secret, and the
   `REMOTION_AWS_*` / `REMOTION_LAMBDA_*` values).
3. Point `SANITY_STUDIO_RENDER_API_URL` and `SANITY_APP_RENDER_API_URL` at the
   deployed web URL (App SDK vars are baked in at **build time** — rebuild/redeploy
   after changing them).
4. **Studio** → `pnpm deploy:studio`. **App SDK app** → `pnpm deploy:video` (first
   run is interactive; pin `deployment.appId` in `sanity.cli.ts` afterward).

See [`docs/troubleshooting.md`](./docs/troubleshooting.md) for the failure modes
you're most likely to hit.
