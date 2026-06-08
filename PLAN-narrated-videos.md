# Plan: Long-Form Narrated Compositions

> Goal: a new composition (`article-narrated`) that reads the entire post body aloud via ElevenLabs TTS, with per-paragraph visual scenes cycling underneath. One canonical long-form MP4 fans out via the existing variant catalog to a podcast MP3, a YouTube-ready 1080p, chapter thumbnails, and short-form clips — no extra renders. Existing Promo (1:1) and Teaser (9:16) compositions stay untouched; this is a third opt-in composition gated behind a TTS env var.

This plan leans on the local Remotion guidance under `.agents/skills/remotion-best-practices/` — the rules already cover the hardest parts:

- `rules/voiceover.md` — ElevenLabs per-scene TTS + `calculateMetadata` pattern (load-bearing for this plan)
- `rules/calculate-metadata.md` — dynamic composition duration
- `rules/get-audio-duration.md` — measuring MP3 duration with Mediabunny
- `rules/audio.md` — `<Audio>` component, trimming, volume, delay
- `rules/transcribe-captions.md` + `rules/display-captions.md` — Whisper for caption sync
- `rules/transitions.md` — `<TransitionSeries>` for scene-to-scene fades/wipes
- `rules/parameters.md` — Zod schema for the new composition's input

---

## 1. What changes vs. today

**Today** the template ships two compositions whose props are filled from `post.videoCopy` (six short text slots). They render in seconds, in one synchronous request, with no audio.

**After this change** a third composition `article-narrated` accepts the post's full `body` (Portable Text) plus generated audio files. Its duration is computed from the audio, not declared upfront. Render time scales with post length (~5–10 min for a 1500-word post). Two new layers exist:

- **A TTS pre-step.** Before triggering Remotion, a generate-voiceover script chunks `body` by paragraph, hits ElevenLabs per chunk, and writes per-paragraph MP3s. Those MP3 URLs are passed into the composition as input props.
- **A new variant family.** The same render output drives podcast MP3, YouTube MP4, chapter thumbnails, and short-form clips — all Cloudinary derivations. Render still runs once.

The render route's job changes minimally: it still validates input, triggers Remotion, uploads to Cloudinary, patches Sanity. The new step is "ensure voiceover MP3s exist for this post before render" — a precondition.

---

## 2. Architecture

```
Studio "Render narrated reading" action ──► POST /api/video/render
                                              1. validate ArticleNarratedProps (Zod)
                                              2. ensureVoiceoverFor(post)                  [new]
                                                 — chunks body, calls ElevenLabs per chunk
                                                 — uploads MP3s to Cloudinary (audio/raw)
                                                 — caches by hash(post.body + voiceId)
                                              3. createSandbox/restoreSnapshot
                                              4. renderMediaOnVercel — composition reads
                                                 MP3 URLs, sizes itself via calculateMetadata
                                              5. uploadToVercelBlob → Cloudinary
                                                 + eager variants (longer list — see §4)
                                              6. patch doc cloudinaryUrl + variants[]
```

The "ensure voiceover" step is the new piece. It's content-addressable: if the post body hasn't changed since the last render, the same MP3s are reused — no second ElevenLabs bill. Cache key: `sha256(post.body_serialized + voiceId + ttsModelId)`.

For posts longer than a few minutes of narration, render time will exceed the current `maxDuration = 300`. Two paths (decide in Phase 3 below):

- **Cheap:** bump to Vercel Pro's 800s max (~13 min) — covers ~2500-word posts. Keep sync.
- **Right:** flip to async — render route returns immediately with `videoId`, Inngest/Trigger.dev handles render + Cloudinary upload + Sanity patch. Studio already subscribes to `status`, no caller changes.

---

## 3. Composition shape

New file `packages/video-core/src/compositions/ArticleNarrated.tsx`.

Input props (Zod, registered via `rules/parameters.md`):

```ts
export const ArticleNarratedPropsSchema = z.object({
  title: z.string(),
  authorName: z.string(),
  publishedAt: z.string(),
  mainImageUrl: z.string().url().optional(),

  // The narrator's reading material, chunked at paragraph boundaries.
  // Each chunk carries its text (for on-screen overlay) and the URL of its
  // pre-generated MP3. Chunk count == scene count.
  chunks: z.array(z.object({
    id: z.string(),                // sha256(text + voiceId), used as cache key
    text: z.string(),
    audioUrl: z.string().url(),    // Cloudinary-hosted MP3
    backgroundType: z.enum([
      'main-image-pan',  // pan/zoom on post.mainImage
      'pull-quote',      // typography-driven scene
      'image-reveal',    // a body image
      'wordmark',        // brand intro/outro
    ]).default('main-image-pan'),
  })),
});
```

Duration is computed in `calculateMetadata` by summing each chunk's audio duration (`rules/get-audio-duration.md` — `mediabunny`'s `computeDuration` against the Cloudinary MP3 URL). The composition lays out one `<TransitionSeries.Sequence>` per chunk, each containing its `<Audio>` element + a visual scene component chosen by `backgroundType`.

Scene-to-scene transitions: a 12-frame `fade()` from `@remotion/transitions`. Subtract overlap from total duration per `rules/transitions.md`.

Karaoke-style captions: optional, gated by a `withCaptions` prop. Implementation per `rules/transcribe-captions.md` — run Whisper on each MP3 after generation to get word-level timestamps, write to `chunk-N.captions.json`, render highlighted-as-spoken in the composition. Whisper runs locally during the pre-step, not in the composition.

---

## 4. Variant catalog impact

The variant registry (`packages/video-core/src/registry.ts`) is the single biggest payoff of doing this. One render → many surfaces:

| variantId            | Surface  | Cloudinary transform                                     | What it powers                                    |
| -------------------- | -------- | -------------------------------------------------------- | ------------------------------------------------- |
| `youtube-1080p-mp4`  | youtube  | `w_1920,h_1080,c_pad,f_mp4,q_auto`                       | full long-form upload                             |
| `podcast-mp3`        | podcast  | `f_mp3`                                                  | audio-only RSS feed entry                         |
| `chapter-thumb-N`    | thumbs   | `so_<chapterSec>,f_jpg,w_1280`                           | per-chapter thumbnails for show notes / blog body |
| `tiktok-30s-clip`    | social   | `du_30,so_0,c_fill,w_1080,h_1920,f_mp4`                  | first 30s vertically cropped                      |
| `shorts-60s-clip`    | youtube  | `du_60,so_0,f_mp4,w_1080,h_1920`                         | YouTube Shorts                                    |
| `transcript-vtt`     | accessibility | (not Cloudinary — written from Whisper output)      | VTT subtitle file for the YouTube upload          |

New compositions opt into the variants they actually need. `ArticleNarrated.variantIds` includes the long-form ones; Promo/Teaser stay on their existing short-form variants. Adding entries to `VARIANTS` follows the existing pattern — minor edit.

`eagerTransformsFor(ids)` materializes the new variants at Cloudinary upload time. No re-renders downstream.

---

## 5. Phased rollout

### Phase 0: ElevenLabs spike (you said you'd handle this)

Before committing to anything in the template, hit ElevenLabs directly with a representative post body and judge:

- Voice quality (which preset voice? `eleven_multilingual_v2` model is the current default)
- Per-chunk vs single-shot generation (chunking lets us cache and re-render only changed paragraphs; single-shot has smoother prosody across paragraph breaks)
- Voice-clone vs preset (clone is on-brand for an agency partnership demo but adds a one-time setup step)

**Deliverable:** a single MP3 of a real post body that you'd be comfortable shipping. If quality clears the bar, proceed to Phase 1.

### Phase 1: Voiceover generation pipeline (1–2 days)

**New files:**
- `apps/web/scripts/generate-voiceover.ts` — Node script, takes `--post-id`, reads body from Sanity, chunks at paragraph boundaries, calls ElevenLabs per chunk, uploads MP3 to Cloudinary, returns `{chunks: [{id, text, audioUrl}, ...]}`. Cache key: `sha256(text + voiceId + model)`. Skip chunks whose MP3 already exists at the expected Cloudinary public id.
- `packages/video-core/src/voiceover/chunk.ts` — pure function: Portable Text body → `Chunk[]`. Lives in `video-core/registry` (no React) so the render route can call it for validation.

**New env:**
- `ELEVENLABS_API_KEY` (web only)
- `ELEVENLABS_VOICE_ID` (web only — preset for the demo voice)

**Deliverable:** CLI invocation `pnpm --filter @template/web generate-voiceover -- --post-id=<id>` produces a set of Cloudinary-hosted MP3s plus a `chunks.json` written to the post (as a new readOnly field). No Remotion involvement yet.

### Phase 2: ArticleNarrated composition (2–3 days)

**New files:**
- `packages/video-core/src/compositions/ArticleNarrated.tsx` — composition body, scene components
- `packages/video-core/src/compositions/ArticleNarrated.scenes.tsx` — `MainImagePan`, `PullQuoteScene`, `ImageRevealScene`, `WordmarkScene`
- `packages/video-core/src/registry.ts` — register `article-narrated` in `COMPOSITIONS` with `calculateMetadata` derived from `ArticleNarratedPropsSchema`
- `packages/video-core/src/registry-components.ts` — add to `COMPOSITION_COMPONENTS`

**Wiring:**
- The composition uses `calculateMetadata` (per `rules/voiceover.md`) to sum chunk durations
- Scenes use `<TransitionSeries>` with `fade()` transitions
- Each scene gets a `<Audio src={chunk.audioUrl} />`
- Background imagery: Ken-Burns style pan on `post.mainImage` is the default; richer scene types come later

**Deliverable:** Render the new composition via the existing render action (which still passes through `/api/video/render`). Output is one MP4 with full narrated body. No new variants yet, no captions yet, no async refactor yet — just validate the composition works.

### Phase 3: Async render or longer timeout (1 day either way)

Decide between:

- **Sync + Pro timeout (cheap):** bump `maxDuration` to `800`, update `apps/web/vercel.json`'s function settings, document that posts longer than ~2500 words may need to be split. No code restructure.
- **Async (right):** kick off render via Inngest, route returns immediately with `videoId`, Sanity subscription in Studio handles the wait. Better but adds a managed-service dependency.

**Recommendation:** start with sync + Pro timeout. Pull the async lever when an actual demo run blows the budget.

### Phase 4: Long-form variant family (1 day)

- Add `VARIANTS` entries listed in §4 to `packages/video-core/src/registry.ts`
- `ArticleNarrated.variantIds = [...]`
- `eagerTransformsFor` already handles the rest

**Deliverable:** rendering `article-narrated` produces, in one go, the MP4 + podcast MP3 + chapter thumbs + short-form clips. All visible in Sanity's `video.variants[]`.

### Phase 5: Studio surfaces + safety rails (2 days)

- New action in `apps/studio/src/actions/renderVideo.tsx`: `RenderArticleNarrated`. Adds a confirmation dialog with estimated TTS cost (compute from body char count × ElevenLabs rate). Gated on `process.env.SANITY_STUDIO_ELEVENLABS_ENABLED` so editors without TTS configured don't see it.
- New field on `video` schema: `narrationVoiceId` (string, optional, references a Sanity-managed list of voices)
- New "Voices" structure node in `apps/studio/src/structure/index.ts` (mirrors how Brand Voices are surfaced for Sanity Assist)
- TTS regenerate-this-paragraph action: per-chunk re-narrate if the editor edits one paragraph — keeps cost minimal
- Cost preview: `lib/elevenlabsCost.ts` estimates cost from `wordCount * avgCharsPerWord * usdPerChar`. Surfaced in the confirmation dialog.

### Phase 6 (later): Captions + audio-only podcast feed

- Whisper transcription per chunk → karaoke captions during render (per `rules/transcribe-captions.md`)
- Export `transcript-vtt` variant from Whisper output (not a Cloudinary derivation — written directly to Cloudinary as `raw` resource_type)
- `/api/podcast/feed.rss` route serves the podcast variant as an RSS feed (uses existing `apps/web/lib/sanity.queries.ts`)

---

## 6. Costs and capacity

**Per-render cost** (rough, for a 1500-word post):
- ElevenLabs `eleven_multilingual_v2`: ~$0.30/1k chars input → ~$2.25 per fresh render
- Cloudinary delivery + storage: ~$0.01 (variants are derivations, not stored separately)
- Vercel Pro function-time: $0.18/hr → ~$0.03 per 10-min render
- **Total: ~$2.30 per fresh render.** Cached re-renders (body unchanged) drop to ~$0.04.

**Render time** (Vercel Pro, 1500-word post):
- TTS generation: ~30s (parallel calls per chunk)
- Remotion render: ~5–7 min
- Cloudinary upload: ~30s
- **Total: ~7 min per fresh render.**

Both fit comfortably in Pro's 800s budget. Posts above ~3000 words will need the async path in Phase 3.

---

## 7. Files to create / modify

```
packages/video-core/
  src/
    compositions/
      ArticleNarrated.tsx                              [new]
      ArticleNarrated.scenes.tsx                       [new]
    voiceover/
      chunk.ts                                          [new]
      types.ts                                          [new — Chunk, VoiceProfile types]
    registry.ts                                         [edit — register article-narrated + variants]
    registry-components.ts                              [edit]
    index.ts                                            [edit — export ArticleNarrated]

apps/web/
  scripts/
    generate-voiceover.ts                              [new — CLI; can run via tsx]
  lib/
    elevenlabs.ts                                       [new — thin SDK wrapper]
    elevenlabsCost.ts                                   [new — cost estimator for Studio dialog]
  app/api/video/render/route.ts                         [edit — ensureVoiceoverFor(post) precondition]
  package.json                                          [edit — add scripts.generate-voiceover]
  .env.local                                            [edit — ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID]
  vercel.json                                           [edit — bump /api/video/render maxDuration]

apps/studio/
  src/
    actions/renderVideo.tsx                             [edit — add RenderArticleNarrated]
    schemaTypes/video.ts                                [edit — add narrationVoiceId, voiceoverChunks]
    schemaTypes/voice.ts                                [new — Sanity Voice doc (Phase 5)]
    schemaTypes/index.ts                                [edit]
    structure/index.ts                                  [edit — surface Voices]
  sanity.config.ts                                      [edit — register voice schemaType]
  .env                                                  [edit — SANITY_STUDIO_ELEVENLABS_ENABLED flag]

CLAUDE.md                                               [edit — document the new composition + TTS env]
docs/narrated-videos.md                                 [new — setup walkthrough]
docs/troubleshooting.md                                 [edit — TTS failures, render-too-long, etc.]
```

---

## 8. Open questions

1. **Voice selection scope.** One global brand voice (env var)? Per-post (`post.narrationVoiceId`)? A small library of voices the editor picks from? Recommend per-post with a default — matches the Brand Voice pattern already in the template.
2. **Caching identity.** Cache key should include the voice id and TTS model id so changing voice forces regeneration. Should it also include the chunk's *position* in the post? (No — text-only hash is fine; reordering paragraphs re-renders for free because the chunks are still cached individually.)
3. **Failure mode on TTS failure.** Skip the chunk and continue? Block the render? Recommend block + return clear error; editor regenerates manually.
4. **Per-paragraph regeneration.** Built into Phase 1's caching (changed paragraph → new hash → new MP3). Worth surfacing a Studio button for "regenerate this paragraph" explicitly so editors don't have to re-render the whole video to swap one sentence.
5. **Editing the narration script.** Should editors be able to tweak the narrator's script without changing the post body? (i.e. a `post.narrationOverride` Portable Text field, optional, that the chunker prefers over `body`.) Recommend yes — TTS rarely reads marketing copy with the rhythm a human editor wants. Cheap to add in Phase 1.

---

## 9. Verification

End-to-end smoke (after Phase 5):

1. Pick a post with a 1000-word body. Click "Render narrated reading" in Studio.
2. Dialog shows estimated cost (~$1.50). Confirm.
3. Watch the Sanity Studio status flip `rendering → uploading → ready` over ~5 min.
4. Open the video doc → MP4 plays the narration with paragraph-aligned scene changes.
5. Inspect `variants[]` — `youtube-1080p-mp4`, `podcast-mp3`, `chapter-thumb-N` URLs all populated.
6. Open the podcast MP3 in a browser; audio plays the full narration (no video).
7. Edit one paragraph of the post body, re-render. Verify only the changed chunk's MP3 regenerates (check ElevenLabs dashboard); other chunks pull from cache.

---

## 10. What this unlocks for the partnership demo

A single "Render narrated reading" click turns a Sanity post into:
- A YouTube-ready long-form video (Cloudinary delivery)
- A podcast episode (Cloudinary `f_mp3`)
- Chapter thumbnails for show notes (Cloudinary frame extraction)
- Short-form social clips (Cloudinary trim)
- A VTT transcript (Whisper output)

All from one render. **That's the strongest possible "render once, fan out everywhere" demo of the Sanity + Cloudinary partnership** — it shows Cloudinary doing real work post-render (audio extraction, frame seeks, format conversion, trimming) and Sanity orchestrating the editorial surface end to end. The TTS layer (ElevenLabs) is the third-party dependency, but the *spine* is still the variant catalog this template was built around.
