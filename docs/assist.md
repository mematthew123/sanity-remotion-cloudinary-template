# Sanity Assist + brand voice

The Studio adds AI copy generation grounded in an editable **brand-voice** document, via `@sanity/assist` and `@sanity/agent-context`. Assist is **free on Sanity v5 projects** and uses **Sanity-hosted AI** — no external API key.

## What it adds

Two field actions (wired in `apps/studio/sanity.config.ts` under `assist({ fieldActions })`):

- **Rewrite in brand voice** — on text-like fields (`string`, `text`, `blockContent`). Uses `client.agent.action.transform` to rewrite the field's content in the brand voice, preserving meaning.
- **Generate video copy in brand voice** — on a post's `videoCopy` object. Uses `client.agent.action.generate` to fill every caption slot from the post's `title`, `excerpt`, and `body`.

Both reference the brand-voice doc via `instructionParams` (`{type: 'document', documentId: 'brand-voice'}`).

## The brand-voice document

- Type: `sanity.agentContext` (provided by `@sanity/agent-context`), id **`brand-voice`**.
- The content is authored in **`apps/studio/brand-voice-instructions.md`** — the source of truth.
- Seeded into the dataset with:

```bash
cd apps/studio && npx sanity exec ./scripts/seed-agent-context.ts --with-user-token
```

The script `createOrReplace`s the `brand-voice` doc with the markdown contents and a `groqFilter` scoping it to `post` / `author`.

## Customizing the voice

1. Edit `apps/studio/brand-voice-instructions.md` (voice pillars, do/don't, vocabulary, examples).
2. Re-run the seed command above.
3. **Don't** edit the `brand-voice` document directly in the Studio — the markdown file is the source of truth, and the next seed overwrites it.

## `videoCopy` and the compositions

`videoCopy` (defined in `video-core/src/types.ts` as `VideoCopySchema`, exposed on the `post` schema) holds optional caption slots: `kicker`, `headline`, `subhead`, `pullQuote`, `ctaPrimary`, `ctaSecondary`. The compositions consume them with fallbacks — e.g. `videoCopy?.headline ?? title`, `videoCopy?.pullQuote ?? excerpt` — so a post with no `videoCopy` still renders cleanly. "Generate video copy in brand voice" fills these; the video editor app lets you tweak them with a live preview.

## Requirements

- A Sanity v5 project (Assist is included).
- The seed script needs CLI auth: `sanity login`, then run with `--with-user-token`.
