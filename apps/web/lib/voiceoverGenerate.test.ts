import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {SanityClient} from '@sanity/client'

import {generateVoiceoverForPost} from './voiceoverGenerate'

// ---------------------------------------------------------------------------
// What this file tests
//
// `generateVoiceoverForPost` is the shared TTS generation loop used by both the
// CLI and the /api/voiceover/generate route. It has real branching worth
// pinning down: a side-effect-free `dryRun` path, a per-chunk Cloudinary cache
// that must skip ElevenLabs on a hit, forced word-alignment (reused when
// already stored, re-run only for new/changed chunks, non-fatal on failure),
// stable `_key`s for identical paragraphs, and several guard clauses that
// should fail loud.
//
// The function is written to be testable: external effects (ElevenLabs,
// Cloudinary, the MP3 re-fetch) live behind the `./elevenlabs` / `./voiceoverStore`
// modules and the global `fetch` (all mocked here), and the Sanity client is
// dependency-injected (faked here). The real Portable Text chunker from
// `@template/video-core/registry` is left unmocked so the tests exercise the
// actual paragraph-splitting logic.
// ---------------------------------------------------------------------------

// Mock the two effectful modules. Factories must be self-contained — vi.mock is
// hoisted above the imports, so they can't close over outer variables.
vi.mock('./elevenlabs', () => ({
  generateSpeechMp3: vi.fn(async () => Buffer.from('fake-mp3-bytes')),
  // Deterministic stand-in for the real pricing helper ($0.30 / 1000 chars).
  estimateSpeechCostUsd: vi.fn((chars: number) => (chars / 1000) * 0.3),
  // Forced alignment — returns per-word timings for an MP3 + its text.
  forceAlignWords: vi.fn(),
}))

vi.mock('./voiceoverStore', () => ({
  configureCloudinaryFromEnv: vi.fn(),
  // Id derived from text only, so identical paragraphs collide (exercises the
  // `_key` de-duplication the real sha256 id would also trigger).
  computeChunkId: vi.fn((text: string) => `id_${text.length}_${text.slice(0, 6)}`),
  voiceoverPublicId: vi.fn((postId: string, chunkId: string) => `voiceover/${postId}/${chunkId}`),
  existingVoiceoverUrl: vi.fn(),
  uploadVoiceoverMp3: vi.fn(),
}))

import {generateSpeechMp3, forceAlignWords} from './elevenlabs'
import {computeChunkId, existingVoiceoverUrl, uploadVoiceoverMp3} from './voiceoverStore'

// Typed handles to the mocks for assertions.
const mockGenerateSpeech = vi.mocked(generateSpeechMp3)
const mockForceAlign = vi.mocked(forceAlignWords)
const mockExisting = vi.mocked(existingVoiceoverUrl)
const mockUpload = vi.mocked(uploadVoiceoverMp3)
// Re-exposed so tests can build a `voiceoverChunks` id that matches what the
// function will compute internally (same mocked impl).
const mockComputeChunkId = vi.mocked(computeChunkId)

// Global fetch stub — the cache-hit path re-downloads the MP3 to align it.
const mockFetch = vi.fn(async () => ({arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer}))

// --- Portable Text helpers --------------------------------------------------

function block(text: string) {
  return {_type: 'block', style: 'normal', children: [{_type: 'span', text}]}
}

const WORDS = [{text: 'hello', start: 0, end: 0.5}]

// --- Fake Sanity client -----------------------------------------------------
//
// Implements just the slice the function calls: `fetch` (to load the post) and
// the `patch(id).set(payload).commit()` chain. Returns the spies so tests can
// assert what got written.

function makeFakeSanity(postDoc: unknown) {
  const commit = vi.fn().mockResolvedValue({})
  const set = vi.fn(() => ({commit}))
  const patch = vi.fn(() => ({set}))
  const fetch = vi.fn().mockResolvedValue(postDoc)
  const client = {fetch, patch} as unknown as SanityClient
  return {client, fetch, patch, set, commit}
}

const POST_ID = 'post-123'

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
  // Default: nothing cached, every upload returns a 12s clip.
  mockExisting.mockResolvedValue(null)
  mockUpload.mockResolvedValue({url: 'https://cdn.test/clip.mp3', durationSeconds: 12})
  // Default: alignment succeeds with one word.
  mockForceAlign.mockResolvedValue(WORDS)
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('generateVoiceoverForPost', () => {
  it('dry run reports counts and cost without calling ElevenLabs, Cloudinary, or patching Sanity', async () => {
    const sanity = makeFakeSanity({
      _id: POST_ID,
      _rev: 'rev1',
      body: [block('Hello world.'), block('Second paragraph.')],
    })

    const result = await generateVoiceoverForPost({
      postId: POST_ID,
      voiceId: 'voice-a',
      dryRun: true,
      sanityClient: sanity.client,
    })

    expect(result.chunkCount).toBe(2)
    expect(result.totalChars).toBe('Hello world.'.length + 'Second paragraph.'.length)
    expect(result.estimatedFreshCostUsd).toBeCloseTo((result.totalChars / 1000) * 0.3)
    expect(result.chunks).toEqual([])
    expect(result.generated).toBe(0)
    expect(result.cacheHits).toBe(0)

    // Dry run must be side-effect free.
    expect(mockGenerateSpeech).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockForceAlign).not.toHaveBeenCalled()
    expect(sanity.patch).not.toHaveBeenCalled()
  })

  it('generates fresh audio for every chunk on a cold cache and patches Sanity once', async () => {
    const sanity = makeFakeSanity({
      _id: POST_ID,
      _rev: 'rev1',
      body: [block('Alpha.'), block('Beta.'), block('Gamma.')],
    })

    const progress: Array<{cached: boolean}> = []
    const result = await generateVoiceoverForPost({
      postId: POST_ID,
      voiceId: 'voice-a',
      sanityClient: sanity.client,
      onProgress: (e) => {
        progress.push({cached: e.cached})
      },
    })

    expect(result.generated).toBe(3)
    expect(result.cacheHits).toBe(0)
    expect(result.totalSeconds).toBe(36) // 3 × 12s
    expect(mockGenerateSpeech).toHaveBeenCalledTimes(3)
    expect(mockUpload).toHaveBeenCalledTimes(3)
    expect(progress).toEqual([{cached: false}, {cached: false}, {cached: false}])

    // Wrote the resolved chunks back exactly once.
    expect(sanity.patch).toHaveBeenCalledOnce()
    expect(sanity.patch).toHaveBeenCalledWith(POST_ID)
    const written = sanity.set.mock.calls[0][0].voiceoverChunks
    expect(written).toHaveLength(3)
    expect(written[0]).toMatchObject({
      text: 'Alpha.',
      audioUrl: 'https://cdn.test/clip.mp3',
      durationSeconds: 12,
    })
    expect(written[0]).toHaveProperty('_key')

    // Each fresh chunk is word-aligned, and the stored words carry their own
    // stable `_key`s (Studio array requirement).
    expect(mockForceAlign).toHaveBeenCalledTimes(3)
    expect(written[0].words).toEqual([{_key: 'w0', text: 'hello', start: 0, end: 0.5}])
  })

  it('skips ElevenLabs but still aligns a Cloudinary-cached chunk (re-fetching its MP3)', async () => {
    mockExisting.mockResolvedValue({url: 'https://cdn.test/cached.mp3', durationSeconds: 8})
    const sanity = makeFakeSanity({
      _id: POST_ID,
      _rev: 'rev1',
      body: [block('Only paragraph.')],
    })

    const result = await generateVoiceoverForPost({
      postId: POST_ID,
      voiceId: 'voice-a',
      sanityClient: sanity.client,
    })

    expect(result.cacheHits).toBe(1)
    expect(result.generated).toBe(0)
    expect(result.totalSeconds).toBe(8)
    expect(mockGenerateSpeech).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
    // No new TTS, but the MP3 is pulled back from Cloudinary and aligned.
    expect(mockFetch).toHaveBeenCalledWith('https://cdn.test/cached.mp3')
    expect(mockForceAlign).toHaveBeenCalledOnce()
    const written = sanity.set.mock.calls[0][0].voiceoverChunks
    expect(written[0].audioUrl).toBe('https://cdn.test/cached.mp3')
    expect(written[0].words).toHaveLength(1)
  })

  it('reuses stored word alignments and never re-aligns or re-fetches', async () => {
    mockExisting.mockResolvedValue({url: 'https://cdn.test/cached.mp3', durationSeconds: 8})
    const text = 'Only paragraph.'
    // The stored chunk id must match what the (mocked) computeChunkId produces.
    const storedId = mockComputeChunkId(text, 'voice-a', 'eleven_multilingual_v2')
    const sanity = makeFakeSanity({
      _id: POST_ID,
      _rev: 'rev1',
      body: [block(text)],
      voiceoverChunks: [{id: storedId, words: [{text: 'stored', start: 1, end: 2}]}],
    })

    const result = await generateVoiceoverForPost({
      postId: POST_ID,
      voiceId: 'voice-a',
      sanityClient: sanity.client,
    })

    expect(result.cacheHits).toBe(1)
    expect(mockForceAlign).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
    const written = sanity.set.mock.calls[0][0].voiceoverChunks
    expect(written[0].words).toEqual([{_key: 'w0', text: 'stored', start: 1, end: 2}])
  })

  it('stores no words and stays non-fatal when forced alignment fails', async () => {
    mockForceAlign.mockRejectedValue(new Error('alignment 500'))
    // The function logs a warning on alignment failure by design; keep it out of
    // the test output.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sanity = makeFakeSanity({
      _id: POST_ID,
      _rev: 'rev1',
      body: [block('A paragraph.')],
    })

    const result = await generateVoiceoverForPost({
      postId: POST_ID,
      voiceId: 'voice-a',
      sanityClient: sanity.client,
    })

    // Generation still succeeds; the chunk just has no word timings.
    expect(result.generated).toBe(1)
    const written = sanity.set.mock.calls[0][0].voiceoverChunks
    expect(written[0].audioUrl).toBe('https://cdn.test/clip.mp3')
    expect(written[0].words).toBeUndefined()
  })

  it('mixes cache hits and fresh generation in one run', async () => {
    // First chunk cached, second a miss.
    mockExisting
      .mockResolvedValueOnce({url: 'https://cdn.test/cached.mp3', durationSeconds: 5})
      .mockResolvedValueOnce(null)
    const sanity = makeFakeSanity({
      _id: POST_ID,
      _rev: 'rev1',
      body: [block('Cached one.'), block('Fresh one.')],
    })

    const result = await generateVoiceoverForPost({
      postId: POST_ID,
      voiceId: 'voice-a',
      sanityClient: sanity.client,
    })

    expect(result.cacheHits).toBe(1)
    expect(result.generated).toBe(1)
    expect(mockGenerateSpeech).toHaveBeenCalledTimes(1)
    expect(result.totalSeconds).toBe(5 + 12)
  })

  it('assigns unique _keys even when paragraphs are identical (same chunk id)', async () => {
    const sanity = makeFakeSanity({
      _id: POST_ID,
      _rev: 'rev1',
      body: [block('Repeated line.'), block('Repeated line.')],
    })

    await generateVoiceoverForPost({
      postId: POST_ID,
      voiceId: 'voice-a',
      sanityClient: sanity.client,
    })

    const written = sanity.set.mock.calls[0][0].voiceoverChunks
    expect(written).toHaveLength(2)
    // Same deterministic id, but the index suffix keeps the Studio array keys unique.
    expect(written[0].id).toBe(written[1].id)
    expect(written[0]._key).not.toBe(written[1]._key)
    expect(new Set(written.map((c: {_key: string}) => c._key)).size).toBe(2)
  })

  it('throws when the post does not exist', async () => {
    const sanity = makeFakeSanity(null)
    await expect(
      generateVoiceoverForPost({postId: POST_ID, voiceId: 'voice-a', sanityClient: sanity.client}),
    ).rejects.toThrow(/not found/i)
  })

  it('throws when the post has no body', async () => {
    const sanity = makeFakeSanity({_id: POST_ID, _rev: 'rev1', body: null})
    await expect(
      generateVoiceoverForPost({postId: POST_ID, voiceId: 'voice-a', sanityClient: sanity.client}),
    ).rejects.toThrow(/no body/i)
  })

  it('throws when the body chunks to zero narratable paragraphs', async () => {
    const sanity = makeFakeSanity({
      _id: POST_ID,
      _rev: 'rev1',
      body: [block('   '), block('')], // whitespace/empty → dropped by the chunker
    })
    await expect(
      generateVoiceoverForPost({postId: POST_ID, voiceId: 'voice-a', sanityClient: sanity.client}),
    ).rejects.toThrow(/zero non-empty/i)
  })

  it('throws when CLOUDINARY_CLOUD_NAME is not configured', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME
    const sanity = makeFakeSanity({_id: POST_ID, _rev: 'rev1', body: [block('Hi.')]})
    await expect(
      generateVoiceoverForPost({postId: POST_ID, voiceId: 'voice-a', sanityClient: sanity.client}),
    ).rejects.toThrow(/CLOUDINARY_CLOUD_NAME/)
  })
})
