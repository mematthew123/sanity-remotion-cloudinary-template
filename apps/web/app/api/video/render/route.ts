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

import {bundleRemotionProject} from './helpers'
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

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${RENDER_SECRET}`) {
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

    const filename = `${validatedProps.title}-${compositionId}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')

    // Spin up a Vercel Sandbox. On Vercel resume from the build-time snapshot
    // (fast, includes the bundle); locally create a fresh one and add the
    // bundle per request. Narrated renders are CPU-bound, so give them 8 vCPU
    // to render frames in parallel; promo/teaser stay on the default.
    const isLongForm = compositionId === 'article-narrated'
    const sandboxVcpus = isLongForm ? 8 : undefined

    sandbox = process.env.VERCEL
      ? await restoreSnapshot({vcpus: sandboxVcpus})
      : await createSandbox()

    // Default sandbox timeout is 5 min; narrated renders take 5–7 min of work,
    // so extend it (bounded by the route's maxDuration).
    if (isLongForm) {
      await sandbox.extendTimeout(25 * 60 * 1000)
    }

    if (!process.env.VERCEL) {
      bundleRemotionProject('.remotion-bundle')
      await addBundleToSandbox({sandbox, bundleDir: '.remotion-bundle'})
    }

    // Render inside the sandbox (output written to a path in the VM). Wrapped
    // in a soft timeout firing ~80s before `maxDuration` so the catch block can
    // mark the doc `failed` and clean up before the platform hard-kills us —
    // otherwise the doc stays stuck in `rendering` forever.
    const RENDER_SOFT_TIMEOUT_MS = (maxDuration - 80) * 1000
    let lastStage = 'starting'
    let lastRenderedFrames = 0
    let lastEncodedFrames = 0

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

    const durationSeconds =
      (durationInFrames ?? meta.defaultDurationFrames) / (fps ?? meta.fps)

    // Upload to Cloudinary directly from the Blob URL — no buffering.
    await sanityClient.patch(sanityDocId).set({status: 'uploading'}).commit()

    // Long-form eagers (youtube-1080p-mp4, podcast-mp3) take minutes; running
    // them sync would blow past `maxDuration`. Async eagers return immediately
    // and the deterministic variant URLs resolve lazily on first request.
    const uploadResult = (await cloudinary.uploader.upload(stagedBlobUrl, {
      resource_type: 'video',
      folder: 'template/videos',
      public_id: filename,
      overwrite: true,
      eager: eagerTransformsFor(meta.variantIds),
      eager_async: isLongForm,
    })) as {public_id: string; secure_url: string}

    // Canonical MP4 is in Cloudinary now; drop the Blob staging copy
    // (best-effort).
    try {
      await deleteBlob(stagedBlobUrl, {token: BLOB_TOKEN})
      blobUrl = null
    } catch (cleanupError) {
      console.warn('Failed to delete Vercel Blob staging file:', cleanupError)
    }

    // Snapshot every variant URL onto the doc. cloudName is required for the
    // upload above, but guard anyway and skip variants if absent.
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const variants = cloudName
      ? snapshotVariants(cloudName, uploadResult.public_id, meta.variantIds)
      : undefined

    // Cloudinary videos are immediately available — no webhook.
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

    // Clean up an orphaned Blob staging file if a step after upload threw.
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
