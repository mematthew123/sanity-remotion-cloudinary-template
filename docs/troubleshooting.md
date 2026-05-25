# Troubleshooting

Real issues you're likely to hit, with the actual fix.

## Render returns 401 `Session not found`

```json
{"errorCode":"SIO-401-ANF","error":"Unauthorized","message":"Session not found"}
```

`SANITY_API_WRITE_TOKEN` isn't a valid Sanity API token (a name, a partial paste, or some other credential). Create a real one at **Manage → project → API → Tokens** (role **Editor**). Verify:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://<projectId>.api.sanity.io/v2024-01-01/data/query/<dataset>?query=count(*)"
```

## Render returns 401 `projectUserNotFoundError`

```json
{"type":"projectUserNotFoundError","description":"project user not found for user ID \"…\" in project \"…\""}
```

The token authenticates but its identity **isn't a member of this project** — typically a personal, CLI, or org-admin token. Fix: create the token **from that project's** API → Tokens screen (which mints a project robot member with the chosen role), not from elsewhere. The same value must pass the `count(*)` check above.

## Site shows no content / queries return nothing

The web client reads published content with **no token**, which requires a **public** dataset. Either make the dataset public (Manage → API → Datasets) or add a read token to `apps/web/lib/sanity.client.ts`.

## `Remotion bundle not found. Run: pnpm build:remotion`

The render route serves compositions from `apps/web/.remotion-bundle/`, produced by `pnpm build:remotion` (which also runs before `next build`). If you render in `dev`, run `pnpm build:remotion` once. Re-run it after changing compositions.

## First `sanity deploy` of an app hangs or errors

- `Error: Cannot run "input" prompt in a non-interactive environment` → the first deploy needs a **TTY** to ask for an application title. Run `npx sanity deploy` directly in the app dir, not through a wrapper that swallows the prompt; `-y` does **not** supply the title.
- Spinner stuck at `No application ID configured; checking for existing applications…` → it's waiting at the (under-rendered) title prompt. Type a title and press Enter.
- After the first deploy, pin `deployment: { appId: '…' }` in the app's `sanity.cli.ts` — subsequent deploys are non-interactive. See [apps.md](./apps.md#deploying).

## A deployed app calls `http://localhost:3000`

`SANITY_APP_*` vars are baked in at **build time**. Rebuild/redeploy the app with `SANITY_APP_RENDER_API_URL` / `SANITY_APP_API_BASE` set to your deployed web URL. See [apps.md](./apps.md#hosted-apps--the-localhost-url-caveat).

## App SDK env vars not picked up

App SDK apps read `process.env.SANITY_APP_*` (not `SANITY_STUDIO_*`). Put them in `apps/<app>/.env`; the Sanity CLI loads that file. Confirm with the "Including the following environment variables…" list printed during `sanity build`.

## `Remotion requires React.createContext` / Turbopack export errors

Something imported the `@template/video-core` **barrel** into a server route or the Studio. Server route + Studio schema must import `@template/video-core/registry` (React-free). Only `apps/web/remotion/Root.tsx` and the React apps may import the barrel. See [architecture.md](./architecture.md#the-react-free-registry-boundary).

## `react` / `react-dom` peer warnings on install

Pinned to a single version via `pnpm.overrides` in the root `package.json`. If warnings reappear after a dependency bump, align `react` and `react-dom` to the same exact version there.

## First local render pauses to download Chrome

Expected. Locally, Remotion downloads a headless Chrome on the first render; subsequent renders are fast. On Vercel it uses `@sparticuz/chromium` (kept in `serverExternalPackages` + traced into the function via `outputFileTracingIncludes`).

## Vercel: "Could not find Chrome" in the render function

The tracing globs didn't include `@sparticuz/chromium` / `@remotion/compositor-linux-x64-gnu`. Check `outputFileTracingIncludes['/api/video/render']` in `apps/web/next.config.ts` covers both the hoisted (`../../node_modules`) and local (`./node_modules`) paths, and set the function max duration to 300s.
