import {NextRequest, NextResponse} from 'next/server'
import {renderMedia, selectComposition} from '@remotion/renderer'
import {createClient} from '@sanity/client'
import {v2 as cloudinary} from 'cloudinary'
import chromium from '@sparticuz/chromium'
import path from 'path'
import fs from 'fs'
// Import from /registry, not the package barrel: the barrel re-exports Remotion
// components, which evaluate hooks like `useCurrentFrame` at module load.
// Pulling those into a server route breaks page-data collection ("Remotion
// requires React.createContext") and causes Turbopack export-resolution
// flakiness on Vercel. /registry is pure, React-free metadata.
import {findComposition} from '@template/video-core/registry'

export const maxDuration = 300 // Vercel Pro: up to 300s

// Secrets come from the environment only — no hardcoded fallbacks.
const RENDER_SECRET = process.env.VIDEO_RENDER_SECRET

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

  let outputPath: string | null = null
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

    // Check for the Remotion bundle (produced by `pnpm build:remotion`).
    const bundleDir = path.resolve(process.cwd(), '.remotion-bundle')
    if (!fs.existsSync(path.join(bundleDir, 'index.html'))) {
      return NextResponse.json(
        {error: 'Remotion bundle not found. Run: pnpm build:remotion'},
        {status: 500, headers: corsHeaders},
      )
    }

    const serveUrl = bundleDir

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

    // On Vercel, use @sparticuz/chromium; locally use system Chrome.
    const isVercel = !!process.env.VERCEL
    const browserExecutable = isVercel ? await chromium.executablePath() : undefined

    // Resolve the composition
    const composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps: validatedProps,
      browserExecutable,
      chromeMode: 'headless-shell',
    })

    // Override dimensions/duration if provided
    if (durationInFrames) composition.durationInFrames = durationInFrames
    if (fps) composition.fps = fps
    if (width) composition.width = width
    if (height) composition.height = height

    // Render to /tmp
    const timestamp = Date.now()
    const filename = `${validatedProps.title}-${compositionId}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
    outputPath = path.join('/tmp', `${filename}-${timestamp}.mp4`)

    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: validatedProps,
      browserExecutable,
      chromeMode: 'headless-shell',
    })

    const fileBuffer = fs.readFileSync(outputPath)
    const durationSeconds =
      (durationInFrames ?? composition.durationInFrames) / (fps ?? composition.fps)

    // Upload to Cloudinary
    await sanityClient.patch(sanityDocId).set({status: 'uploading'}).commit()

    const uploadResult = await new Promise<{public_id: string; secure_url: string}>(
      (resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
            folder: 'template/videos',
            public_id: filename,
            overwrite: true,
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result as {public_id: string; secure_url: string})
          },
        )
        uploadStream.end(fileBuffer)
      },
    )

    // Cloudinary videos are immediately available — no webhook needed.
    await sanityClient
      .patch(sanityDocId)
      .set({
        status: 'ready',
        cloudinaryPublicId: uploadResult.public_id,
        cloudinaryUrl: uploadResult.secure_url,
        duration: Math.round(durationSeconds * 10) / 10,
        renderedAt: new Date().toISOString(),
      })
      .commit()

    console.log('Video uploaded to Cloudinary, status: ready', {
      sanityDocId,
      cloudinaryPublicId: uploadResult.public_id,
    })

    // Clean up temp file
    try {
      fs.unlinkSync(outputPath)
    } catch {
      /* ignore */
    }

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

    // Clean up temp file if it exists
    if (outputPath) {
      try {
        fs.unlinkSync(outputPath)
      } catch {
        // Ignore cleanup errors
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
