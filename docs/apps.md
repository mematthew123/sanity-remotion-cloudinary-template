# The Sanity App SDK apps

Two dashboard apps built with `@sanity/sdk` + `@sanity/sdk-react`. They run locally with `sanity dev` and deploy to your Sanity organization's dashboard with `sanity deploy`.

## `apps/video` — the video editor

The interactive alternative to the Studio's "Render" document action:

- **Post list** (`useDocuments` + `useDocumentProjection`) — pick a post.
- **Live preview** — a `@remotion/player` `<Player>` renders the selected composition with the post's data in real time.
- **Edit captions** — the `videoCopy` slots are edited via `useEditDocument`, so changes **persist to the post** (per the App SDK rule: don't hold content in local state). Preview-only knobs (e.g. duration) stay local.
- **Render** — POSTs `{compositionId, inputProps, postId}` to `SANITY_APP_RENDER_API_URL` with the bearer secret, and shows rendering/ready/error state.

## `apps/cloudinary` — the asset manager

Four tabs:

- **Assets** / **Transform** — browse, search, and transform Cloudinary assets via the web app's `/api/cloudinary/*` proxy (server-side Cloudinary auth; the app only needs `SANITY_APP_API_BASE`).
- **Videos** / **Sync** — list `video` docs and a status dashboard, read via the App SDK (`useDocuments` / `useDocumentProjection`).

## SDK conventions (from the `app-sdk` rule)

- Stable `@sanity/sdk` + `@sanity/sdk-react`; `<SanityApp config fallback>` at the root.
- Prefer `useDocuments` / `useDocumentProjection` / `useDocument` / `useEditDocument` over raw `useQuery`.
- Wrap every data-fetching component in `<Suspense>`; use `documentId` as the React key.
- Env uses the `SANITY_APP_*` prefix (`process.env.SANITY_APP_*`).

## Local development

```bash
pnpm dev:video        # needs SANITY_APP_ORGANIZATION_ID
pnpm dev:cloudinary
```

You don't have to deploy to use the apps — `sanity dev` runs them locally against your project.

## Deploying

```bash
pnpm deploy:video
pnpm deploy:cloudinary
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

## Hosted apps & the localhost URL caveat

`SANITY_APP_*` vars are baked into the app bundle **at build time**. If you deploy with `SANITY_APP_RENDER_API_URL` / `SANITY_APP_API_BASE` pointing at `http://localhost:3000`, the hosted app will call your local machine. That's fine while `pnpm dev:web` is running. To use the apps fully hosted:

1. Deploy the web app (see the root README → Deploy).
2. Set `SANITY_APP_RENDER_API_URL` / `SANITY_APP_API_BASE` to the deployed web URL.
3. Re-run `pnpm deploy:video` / `pnpm deploy:cloudinary` (non-interactive now).

## Security

The video app ships `SANITY_APP_RENDER_SECRET` in its client bundle (that's how the browser triggers a render). Acceptable for local/demo or an auth-gated app; for public production, move the render trigger behind a route that authenticates the Sanity session rather than a shared bearer.
