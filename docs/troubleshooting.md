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

## A social variant URL returns 400

Video crops using `g_auto` (content-aware gravity) require Cloudinary's AI add-on; without it the derived URL 400s (image crops are fine). The template's social variants use **`g_center`** instead, which is universally supported. If you add a video-crop variant in `video-core/src/registry.ts`, prefer `g_center` (or another fixed gravity) over `g_auto` unless your account has the add-on. Note: the `eager` upload array must use `raw_transformation` (not `transformation`) for raw transformation strings, or Cloudinary 400s with "Unknown transformation".

## Render returns `Remotion Lambda not configured`

The route renders on AWS Lambda and needs `REMOTION_LAMBDA_FUNCTION_NAME` and `REMOTION_LAMBDA_SERVE_URL` (plus `REMOTION_AWS_*` creds) in `apps/web/.env.local`. Deploy them with `pnpm deploy:lambda:fn` and `pnpm deploy:lambda:site` and copy the printed values into env. Full walkthrough in [lambda.md](./lambda.md).

## First `sanity deploy` of an app hangs or errors

- `Error: Cannot run "input" prompt in a non-interactive environment` → the first deploy needs a **TTY** to ask for an application title. Run `npx sanity deploy` directly in the app dir, not through a wrapper that swallows the prompt; `-y` does **not** supply the title.
- Spinner stuck at `No application ID configured; checking for existing applications…` → it's waiting at the (under-rendered) title prompt. Type a title and press Enter.
- After the first deploy, pin `deployment: { appId: '…' }` in the app's `sanity.cli.ts` — subsequent deploys are non-interactive. See [apps.md](./apps.md#deploying).

## A deployed app calls `http://localhost:3000`

`SANITY_APP_*` vars are baked in at **build time**. Rebuild/redeploy the app with `SANITY_APP_RENDER_API_URL` set to your deployed web URL. See [apps.md](./apps.md#hosted-apps--the-localhost-url-caveat).

## App SDK env vars not picked up

App SDK apps read `process.env.SANITY_APP_*` (not `SANITY_STUDIO_*`). Put them in `apps/<app>/.env`; the Sanity CLI loads that file. Confirm with the "Including the following environment variables…" list printed during `sanity build`.

## `Remotion requires React.createContext` / Turbopack export errors

Something imported the `@template/video-core` **barrel** into a server route or the Studio. Server route + Studio schema must import `@template/video-core/registry` (React-free). Only `apps/web/remotion/Root.tsx` and the React apps may import the barrel. See [architecture.md](./architecture.md#the-react-free-registry-boundary).

## `react` / `react-dom` peer warnings on install

Pinned to a single version via `pnpm.overrides` in the root `package.json`. If warnings reappear after a dependency bump, align `react` and `react-dom` to the same exact version there.

## Lambda render fails with `The function … does not exist` / version mismatch

A Lambda function is bound to **one AWS region and one Remotion version**. After upgrading Remotion (or switching region), redeploy: `pnpm deploy:lambda:fn`, then update `REMOTION_LAMBDA_FUNCTION_NAME` / `REMOTION_LAMBDA_REGION`. The function name encodes the version (e.g. `remotion-render-4-0-321-…`), so a stale env value points at a function that no longer exists.

## Lambda render can't open the site / blank or 403 on the serve URL

The serve URL must be a **deployed site bundle on S3**, regenerated whenever compositions change: `pnpm deploy:lambda:site`, then set `REMOTION_LAMBDA_SERVE_URL` to its output. Confirm the function's region matches the site's region.

## Cloudinary upload fails to fetch the Lambda output

The route renders with `privacy: 'public'` so Cloudinary can fetch the S3 URL directly. If your S3 bucket policy blocks public objects, either allow them or change the route to download the output to a buffer and upload that instead. The route deletes the S3 object after upload, so the public exposure is brief.

## AWS permission errors during deploy or render

Run `npx remotion lambda policies validate` to check the IAM user/role. If it fails, re-apply the policies printed by `npx remotion lambda policies user` and `npx remotion lambda policies role`. Confirm `REMOTION_AWS_ACCESS_KEY_ID` / `REMOTION_AWS_SECRET_ACCESS_KEY` are set for both the CLI (deploy) and the web app (render). See [lambda.md](./lambda.md).
