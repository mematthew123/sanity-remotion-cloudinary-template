# Sanity Context + the Ask page

[Sanity Context](https://www.sanity.io/docs/ai/sanity-context) is a hosted, read-only MCP server that gives AI agents access to your content. The template uses it as one more surface that reads the same content as the site: an **Ask** page (`/ask`) where visitors ask questions and get answers grounded in the articles, their rendered videos, and the template's own docs.

It's an optional extra. Nothing in the render loop depends on it, and `/ask` (plus its nav link) stays hidden until it's configured.

> **Beta.** Knowledge Bases are an opt-in beta feature. Limits and behavior may change before general availability.

## What gets deployed

Everything is declared in [`apps/blueprint/sanity.blueprint.ts`](../apps/blueprint/sanity.blueprint.ts) and deployed with Sanity Blueprints to an **organization-scoped** stack:

| Resource | Type | What it serves |
| --- | --- | --- |
| `site-knowledge` | Knowledge Base | A pre-built index of the published articles **and** the template's Markdown docs (`README.md`, `SETUP.md`, `docs/*.md`): topics, reconciled facts, citations. |
| `site-assistant` | MCP endpoint (Knowledge Base mode) | `site-knowledge`. Used for what/why/how answers, from fly-fishing tips to setup steps. |
| `video-catalog` | MCP endpoint (GROQ mode) | The live dataset, filtered to `post`, `author`, and ready `video` docs. Used for links, lists, and `video.variants[].url`. |

Articles and docs share one Knowledge Base because plans cap how many Knowledge Bases an organization can have (some allow only one; a second fails the deploy with `plan limit for knowledge bases is reached`). Its purpose names both audiences so the outline covers both. If your plan allows more, splitting docs into their own Knowledge Base on the same endpoint gives each a sharper outline. If you don't want template questions answered on your own site, skip the docs sync.

They're two endpoints, not one, on purpose: **an endpoint serves one mode**. If you attach a dataset and a Knowledge Base to the same endpoint, the dataset wins and the Knowledge Base is silently ignored.

## How `/ask` works

`apps/web/app/api/ask/route.ts` (Vercel AI SDK, Claude Haiku 4.5 through the Vercel AI Gateway):

1. Rejects the request if Ask isn't configured, the IP is over the rate limit, or the question is over 1,500 characters. History is trimmed to the last 12 messages and 16,000 characters.
2. Connects an MCP client to **both** endpoints and merges their tools, dropping `initial_context`.
3. Inlines both endpoints' `/initial-context` (the Knowledge Base outline and the catalog schema) into the instructions, cached in memory for 10 minutes.
4. Streams the answer, capped at 6 tool steps and 1,024 output tokens, then closes the MCP clients.

The tool names don't collide across modes (`knowledge_base_search`/`knowledge_base_read` vs `groq_query`/`schema_explorer`/`array_field_reader`), so the model picks the source per question.

### The page

`app/ask/page.tsx` fetches the post list (slug, title, image) and hands it to `components/AskChat.tsx`, which streams the answer and shows each tool call as a status line ("Searching the knowledge base", "Queried the catalog"). The model answers in plain text; `lib/askAnswer.ts` turns that into paragraphs, lists, and links:

- **Article links** become rows with the post's image and title, and stay on-site (`/posts/<slug>`). A link only counts as an article when its host matches `NEXT_PUBLIC_SITE_URL` and its slug is in the post list.
- **Doc links** (`…/docs/<name>.md`) render as "From the docs: …".
- Anything else is a plain external link.

The suggested questions on the empty page and the "Keep going" follow-ups are fixed lists in `AskChat.tsx`, picked by keyword (no extra model call). They're written for this template's content, so edit them in a fork.

## Setup

**Prerequisites:** an Administrator or Developer role in the Sanity organization, and an Administrator role on the project (to attach the dataset).

1. **Enable Context.** An org admin turns on Context and Knowledge Bases under Manage → your organization → [Labs](https://www.sanity.io/manage/org/labs).
2. **Configure the blueprint.**
   ```bash
   cd apps/blueprint
   cp .env.example .env   # CONTEXT_PROJECT_ID, CONTEXT_DATASET, SITE_URL, DOCS_BASE_URL
   ```
   `SITE_URL` is the origin the endpoint instructions use for post links. Set it to the same origin as the web app's `NEXT_PUBLIC_SITE_URL`, or article links render as plain external links instead of article rows; redeploy the blueprint after changing it. `DOCS_BASE_URL` is where agents link template docs (`<DOCS_BASE_URL>/docs/configuration.md`); point it at your fork. The variables are deliberately **not** named `SANITY_PROJECT_ID`/`SANITY_DATASET`. The Blueprints CLI reads `SANITY_PROJECT_ID` from the environment as a scope override, which points the org stack at the project and fails with a 404.
3. **Create the stack and deploy.** Use your own login; CI deploy tokens can't attach datasets.
   ```bash
   pnpm dlx sanity@latest blueprints init . --blueprint-type ts --organization-id <org-id> --stack-name production
   pnpm plan
   pnpm run deploy        # not `pnpm deploy`, which is pnpm's built-in command
   ```
4. **Add the articles.** A deploy creates the Knowledge Base empty. Get its id (the `kb…` publicId) with `pnpm dlx sanity@latest context list --organization <org-id>`, then:
   ```bash
   KB=kb...
   pnpm dlx sanity@latest context imports create $KB \
     --sanity-project <project-id> --sanity-dataset production \
     --query '*[_type == "post" && defined(slug.current)]{title, excerpt, "author": author->name, publishedAt, "body": pt::text(body), "videos": *[_type == "video" && post._ref == ^._id && status == "ready"]{title, template, duration}}'
   pnpm dlx sanity@latest context build $KB --watch
   pnpm dlx sanity@latest context update $KB --refresh-enabled --refresh-frequency weekly
   ```
   A Knowledge Base created from the CLI starts with scheduled refresh **off**, and the blueprint can't set it, so the last command turns it on.
5. **Add the docs and build.**
   ```bash
   pnpm --filter @template/blueprint docs:sync
   ```
   The script finds the `Site knowledge` Knowledge Base (or uses `SITE_KNOWLEDGE_KB_ID` from `apps/blueprint/.env`), replaces its Markdown imports with the current `README.md`, `SETUP.md`, and `docs/*.md` (skipping the `docs/README.md` index) while leaving the dataset source alone, rebuilds it, and prints the outline and any open issues. Each doc is imported as Markdown titled with its repo path, which is what lets agents link to it.
6. **Mint an org token.** In Manage → your organization → API → Tokens, add a token with **Context → Viewer**. Project tokens are rejected by Context endpoints.
7. **Configure the web app** (`apps/web/.env.local`, or Vercel env):
   ```bash
   SANITY_CONTEXT_TOKEN=...
   SANITY_CONTEXT_ASSISTANT_URL=https://api.sanity.io/v2026-09-01/context/organizations/<org-id>/mcp/site-assistant
   SANITY_CONTEXT_CATALOG_URL=https://api.sanity.io/v2026-09-01/context/organizations/<org-id>/mcp/video-catalog
   ```
   Copy the endpoint URLs from each endpoint's page in the Context app, and replace `<org-id>` (a leftover placeholder fails with `organizationAccessDenied`, "Not a member of this organization"). `/ask` is prerendered, so **rebuild** after adding these.
8. **Enable the model.** The model runs through the Vercel AI Gateway. On Vercel it authenticates with OIDC; locally, run `vercel env pull` in `apps/web` (the OIDC token expires after 12 hours) or set `AI_GATEWAY_API_KEY`. The gateway's free tier doesn't serve Claude Haiku 4.5, so top up paid credits in Vercel → AI first, or every question fails with a 403.

## Keeping it current

- **Refresh** re-checks dataset sources weekly and files issues for what changed; entries update when you apply them.
- **Docs never refresh on their own.** Run `pnpm --filter @template/blueprint docs:sync` after editing any Markdown doc. When you **add or rename** a doc, also redeploy the blueprint: entries cite docs by a slugified name (`docs/configuration.md` → `docs-configuration-md.md`), and `site-assistant`'s instructions carry a generated name → URL table built from the same list (`apps/blueprint/docs.mjs`). To automate it, run the same command in CI on pushes that touch `docs/**`, `README.md`, or `SETUP.md`, authenticated with an org token that has **Context → Editor** (the Viewer token used by `/ask` can't manage imports).
- **Issues** flag conflicting claims between sources. Review them in the Context app or with `sanity context issues list $KB --status open`. To fix one, correct the content in Sanity; the next build follows the dataset.
- **Entries can't be hand-edited.** Change the source, or add an instruction in the Context app.
- If the knowledge base's outline changes a lot, the 10-minute initial-context cache in `lib/sanityContext.ts` picks it up on its own.

## Limits and caveats

- **Spend is capped in two layers.** An **AI Gateway project budget** caps dollars (`vercel --scope <team> ai-gateway budgets set project <project> --limit 20 --refresh-period monthly`); once it's used up, `/ask` says it has reached its monthly limit. It's a soft cap and only counts the deployment's OIDC calls. On top of that, `lib/rateLimit.ts` limits each IP to 20 questions per 10 minutes, shared across instances via **Upstash Redis** (connect it from the Vercel Marketplace; it injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`). Without Upstash env it falls back to an in-memory limit, which resets on cold start; if Redis is unreachable it fails open rather than blocking questions.
- **URLs are dropped from Knowledge Base entries.** Builds keep facts, not links, which is why the catalog endpoint is there, and why docs are linked from their repo path via `DOCS_BASE_URL`.
- **Read-only.** Context MCP never writes to your dataset.
- **Insights** (conversation analytics in the Context app) isn't wired up. It needs `@sanity/context` and `@sanity/client` 8.4+; the web app is on 7.x.

See [Plans & costs](./plans-and-costs.md#sanity-context--optional-beta) for what this costs to run.
