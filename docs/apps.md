# The Sanity App SDK app

One dashboard app built with `@sanity/sdk` + `@sanity/sdk-react`. It runs locally with `sanity dev` and deploys to your Sanity organization's dashboard with `sanity deploy`.

## `apps/video` — the video editor

The interactive alternative to the Studio's "Render" document action:

- **Post list** (`useDocuments` + `useDocumentProjection`) — pick a post.
- **Live preview** — a `@remotion/player` `<Player>` renders the selected composition with the post's data in real time.
- **Edit captions** — the `videoCopy` slots are edited via `useEditDocument`, so changes **persist to the post** (per the App SDK rule: don't hold content in local state). Preview-only knobs (e.g. duration) stay local.
- **Render** — POSTs `{compositionId, inputProps, postId}` to `SANITY_APP_RENDER_API_URL` with the bearer secret, and shows rendering/ready/error state.

## Cloudinary lives in the Studio (not a separate app)

There's no standalone Cloudinary app. The Cloudinary integration surfaces in two places the core template already owns: the **render pipeline** (upload + eager variants), and a **Variants** view on each `video` document in the Studio — a gallery of the generated derivatives plus a live transform preview, built entirely from public Cloudinary delivery URLs (no secret in the Studio). See [architecture.md](./architecture.md#the-cloudinary-variant-system).

## SDK conventions (from the `app-sdk` rule)

- Stable `@sanity/sdk` + `@sanity/sdk-react`; `<SanityApp config fallback>` at the root.
- Prefer `useDocuments` / `useDocumentProjection` / `useDocument` / `useEditDocument` over raw `useQuery`.
- Wrap every data-fetching component in `<Suspense>`; use `documentId` as the React key.
- Env uses the `SANITY_APP_*` prefix (`process.env.SANITY_APP_*`).

## Local development

```bash
pnpm dev:video        # needs SANITY_APP_ORGANIZATION_ID
```

You don't have to deploy to use the apps — `sanity dev` runs them locally against your project.

## Deploying

```bash
pnpm deploy:video
```

**First deploy is interactive.** With no `deployment.appId` configured, the CLI prompts for an application **title** (a free-text prompt — `-y` won't answer it, and it needs a real TTY). Run it directly in a terminal:

```bash
cd apps/video && npx sanity deploy    # enter a title, e.g. "Video Editor"
```

It builds, creates the application in your org, deploys, and prints:

```
Add the deployment.appId to your sanity.cli.ts file:
deployment: { appId: 'xxxxxxxxxxxxxxxxxxxxxxxx' }
```

**Pin that `appId`** in the app's `sanity.cli.ts` (already done in this repo):

```ts
export default defineCliConfig({
  app: { organizationId: process.env.SANITY_APP_ORGANIZATION_ID, entry: './src/App.tsx' },
  deployment: { appId: 'xxxxxxxxxxxxxxxxxxxxxxxx' },
})
```

After that, every deploy is **non-interactive** (`pnpm deploy:video` / CI just works). Forking into a different org? Run `npx sanity deploy` once to create your own app, then replace the id.

## Allow the app's origin (CORS)

A deployed app runs at `https://<appHost>.sanity.studio` and makes **authenticated** browser requests to the Sanity API. Add that origin to the project's CORS allowlist **with credentials**, or you'll see:

```
Request error while attempting to reach https://<projectId>.api.sanity.io/…/datasets/<dataset>/acl
```

Add the app's host (find it under your org's Apps):

```bash
cd apps/studio && npx sanity cors add https://<appHost>.sanity.studio --credentials
```

Or use Manage → **API → CORS origins**. A single wildcard `https://*.sanity.studio` (with credentials) covers every Sanity-hosted app and survives app re-creation, but it's broader — scope to the specific hosts if you prefer tighter security. (CORS only permits the request; the API still enforces auth.)

## Hosted apps & the localhost URL caveat

`SANITY_APP_*` vars are baked into the app bundle **at build time**. If you deploy with `SANITY_APP_RENDER_API_URL` pointing at `http://localhost:3000`, the hosted app will call your local machine. That's fine while `pnpm dev:web` is running. To use the app fully hosted:

1. Deploy the web app (see the root README → Deploy).
2. Set `SANITY_APP_RENDER_API_URL` to the deployed web URL.
3. Re-run `pnpm deploy:video` (non-interactive now).

## Security

The video app ships `SANITY_APP_RENDER_SECRET` in its client bundle (that's how the browser triggers a render). Acceptable for local/demo or an auth-gated app; for public production, move the render trigger behind a route that authenticates the Sanity session rather than a shared bearer.
