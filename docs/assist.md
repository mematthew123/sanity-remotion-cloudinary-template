# Sanity Assist + brand voice

The Studio adds AI copy generation grounded in an editable **brand-voice** document, via `@sanity/assist` and `@sanity/agent-context`. No external API key is needed (Sanity-hosted AI), but note: the custom field actions run **Agent Actions** (Transform/Generate), which are a **paid feature on the Growth plan** and consume usage. The `@sanity/assist` plugin itself is free; the Actions it calls are not.

## What it adds

Two field actions (wired in `apps/studio/sanity.config.ts` under `assist({ fieldActions })`):

- **Rewrite in brand voice** — on text-like fields (`string`, `text`, `blockContent`). Uses `client.agent.action.transform` to rewrite the field's content in the brand voice, preserving meaning.
- **Generate video copy in brand voice** — on a post's `videoCopy` object. Uses `client.agent.action.generate` to fill every caption slot from the post's `title`, `excerpt`, and `body`.

Both reference the brand-voice doc via `instructionParams` (`{type: 'document', documentId: 'brand-voice'}`).

## The brand-voice document

- Type: `sanity.agentContext` (provided by `@sanity/agent-context`), id **`brand-voice`**, surfaced in the Studio structure as **Brand Voice**.
- That Studio document is the **source of truth** — the AI actions read it live. `apps/studio/brand-voice-instructions.md` is the initial template used to bootstrap it.
- Bootstrap it once with:

```bash
cd apps/studio && npx sanity exec ./scripts/seed-agent-context.ts --with-user-token
```

The script `createIfNotExists` the `brand-voice` doc from the markdown (with a `groqFilter` scoping it to `post` / `author`) — a one-time bootstrap that **won't overwrite** later Studio edits.

## Customizing the voice

Edit the **Brand Voice** document directly in the Studio (surfaced in the structure). It's the source of truth — the AI actions read it live, so changes take effect on the next action.

`apps/studio/brand-voice-instructions.md` + the seed script are only the **initial bootstrap** (`createIfNotExists`); re-running the seed won't overwrite your Studio edits. To re-bootstrap from the markdown, delete the `brand-voice` document first, then re-run the seed.

## `videoCopy` and the compositions

`videoCopy` (defined in `video-core/src/types.ts` as `VideoCopySchema`, exposed on the `post` schema) holds optional caption slots: `kicker`, `headline`, `subhead`, `pullQuote`, `ctaPrimary`, `ctaSecondary`. The compositions consume them with fallbacks — e.g. `videoCopy?.headline ?? title`, `videoCopy?.pullQuote ?? excerpt` — so a post with no `videoCopy` still renders cleanly. "Generate video copy in brand voice" fills these; you can also edit them directly on the `post` in the Studio.

## Requirements

- A Sanity project on the **Growth plan** (or higher) — custom field actions run **Agent Actions** (Transform/Generate), a paid feature that consumes usage.
- `@sanity/assist` **v4.3.0+** for custom field actions (this template pins `^6`).
- The **schema must be deployed** so Agent Actions have a `schemaId`: `cd apps/studio && npx sanity schema deploy` (or `npx sanity deploy`). Re-deploy after schema changes.
- Agent Action **Generate is experimental** — its API may change.
- The seed script needs CLI auth: `sanity login`, then run with `--with-user-token`.
