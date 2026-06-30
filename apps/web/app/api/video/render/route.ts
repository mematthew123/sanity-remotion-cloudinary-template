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
// Import from /registry, not the barrel: the barrel re-exports Remotion
// components that evaluate hooks at module load, which breaks server routes
// ("Remotion requires React.createContext"). /registry is React-free metadata.
import {findComposition, eagerTransformsFor, snapshotVariants} from '@template/video-core/registry'
import {withCloudinaryAnalytics} from '@/lib/cloudinaryDelivery'
import {authorizeStudioRequest} from '@/lib/validateStudioUser'

import {unlink} from 'node:fs/promises'

import {bundleRemotionProject, renderLocally} from './helpers'
import {restoreSnapshot} from './restore-snapshot'

export const maxDuration = 800 // Vercel Pro ceiling. Narrated renders take ~5-7 min; promo/teaser <60s.

const RENDER_SECRET = process.env.VIDEO_RENDER_SECRET

// Vercel Blob staging token — auto-injected when a Blob store is connected.
// Locally: `vercel link` + `vercel env pull`. See docs/vercel-sandbox.md.
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
  // Local render fallback: when not deployed on Vercel and either LOCAL_RENDER
  // is set or there's no Blob token, render with headless Chromium on this
  // machine and upload straight to Cloudinary — no Vercel Sandbox / Blob store
  // needed. This is what lets the template run with only Sanity + Cloudinary
  // configured. The hosted/sandbox path still requires BLOB_READ_WRITE_TOKEN.
  const useLocalRender =
    !process.env.VERCEL && (process.env.LOCAL_RENDER === 'true' || !BLOB_TOKEN)

  if (!useLocalRender && !BLOB_TOKEN) {
    return NextResponse.json(
      {
        error:
          'Vercel Sandbox not configured (set BLOB_READ_WRITE_TOKEN — connect a Vercel Blob store, see docs/vercel-sandbox.md — or set LOCAL_RENDER=true to render locally)',
      },
      {status: 500, headers: corsHeaders},
    )
  }

  const authHeader = req.headers.get('authorization')
  if (!(await authorizeStudioRequest(authHeader, RENDER_SECRET))) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401, headers: corsHeaders})
  }

  // Lazy-init the Sanity client so an unconfigured dev server returns a clean
  // error instead of crashing at module load.
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
  // Sandbox / Blob handles, tracked for cleanup on success and error paths.
  let sandbox: Awaited<ReturnType<typeof createSandbox>> | null = null
  let blobUrl: string | null = null
  // Local-render temp file, tracked for cleanup on success and error paths.
  let localFilePath: string | null = null

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

    // Idempotency: short-circuit if a ready/in-flight video already exists for
    // this post + template.
    if (postId) {
      const existing = await sanityClient.fetch<{
        _id: string
        status: string
        renderStartedAt: string | null
      } | null>(
        `*[_type == "video" && post._ref == $postId && template == $template && status in ["ready", "rendering", "uploading"]][0]{ _id, status, renderStartedAt }`,
        {postId, template: compositionId},
      )

      if (existing) {
        // `ready` is always a valid idempotent hit. A `rendering`/`uploading`
        // doc still in-flight past the render ceiling means its function was
        // killed (no render outlives the soft timeout) — reclaim it as `failed`
        // and fall through, else it blocks this post + template forever.
        const startedAt = existing.renderStartedAt ? Date.parse(existing.renderStartedAt) : NaN
        const ageMs = Number.isNaN(startedAt) ? Infinity : Date.now() - startedAt
        const isStale = existing.status !== 'ready' && ageMs > (maxDuration + 60) * 1000

        if (!isStale) {
          return NextResponse.json(
            {success: true, documentId: existing._id, status: existing.status, idempotent: true},
            {status: 200, headers: corsHeaders},
          )
        }

        await sanityClient
          .patch(existing._id)
          .set({
            status: 'failed',
            errorMessage:
              'Render did not finish and was reclaimed (the function was likely killed mid-render). A new render was started.',
          })
          .commit()
          .catch(() => undefined)
      }
    }

    // Create the video doc (status: 'rendering'). It back-references its post;
    // we never write a videos[] array onto the post.
    const sanityDoc = await sanityClient.create({
      _type: 'video',
      title: `${validatedProps.title} — ${meta.label}`,
      status: 'rendering',
      renderStartedAt: new Date().toISOString(),
      ...(postId ? {post: {_type: 'reference', _ref: postId}} : {}),
      format: 'mp4',
      template: compositionId,
      width: width ?? meta.width,
      height: height ?? meta.height,
      inputProps: JSON.stringify(validatedProps),
    })

    sanityDocId = sanityDoc._id
    console.log('Video document created with status: rendering', sanityDocId)

    // Fold the post id (or doc id) into the public_id so two different posts
    // sharing a title + composition don't collide on one asset — `overwrite:
    // true` below would let the second clobber the first. Keying on postId
    // keeps a re-render of the same post idempotent (overwrites its own asset).
    const idSuffix = (postId ?? sanityDocId).replace(/[^a-z0-9]/gi, '').slice(-8)
    const filename = `${validatedProps.title}-${compositionId}-${idSuffix}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')

    // Narrated renders are CPU-bound, so give them 8 vCPU on the sandbox to
    // render frames in parallel; promo/teaser stay on the default.
    const isLongForm = compositionId === 'article-narrated'
    const sandboxVcpus = isLongForm ? 8 : undefined

    // Soft timeout firing ~80s before `maxDuration` so the catch block can mark
    // the doc `failed` and clean up before the platform hard-kills us —
    // otherwise the doc stays stuck in `rendering` forever. Shared by both the
    // sandbox and local render paths.
    const RENDER_SOFT_TIMEOUT_MS = (maxDuration - 80) * 1000
    let lastStage = 'starting'
    let lastRenderedFrames = 0
    let lastEncodedFrames = 0

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Render exceeded soft timeout of ${RENDER_SOFT_TIMEOUT_MS / 1000}s ` +
              `(lastStage=${lastStage}, renderedFrames=${lastRenderedFrames}, ` +
              `encodedFrames=${lastEncodedFrames})`,
          ),
        )
      }, RENDER_SOFT_TIMEOUT_MS)
    })

    // Produce the canonical MP4, then expose it to Cloudinary as `uploadSource`:
    // a local file path (local render) or a public Blob URL (sandbox render).
    // cloudinary.uploader.upload() accepts either.
    let uploadSource: string

    if (useLocalRender) {
      // Local fallback: render with headless Chromium on this machine. No
      // Vercel Sandbox, no Blob staging.
      lastStage = 'local-render'
      const renderPromise = renderLocally({
        bundleDir: '.remotion-bundle',
        compositionId,
        inputProps: validatedProps,
        onProgress: ({renderedFrames, encodedFrames}) => {
          lastRenderedFrames = renderedFrames
          lastEncodedFrames = encodedFrames
        },
      })

      const {filePath} = await Promise.race([renderPromise, timeoutPromise])
      localFilePath = filePath
      uploadSource = filePath
    } else {
      // Unreachable — the guard above returns when the sandbox path lacks a
      // Blob token — but it narrows BLOB_TOKEN to a string for the upload below.
      if (!BLOB_TOKEN) {
        throw new Error('BLOB_READ_WRITE_TOKEN required for the Vercel Sandbox render path')
      }

      // Spin up a Vercel Sandbox. On Vercel resume from the build-time snapshot
      // (fast, includes the bundle); locally create a fresh one and add the
      // bundle per request.
      sandbox = process.env.VERCEL
        ? await restoreSnapshot({vcpus: sandboxVcpus})
        : await createSandbox()

      // Default sandbox timeout is 5 min; narrated renders take 5–7 min of
      // work, so extend it (bounded by the route's maxDuration).
      if (isLongForm) {
        await sandbox.extendTimeout(25 * 60 * 1000)
      }

      if (!process.env.VERCEL) {
        bundleRemotionProject('.remotion-bundle')
        await addBundleToSandbox({sandbox, bundleDir: '.remotion-bundle'})
      }

      // Render inside the sandbox (output written to a path in the VM).
      const renderPromise = renderMediaOnVercel({
        sandbox,
        compositionId,
        inputProps: validatedProps,
        codec: 'h264',
        // Match concurrency to vCPU count; the default auto-detect often
        // resolves to 1 in the sandbox and serializes frames.
        ...(sandboxVcpus ? {concurrency: sandboxVcpus} : {}),
        onProgress: (progress) => {
          lastStage = progress.stage
          if (progress.stage === 'render-progress') {
            lastRenderedFrames = progress.progress.renderedFrames
            lastEncodedFrames = progress.progress.encodedFrames
          }
        },
      })

      const {sandboxFilePath, contentType} = await Promise.race([renderPromise, timeoutPromise])

      // Stage the MP4 on Vercel Blob with a public URL so Cloudinary can fetch
      // it directly.
      const {url: stagedBlobUrl} = await uploadToVercelBlob({
        sandbox,
        sandboxFilePath,
        contentType,
        blobToken: BLOB_TOKEN,
        access: 'public',
      })
      blobUrl = stagedBlobUrl
      uploadSource = stagedBlobUrl
    }

    const durationSeconds =
      (durationInFrames ?? meta.defaultDurationFrames) / (fps ?? meta.fps)

    // Upload to Cloudinary directly from the file path / Blob URL — no buffering.
    await sanityClient.patch(sanityDocId).set({status: 'uploading'}).commit()

    // Long-form eagers (youtube-1080p-mp4, podcast-mp3) take minutes; running
    // them sync would blow past `maxDuration`. Async eagers return immediately
    // and the deterministic variant URLs resolve lazily on first request.
    const uploadResult = (await cloudinary.uploader.upload(uploadSource, {
      resource_type: 'video',
      folder: 'template/videos',
      public_id: filename,
      overwrite: true,
      eager: eagerTransformsFor(meta.variantIds),
      eager_async: isLongForm,
    })) as {public_id: string; secure_url: string}

    // Canonical MP4 is in Cloudinary now; drop the staging copy (best-effort) —
    // the local temp file or the Blob staging object, whichever produced it.
    try {
      if (localFilePath) {
        await unlink(localFilePath)
        localFilePath = null
      } else if (blobUrl) {
        await deleteBlob(blobUrl, {token: BLOB_TOKEN})
        blobUrl = null
      }
    } catch (cleanupError) {
      console.warn('Failed to delete render staging file:', cleanupError)
    }

    // Snapshot every variant URL onto the doc. cloudName is required for the
    // upload above, but guard anyway and skip variants if absent.
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME

    // Stamp the Cloudinary SDK analytics signature onto every delivery URL we
    // persist, so Cloudinary attributes delivery to this integration (a
    // Partner-Built requirement). Transforms still come from VARIANTS.
    const cloudinaryUrl = cloudName
      ? withCloudinaryAnalytics(cloudName, uploadResult.secure_url)
      : uploadResult.secure_url
    const variants = cloudName
      ? snapshotVariants(cloudName, uploadResult.public_id, meta.variantIds).map(
          (v) => ({...v, url: withCloudinaryAnalytics(cloudName, v.url)}),
        )
      : undefined

    // Cloudinary videos are immediately available — no webhook.
    await sanityClient
      .patch(sanityDocId)
      .set({
        status: 'ready',
        cloudinaryPublicId: uploadResult.public_id,
        cloudinaryUrl,
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
        cloudinaryUrl,
      },
      {status: 200, headers: corsHeaders},
    )
  } catch (error) {
    console.error('Render error:', error)

    // Mark the doc failed if it was created.
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
        // ignore patch errors during error handling
      }
    }

    // Clean up an orphaned staging file if a step after render threw.
    if (localFilePath) {
      try {
        await unlink(localFilePath)
      } catch {
        // ignore
      }
    }
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
    // Stop explicitly to release the slot now rather than at the idle timeout.
    if (sandbox) {
      await sandbox.stop().catch(() => undefined)
    }
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {status: 200, headers: corsHeaders})
}
