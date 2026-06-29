# Sanity Assist + brand voice

The Studio adds AI copy generation grounded in an editable **brand-voice** document, via `@sanity/assist` and `@sanity/agent-context`. No external API key is needed (Sanity-hosted AI), but note: the custom field actions run **Agent Actions** (Transform/Generate), which are a **paid feature on the Growth plan** and consume usage. The `@sanity/assist` plugin itself is free; the Actions it calls are not.

## What it adds

The **Brand AI** field menu is **data-driven**: it lists one action *per voice doc* in the dataset. Wired in the `brandVoice` plugin (`apps/studio/src/plugins/brandVoice/index.ts`, composed into `apps/studio/sanity.config.ts`) under `assist({ fieldActions })`:

- **Rewrite as `<voice>`** — on text-like fields (`string`, `text`, `blockContent`). Uses `client.agent.action.transform` to rewrite the field's content in that voice, preserving meaning.
- **Generate video copy as `<voice>`** — on a post's `videoCopy` object. Uses `client.agent.action.generate` to fill every caption slot from the post's `title`, `excerpt`, and `body`.

Each action references *its* voice doc via `instructionParams` (`voice: {type: 'document', documentId: v._id}`). The post's preferred `voice` reference (or the default `brand-voice`) is sorted to the top of the menu by `preferredVoiceId()`; all voices stay selectable.

## The voice documents

- Type: `sanity.agentContext` (provided by `@sanity/agent-context`), surfaced in the Studio structure as **Brand Voices**. The default voice has id **`brand-voice`**.
- Each markdown file in **`apps/studio/voices/`** seeds one voice doc whose id is the filename stem — e.g. `brand-voice.md` → `brand-voice`, `dead-head.md` → `dead-head`. The doc's `name` comes from the file's first `# Heading`.
- The Studio documents are the **source of truth** — the AI actions read them live. The markdown files are only the initial template used to bootstrap them.
- Bootstrap them once with:

```bash
cd apps/studio && npx sanity exec ./scripts/seed-agent-context.ts --with-user-token
```

The script `createIfNotExists` one doc per `voices/*.md` file (with a `groqFilter` scoping each to `post` / `author`) — a one-time bootstrap that **won't overwrite** later Studio edits.

## Customizing the voices

Edit the voice documents directly in the Studio under **Brand Voices**. They're the source of truth — the AI actions read them live, so changes take effect on the next action. To add a new voice, drop another `<slug>.md` into `apps/studio/voices/` and re-run the seed (or create the doc in the Studio).

The `voices/*.md` files + the seed script are only the **initial bootstrap** (`createIfNotExists`); re-running the seed won't overwrite your Studio edits. To re-bootstrap a voice from its markdown, delete that voice document in the Studio first, then re-run the seed.

## `videoCopy` and the compositions

`videoCopy` (defined in `video-core/src/types.ts` as `VideoCopySchema`, exposed on the `post` schema) holds optional caption slots: `kicker`, `headline`, `subhead`, `pullQuote`, `ctaPrimary`, `ctaSecondary`. The compositions consume them with fallbacks — e.g. `videoCopy?.headline ?? title`, `videoCopy?.pullQuote ?? excerpt` — so a post with no `videoCopy` still renders cleanly. "Generate video copy in brand voice" fills these; you can also edit them directly on the `post` in the Studio.

## Requirements

- A Sanity project on the **Growth plan** (or higher) — custom field actions run **Agent Actions** (Transform/Generate), a paid feature that consumes usage.
- `@sanity/assist` **v4.3.0+** for custom field actions (this template pins `^6`).
- The **schema must be deployed** so Agent Actions have a `schemaId`: `cd apps/studio && npx sanity schema deploy` (or `npx sanity deploy`). Re-deploy after schema changes.
- Agent Action **Generate is experimental** — its API may change.
- The seed script needs CLI auth: `sanity login`, then run with `--with-user-token`.
