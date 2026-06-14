# Launch plan: ship the complete edition, then drip the promotion

## Decision (2026-06-14): release complete, drip the promotion — not the artifact

Earlier plan (`PLAN-drip-release.md`, superseded) sliced the monorepo into a numbered series of **separately released** repos so each cut could be its own launch moment. We're abandoning that.

**Reasoning:** the core pitch is *render once → fan out to site / social / email*. That story **is** the fanout. Drip-*releasing* the slices means the first thing the world sees is the spine **without** the fanout — the least impressive cut of the whole idea. Showing the full end-to-end loop on day one is the strongest first impression for stars, adoption, and word-of-mouth.

So we split the two things the old plan conflated:

- **Release cadence** — the complete monorepo ships **whole and public, at once**. It was always meant to be the "complete edition"; now it's the headline artifact, not a footnote every slice links back to.
- **Promotion cadence** — the numbered installments move from *release gates* to a **promotion calendar**. Each fanout surface gets its own post / video / recipe over time, all pointing back at the one complete repo.

This pivot does **not** fight the Exchange validator — it repurposes the platform's forced structure (see below) as the promo calendar instead of the release schedule.

## How this maps onto Sanity Exchange (validator constraint still applies)

From originality research: only **one** thing can be a true Exchange **Template** (standalone, public, passes `@sanity/template-validator`, H2 "Getting Started", 1200×750 image). Everything else has to be a **Guide / Recipe / Tool**. That constraint is orthogonal to release cadence and still holds — so even "release at once" can't put everything on the Exchange as a single listing. That's fine; it lines up with the new approach:

| Exchange surface | Content | Role |
|---|---|---|
| **Template** (1 listing) | the complete core repo, public, validator-passing | the entry point / headline artifact |
| **Guides / Recipes** (published over time) | one per fanout surface — Blueprint, newsletter, narrated/TTS, video-editor app | the drip-**promotion** vehicle; each links back to the complete repo |

The numbered sequence from the old plan becomes the **order we publish promo content**, not the order we ship code.

## Promotion calendar (publish order, all pointing at the complete repo)

| # | Promo beat | Angle / differentiation (from originality research) |
|---|---|---|
| 1 | **Core** — render once → Cloudinary variants → site | the Sanity + Cloudinary flagship; fills the real partnership gap (no public Sanity+Remotion template exists) |
| 2 | **BlueSky Blueprint** — fan out to social | frame as posting *rendered video* (`social-1x1` variant + `socialPostedAt` idempotency), NOT generic Bluesky posting — Sanity already has a text-only recipe |
| 3 | **Newsletter** — fan out to email | lead with the video-hero GIF (Cloudinary variant embedded directly, no re-host), NOT "send email from Studio" — crowded slot (wrux plugin + user's own ranking post) |
| 4 | **Narrated** — long-form TTS | differentiate via CMS trigger, per-chunk voiceover caching, Studio UX vs. the small ElevenLabs+Remotion CLI projects |
| 5 | **Video editor app** — live `@remotion/player` preview | essentially no prior art — safe to claim novel |

## Pre-launch checklist (this monorepo)

Validation work already done (carried over from the old plan, still valid):

1. ~~Fix the Blueprint `social-1x1` variant-id mismatch~~ **Done** — added as a square 540×540 animated GIF; all three compositions opt in.
2. ~~Make the registry additive-friendly~~ **Done** — variant groups annotated by surface (`SITE_BASE` + platform crops, `BLUEPRINT_SOCIAL`, `LONG_FORM_BASE`).
3. ~~README cross-links~~ **Done** — README has the series index (reframe as a promo index, not a release index). ESLint no longer scans `.remotion-bundle/`.

Remaining for the single Exchange Template submission (the whole repo, no slicing):

- README "## Setup" → "## Getting Started" H2 (validator requirement).
- 1200×750 listing image.
- Make the repo **public** (currently private — Exchange listings require it).
- Confirm `npx @sanity/template-validator` still PASSES on the full monorepo (last validated 2026-06-12 on the core extraction; re-run against the complete edition now that nothing is being stripped).

Open observation (unchanged): `youtube-thumbnail-jpg` exists in the catalog but no composition opts into it — decide whether `LONG_FORM_BASE` should include it for the YouTube upload flow.

## What we are NOT doing anymore

- **No per-installment add-on repos.** No delta-file repos, no "apply onto core" READMEs, no codemods, no drift-guard export scripts. The monorepo is the product, shipped whole.
- **No staged code releases.** Everything ships in one repo at launch.

## Out of scope

Exchange listing copy/assets and the exact promo-publish dates — content work, decided per beat at publish time.
