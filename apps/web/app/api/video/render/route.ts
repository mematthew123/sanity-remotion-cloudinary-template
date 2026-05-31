import {NextRequest, NextResponse} from 'next/server'
import {
  renderMediaOnLambda,
  getRenderProgress,
  deleteRender,
  type AwsRegion,
} from '@remotion/lambda/client'
import {createClient} from '@sanity/client'
import {v2 as cloudinary} from 'cloudinary'
// Import from /registry, not the package barrel: the barrel re-exports Remotion
// components, which evaluate hooks like `useCurrentFrame` at module load.
// Pulling those into a server route breaks page-data collection ("Remotion
// requires React.createContext") and causes Turbopack export-resolution
// flakiness on Vercel. /registry is pure, React-free metadata.
import {findComposition, eagerTransformsFor, snapshotVariants} from '@template/video-core/registry'

export const maxDuration = 300 // Vercel Pro: up to 300s

// Secrets come from the environment only — no hardcoded fallbacks.
const RENDER_SECRET = process.env.VIDEO_RENDER_SECRET

// Remotion Lambda config. The function name + serve URL are produced by the
// deploy commands (`pnpm deploy:lambda:fn` / `deploy:lambda:site`); see
// docs/lambda.md. Rendering runs on AWS, so the Vercel function carries no
// Chromium or compositor binary.
const LAMBDA_REGION = (process.env.REMOTION_LAMBDA_REGION || 'us-east-1') as AwsRegion
const LAMBDA_FUNCTION_NAME = process.env.REMOTION_LAMBDA_FUNCTION_NAME
const LAMBDA_SERVE_URL = process.env.REMOTION_LAMBDA_SERVE_URL

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

  if (!LAMBDA_FUNCTION_NAME || !LAMBDA_SERVE_URL) {
    return NextResponse.json(
      {
        error:
          'Remotion Lambda not configured (set REMOTION_LAMBDA_FUNCTION_NAME and REMOTION_LAMBDA_SERVE_URL — see docs/lambda.md)',
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

    // Kick off the render on AWS Lambda. The serve URL is a Remotion site
    // bundle uploaded to S3 (`pnpm deploy:lambda:site`); the function is a
    // pre-deployed renderer (`pnpm deploy:lambda:fn`). `privacy: 'public'` makes
    // the output a public S3 URL so Cloudinary can fetch it directly below.
    const {renderId, bucketName} = await renderMediaOnLambda({
      region: LAMBDA_REGION,
      functionName: LAMBDA_FUNCTION_NAME,
      serveUrl: LAMBDA_SERVE_URL,
      composition: compositionId,
      inputProps: validatedProps,
      codec: 'h264',
      privacy: 'public',
      ...(width ? {forceWidth: width} : {}),
      ...(height ? {forceHeight: height} : {}),
    })

    // Poll until the Lambda render finishes. Bounded by maxDuration (300s).
    let outputUrl: string | undefined
    while (!outputUrl) {
      const progress = await getRenderProgress({
        renderId,
        bucketName,
        functionName: LAMBDA_FUNCTION_NAME,
        region: LAMBDA_REGION,
      })
      if (progress.fatalErrorEncountered) {
        throw new Error(progress.errors[0]?.message ?? 'Lambda render failed')
      }
      if (progress.done) {
        outputUrl = progress.outputFile ?? undefined
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
    if (!outputUrl) {
      throw new Error('Lambda render finished without an output file')
    }

    const durationSeconds =
      (durationInFrames ?? meta.defaultDurationFrames) / (fps ?? meta.fps)

    // Upload to Cloudinary directly from the Lambda output URL — no buffering.
    await sanityClient.patch(sanityDocId).set({status: 'uploading'}).commit()

    const uploadResult = (await cloudinary.uploader.upload(outputUrl, {
      resource_type: 'video',
      folder: 'template/videos',
      public_id: filename,
      overwrite: true,
      // Materialize the composition's eager variants synchronously at upload
      // time so their URLs are valid the moment we patch the doc. The canonical
      // render stays a single MP4; variants are Cloudinary derivations of it
      // (no extra renders).
      eager: eagerTransformsFor(meta.variantIds),
      eager_async: false,
    })) as {public_id: string; secure_url: string}

    // The canonical MP4 now lives in Cloudinary, so drop the Lambda S3 copy.
    // Best-effort: a failure here doesn't affect the rendered result.
    try {
      await deleteRender({
        region: LAMBDA_REGION,
        bucketName,
        renderId,
      })
    } catch (cleanupError) {
      console.warn('Failed to delete Lambda render from S3:', cleanupError)
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

    return NextResponse.json(
      {error: error instanceof Error ? error.message : 'Render failed'},
      {status: 500, headers: corsHeaders},
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {status: 200, headers: corsHeaders})
}
