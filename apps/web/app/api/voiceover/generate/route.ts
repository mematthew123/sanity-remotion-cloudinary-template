import {NextRequest, NextResponse} from 'next/server'
import {timingSafeEqual} from 'node:crypto'
import {generateVoiceoverForPost} from '@/lib/voiceoverGenerate'

// Editor-triggered voiceover generation. The Studio action POSTs here with
// `{postId, dryRun?}`; this route runs the same shared logic as the CLI
// (apps/web/scripts/generate-voiceover.ts) and patches `post.voiceoverChunks`.
//
// Reuses VIDEO_RENDER_SECRET intentionally — voiceover generation is the
// preparatory step of a video render, so it shares the render's threat model
// and the same bundled-in-Studio secret. One fewer env var to manage.

const RENDER_SECRET = process.env.VIDEO_RENDER_SECRET

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Generation runs sync; allow the full Pro-plan ceiling because a long post
// (30+ chunks) at ElevenLabs' rate-limited TTS endpoint can take ~3 minutes.
export const maxDuration = 800

export async function OPTIONS() {
  return new NextResponse(null, {status: 200, headers: corsHeaders})
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {...corsHeaders, ...(init?.headers ?? {})},
  })
}

function secureCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

export async function POST(req: NextRequest) {
  if (!RENDER_SECRET) {
    return jsonResponse({error: 'VIDEO_RENDER_SECRET not configured'}, {status: 500})
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    return jsonResponse({error: 'ELEVENLABS_API_KEY not configured'}, {status: 500})
  }

  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${RENDER_SECRET}`
  if (!authHeader || !secureCompare(authHeader, expected)) {
    return jsonResponse({error: 'Unauthorized'}, {status: 401})
  }

  const body = (await req.json().catch(() => ({}))) as {
    postId?: string
    voiceId?: string
    modelId?: string
    dryRun?: boolean
  }
  if (!body.postId) return jsonResponse({error: 'Missing postId'}, {status: 400})

  const voiceId = body.voiceId ?? process.env.ELEVENLABS_VOICE_ID
  if (!voiceId) {
    return jsonResponse(
      {error: 'No voice id. Pass voiceId in body or set ELEVENLABS_VOICE_ID on the web app.'},
      {status: 400},
    )
  }

  try {
    const result = await generateVoiceoverForPost({
      postId: body.postId,
      voiceId,
      modelId: body.modelId,
      dryRun: body.dryRun ?? false,
    })
    return jsonResponse({ok: true, ...result})
  } catch (err) {
    console.error('Voiceover generation failed:', err)
    return jsonResponse(
      {error: err instanceof Error ? err.message : 'Generation failed'},
      {status: 500},
    )
  }
}
