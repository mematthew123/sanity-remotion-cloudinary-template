// generate-voiceover.ts — CLI to pre-generate ElevenLabs voiceover for the
// `article-narrated` composition.
//
// Usage:
//   pnpm --filter @template/web generate-voiceover -- --post-id=<id> [--voice-id=<id>] [--model=<id>] [--dry-run]
//
// This script is a thin CLI wrapper around `generateVoiceoverForPost` (in
// apps/web/lib/voiceoverGenerate.ts). The same function powers
// `POST /api/voiceover/generate` so editors can also trigger it from Studio —
// keep your changes in the shared lib, not in this file or the route.

// Load env in the same precedence order Next.js uses for local dev:
// `.env.local` overrides `.env`. Plain `dotenv/config` would only load `.env`,
// so user-supplied secrets in `.env.local` (the gitignored file) would be
// invisible to this CLI.
import {config as loadEnv} from 'dotenv'
loadEnv({path: '.env'})
loadEnv({path: '.env.local', override: true})

import {generateVoiceoverForPost} from '../lib/voiceoverGenerate'

type Args = {
  postId: string
  voiceId: string
  modelId: string
  dryRun: boolean
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const prefix = `--${name}=`
    const hit = argv.find((a) => a.startsWith(prefix))
    return hit ? hit.slice(prefix.length) : undefined
  }
  const postId = get('post-id')
  if (!postId) {
    throw new Error('Missing --post-id=<sanity-doc-id>')
  }
  const voiceId = get('voice-id') ?? process.env.ELEVENLABS_VOICE_ID
  if (!voiceId) {
    throw new Error(
      'No voice id. Pass --voice-id=<id> or set ELEVENLABS_VOICE_ID in apps/web/.env.local',
    )
  }
  const modelId = get('model') ?? 'eleven_multilingual_v2'
  const dryRun = argv.includes('--dry-run')
  return {postId, voiceId, modelId, dryRun}
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.dryRun) {
    const dryResult = await generateVoiceoverForPost({...args, dryRun: true})
    console.log(
      `${dryResult.chunkCount} chunks · ${dryResult.totalChars} chars · est. fresh cost $${dryResult.estimatedFreshCostUsd.toFixed(2)} (cached chunks free)`,
    )
    console.log('--dry-run, exiting before any API calls')
    return
  }

  const result = await generateVoiceoverForPost({
    ...args,
    onProgress: ({index, total, chunk, cached}) => {
      const tag = cached ? 'cache hit ' : 'generating'
      console.log(
        `  [${index + 1}/${total}] ${tag} ${chunk.id} · ${chunk.durationSeconds.toFixed(2)}s`,
      )
    },
  })

  console.log(`\nTotal narration: ${result.totalSeconds.toFixed(1)}s (${Math.round(result.totalSeconds / 60)}m)`)
  console.log(
    `\nDone. ${result.generated} generated, ${result.cacheHits} cached. ${result.chunks.length} chunks written to post.voiceoverChunks.`,
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
