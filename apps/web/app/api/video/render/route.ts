import {NextRequest, NextResponse} from 'next/server'
import {
  addBundleToSandbox,
  createSandbox,
  renderMediaOnVercel,
  uploadToVercelBlob,
} from '@remotion/vercel'
import {del as deleteBlob} from '@vercel/blob'
import {createClient} from '@sanity/client'
import {v2 as cloudinary} from 'cloudinary'
// Import from /registry, not the package barrel: the barrel re-exports Remotion
// components, which evaluate hooks like `useCurrentFrame` at module load.
// Pulling those into a server route breaks page-data collection ("Remotion
// requires React.createContext") and causes Turbopack export-resolution
// flakiness on Vercel. /registry is pure, React-free metadata.
import {findComposition, eagerTransformsFor, snapshotVariants} from '@template/video-core/registry'

import {bundleRemotionProject} from './helpers'
import {restoreSnapshot} from './restore-snapshot'

export const maxDuration = 800 // Vercel Pro's function-execution ceiling. Article-narrated renders an 8-min reading in ~5-7 min; promo/teaser still finish well under 60s.

// Secrets come from the environment only — no hardcoded fallbacks.
const RENDER_SECRET = process.env.VIDEO_RENDER_SECRET

// Vercel Blob staging token. On Vercel deployments this is auto-injected when a
// Blob store is connected to the project. Locally, run `vercel link` + `vercel
// env pull apps/web/.env.local` to fetch it. See docs/vercel-sandbox.md.
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function POST(req: NextRequest) {
  if (!RENDER_SECRET) {
    return NextResponse.json(
      {error: 'VIDEO_RENDER_SECRET not configured'},
      {status: 500, headers: corsHeaders},
    )
  }

  if (!BLOB_TOKEN) {
    return NextResponse.json(
      {
        error:
          'Vercel Sandbox not configured (set BLOB_READ_WRITE_TOKEN — connect a Vercel Blob store, see docs/vercel-sandbox.md)',
      },
      {status: 500, headers: corsHeaders},
    )
  }

  // Auth check
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${RENDER_SECRET}`) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401, headers: corsHeaders})
  }

  // Lazy-init the Sanity client so a not-yet-configured dev server returns a
  // clean error instead of crashing at module load (createClient throws when
  // projectId is undefined).
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
  const token = process.env.SANITY_API_WRITE_TOKEN
  if (!projectId || !dataset || !token) {
    return NextResponse.json(
      {
        error:
          'Sanity not configured (set NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_WRITE_TOKEN)',
      },
      {status: 500, headers: corsHeaders},
    )
  }
  const sanityClient = createClient({
    projectId,
    dataset,
    apiVersion: '2024-01-01',
    useCdn: false,
    token,
  })

  let sanityDocId: string | null = null
  // Vercel Sandbox / Blob handles for cleanup on success and error paths.
  let sandbox: Awaited<ReturnType<typeof createSandbox>> | null = null
  let blobUrl: string | null = null

  try {
    const body = await req.json()
    const {compositionId, inputProps, durationInFrames, fps, width, height, postId} = body

    if (!compositionId) {
      return NextResponse.json(
        {error: 'Missing compositionId'},
        {status: 400, headers: corsHeaders},
      )
    }

    const meta = findComposition(compositionId)
    if (!meta) {
      return NextResponse.json(
        {error: `Unknown compositionId: ${compositionId}`},
        {status: 400, headers: corsHeaders},
      )
    }

    const propsResult = meta.schema.safeParse(inputProps)
    if (!propsResult.success) {
      return NextResponse.json(
        {error: 'Invalid inputProps', details: propsResult.error.flatten()},
        {status: 400, headers: corsHeaders},
      )
    }
    const validatedProps = propsResult.data as {title: string}

    // Idempotency: skip if a video already exists for this post + template
    // and is ready or in flight, so we don't double-render.
    if (postId) {
      const existing = await sanityClient.fetch<{_id: string; status: string} | null>(
        `*[_type == "video" && post._ref == $postId && template == $template && status in ["ready", "rendering", "uploading"]][0]{ _id, status }`,
        {postId, template: compositionId},
      )

      if (existing) {
        return NextResponse.json(
          {success: true, documentId: existing._id, status: existing.status, idempotent: true},
          {status: 200, headers: corsHeaders},
        )
      }
    }

    // Create the Sanity video document with status: 'rendering'. The video
    // back-references its source post; we never write a videos[] array onto
    // the post.
    const sanityDoc = await sanityClient.create({
      _type: 'video',
      title: `${validatedProps.title} — ${meta.label}`,
      status: 'rendering',
      renderStartedAt: new Date().toISOString(),
      ...(postId ? {post: {_type: 'reference', _ref: postId, _weak: true}} : {}),
      format: 'mp4',
      template: compositionId,
      width: width ?? meta.width,
      height: height ?? meta.height,
      inputProps: JSON.stringify(validatedProps),
    })

    sanityDocId = sanityDoc._id
    console.log('Video document created with status: rendering', sanityDocId)

    const filename = `${validatedProps.title}-${compositionId}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')

    // Spin up a Vercel Sandbox. On Vercel we resume from a snapshot baked at
    // build time (scripts/create-snapshot.ts) — fast and includes the Remotion
    // bundle. Locally we create a fresh sandbox and add the bundle per
    // request (slower; matches the reference template's dev fallback).
    sandbox = process.env.VERCEL ? await restoreSnapshot() : await createSandbox()

    // The sandbox is created with a 5-minute timeout by default
    // (@remotion/vercel's createSandbox + our restore-snapshot.ts constant).
    // Long-form narrated renders take 5–7 minutes of actual render work, so
    // extend the budget for the article-narrated composition. The render
    // route's outer maxDuration (800s on Pro) is the upper bound.
    if (compositionId === 'article-narrated') {
      await sandbox.extendTimeout(25 * 60 * 1000)
    }

    if (!process.env.VERCEL) {
      bundleRemotionProject('.remotion-bundle')
      await addBundleToSandbox({sandbox, bundleDir: '.remotion-bundle'})
    }

    // Render inside the sandbox. Output is written to a path inside the VM.
    const {sandboxFilePath, contentType} = await renderMediaOnVercel({
      sandbox,
      compositionId,
      inputProps: validatedProps,
      codec: 'h264',
    })

    // Stage the rendered MP4 in Vercel Blob with a public URL so Cloudinary can
    // fetch it directly — same shape as the old Lambda→S3 handoff, just with
    // Blob in place of S3.
    const {url: stagedBlobUrl} = await uploadToVercelBlob({
      sandbox,
      sandboxFilePath,
      contentType,
      blobToken: BLOB_TOKEN,
      access: 'public',
    })
    blobUrl = stagedBlobUrl

    const durationSeconds =
      (durationInFrames ?? meta.defaultDurationFrames) / (fps ?? meta.fps)

    // Upload to Cloudinary directly from the Blob URL — no buffering.
    await sanityClient.patch(sanityDocId).set({status: 'uploading'}).commit()

    // Long-form renders ask Cloudinary to transcode the full video (e.g.
    // youtube-1080p-mp4) and extract the full podcast-mp3. With sync eagers
    // that blocks the render function for multiple minutes on top of the
    // already-long render — enough to blow past `maxDuration` and leave the
    // doc stuck in `rendering` because the platform hard-kills the process
    // before the catch block can mark it `failed`. Async eagers let
    // Cloudinary queue the derivations and return immediately; the variant
    // URLs are deterministic and resolve lazily on first request.
    const isLongForm = compositionId === 'article-narrated'

    const uploadResult = (await cloudinary.uploader.upload(stagedBlobUrl, {
      resource_type: 'video',
      folder: 'template/videos',
      public_id: filename,
      overwrite: true,
      eager: eagerTransformsFor(meta.variantIds),
      eager_async: isLongForm,
    })) as {public_id: string; secure_url: string}

    // The canonical MP4 now lives in Cloudinary, so drop the Blob staging
    // copy. Best-effort: a failure here doesn't affect the rendered result.
    try {
      await deleteBlob(stagedBlobUrl, {token: BLOB_TOKEN})
      blobUrl = null
    } catch (cleanupError) {
      console.warn('Failed to delete Vercel Blob staging file:', cleanupError)
    }

    // Snapshot every variant URL for this composition onto the doc. cloudName
    // comes from the env only; it's required for the upload above, so it should
    // be present here — but guard anyway and skip variants gracefully if not.
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const variants = cloudName
      ? snapshotVariants(cloudName, uploadResult.public_id, meta.variantIds)
      : undefined

    // Cloudinary videos are immediately available — no webhook needed.
    await sanityClient
      .patch(sanityDocId)
      .set({
        status: 'ready',
        cloudinaryPublicId: uploadResult.public_id,
        cloudinaryUrl: uploadResult.secure_url,
        duration: Math.round(durationSeconds * 10) / 10,
        renderedAt: new Date().toISOString(),
        ...(variants ? {variants} : {}),
      })
      .commit()

    console.log('Video uploaded to Cloudinary, status: ready', {
      sanityDocId,
      cloudinaryPublicId: uploadResult.public_id,
    })

    return NextResponse.json(
      {
        success: true,
        documentId: sanityDocId,
        status: 'ready',
        cloudinaryUrl: uploadResult.secure_url,
      },
      {status: 200, headers: corsHeaders},
    )
  } catch (error) {
    console.error('Render error:', error)

    // If we already created a Sanity doc, mark it as failed.
    if (sanityDocId) {
      try {
        await sanityClient
          .patch(sanityDocId)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Render failed',
          })
          .commit()
      } catch {
        // Ignore patch errors during error handling
      }
    }

    // Best-effort cleanup of an orphaned Blob staging file when the render
    // succeeded but a later step (Cloudinary, Sanity patch) threw.
    if (blobUrl) {
      try {
        await deleteBlob(blobUrl, {token: BLOB_TOKEN})
      } catch {
        // ignore
      }
    }

    return NextResponse.json(
      {error: error instanceof Error ? error.message : 'Render failed'},
      {status: 500, headers: corsHeaders},
    )
  } finally {
    // The sandbox is ephemeral but stopping it explicitly releases the slot
    // immediately rather than waiting for the 5-minute idle timeout.
    if (sandbox) {
      await sandbox.stop().catch(() => undefined)
    }
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {status: 200, headers: corsHeaders})
}
