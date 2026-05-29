# Remotion Lambda

Rendering runs on **AWS Lambda** via [`@remotion/lambda`](https://www.remotion.dev/docs/lambda). The Next.js render route (`apps/web/app/api/video/render/route.ts`) doesn't render in-process — it invokes a pre-deployed Lambda function against a site bundle on S3, polls until the render finishes, then uploads the result to Cloudinary. This keeps Chromium and the Remotion compositor off the Vercel function entirely (no 250 MB packaging concern).

You do this once per AWS account, then redeploy the function/site only when you change compositions or bump Remotion.

## 1. Install

`@remotion/lambda` is already a dependency of `apps/web`. After `pnpm install`, the `remotion lambda` CLI is available via the package scripts below (it ships with `@remotion/cli`, which is also installed).

## 2. Create an AWS user + credentials

Create (or reuse) an AWS account, then an **IAM user** with programmatic access. Put its credentials in `apps/web/.env.local` using Remotion's prefixed names (so they don't collide with other AWS tooling):

```
REMOTION_AWS_ACCESS_KEY_ID=...
REMOTION_AWS_SECRET_ACCESS_KEY=...
REMOTION_LAMBDA_REGION=us-east-1   # optional; defaults to us-east-1
```

These same vars must be present in the shell when you run the deploy commands, and on the deployed web app at render time.

## 3. Attach the required policies

Remotion prints the exact policy JSON. From `apps/web`:

```bash
# Print the user policy → paste as an inline policy on the IAM user
npx remotion lambda policies user

# Print the role policy → create a role named `remotion-lambda-role` with it
npx remotion lambda policies role

# Verify the user + role are set up correctly
npx remotion lambda policies validate
```

`policies validate` must pass before deploying.

## 4. Deploy the render function

One function per **AWS region + Remotion version**:

```bash
pnpm deploy:lambda:fn      # → remotion lambda functions deploy
```

It prints a function name like `remotion-render-4-0-321-mem2048mb-disk2048mb-120sec`. Set it:

```
REMOTION_LAMBDA_FUNCTION_NAME=remotion-render-4-0-321-mem2048mb-disk2048mb-120sec
```

## 5. Deploy the site bundle

This bundles the Remotion entry (`apps/web/remotion/index.ts` → `Root.tsx`, with the Tailwind webpack override from `apps/web/remotion.config.ts`) and uploads it to S3:

```bash
pnpm deploy:lambda:site    # → remotion lambda sites create remotion/index.ts --site-name=template-video
```

It prints a **serve URL** like `https://remotionlambda-<region>-<hash>.s3.<region>.amazonaws.com/sites/template-video/index.html`. Set it:

```
REMOTION_LAMBDA_SERVE_URL=https://remotionlambda-…/sites/template-video/index.html
```

## 6. Render

With all five `REMOTION_*` vars set, the render route works end to end: trigger a render from Studio or the video editor app and watch the `video` doc move `rendering → uploading → ready`. The route:

1. `renderMediaOnLambda({ functionName, serveUrl, composition, inputProps, codec: 'h264', privacy: 'public' })`.
2. Polls `getRenderProgress` every ~2 s until `done` (bounded by the route's `maxDuration = 300`).
3. Uploads the resulting **public** S3 URL to Cloudinary (with the composition's eager variants).
4. Calls `deleteRender` to remove the S3 copy — the canonical MP4 then lives only in Cloudinary.

## Keeping it in sync

- **Changed a composition?** Re-run `pnpm deploy:lambda:site` so the new bundle is on S3.
- **Bumped Remotion?** Re-run **both** `pnpm deploy:lambda:fn` and `pnpm deploy:lambda:site`, then update `REMOTION_LAMBDA_FUNCTION_NAME` (the name encodes the version). A function deployed for an older version won't render a newer bundle.
- **Changed region?** Redeploy both in the new region and update `REMOTION_LAMBDA_REGION`.

## Notes & tradeoffs

- **Synchronous by design.** The route polls to completion inside the request so callers (Studio action, video editor app) keep reading `status: ready` + `cloudinaryUrl` from the response. Long renders are bounded by the Vercel function's 300 s `maxDuration` — the same ceiling as before.
- **Public output, briefly.** `privacy: 'public'` lets Cloudinary fetch the render by URL; `deleteRender` removes it right after upload. If your S3 bucket policy forbids public objects, either relax it or change the route to download the output to a buffer and upload that instead.
- **Cost.** Lambda + S3 usage is billed to your AWS account; Remotion Lambda is designed to stay within modest usage for typical render volumes.

See [troubleshooting.md](./troubleshooting.md) for the common Lambda failure modes (function/version mismatch, serve URL not deployed, AWS permission errors).
