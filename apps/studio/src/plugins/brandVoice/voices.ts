import {useEffect, useState} from 'react'
import type {SanityClient} from 'sanity'

// Default brand-voice Agent Context document id. The AI Assist menu exposes
// one action per voice doc found in the dataset; this id is the fallback
// used to highlight the "preferred" voice when `post.voice` is unset.
// All voice docs are seeded from `voices/*.md` by `scripts/seed-agent-context.ts`.
const DEFAULT_VOICE_DOC_ID = 'brand-voice'

export type VoiceDoc = {_id: string; name: string | null}

// Module-level cache so we don't re-query voices for every field render.
// Voices change rarely; a Studio reload picks up new voices.
let voicesCache: VoiceDoc[] | null = null
let voicesPromise: Promise<VoiceDoc[]> | null = null

export function useVoices(client: SanityClient): VoiceDoc[] {
  const [voices, setVoices] = useState<VoiceDoc[]>(voicesCache ?? [])
  useEffect(() => {
    if (voicesCache) return
    if (!voicesPromise) {
      voicesPromise = client
        .fetch<VoiceDoc[]>(
          `*[_type == "sanity.agentContext"] | order(name asc, _id asc){_id, name}`,
        )
        .catch(() => [] as VoiceDoc[])
    }
    let cancelled = false
    voicesPromise.then((res) => {
      voicesCache = res
      if (!cancelled) setVoices(res)
    })
    return () => {
      cancelled = true
    }
  }, [client])
  return voices
}

export function preferredVoiceId(getDocumentValue: () => unknown): string {
  const doc = getDocumentValue() as {voice?: {_ref?: string}} | undefined
  return doc?.voice?._ref || DEFAULT_VOICE_DOC_ID
}

export function sortVoices(voices: VoiceDoc[], preferredId: string): VoiceDoc[] {
  return [...voices].sort((a, b) => {
    if (a._id === preferredId) return -1
    if (b._id === preferredId) return 1
    return (a.name ?? a._id).localeCompare(b.name ?? b._id)
  })
}
