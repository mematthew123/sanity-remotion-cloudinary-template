# Sanity Context + the Ask page

[Sanity Context](https://www.sanity.io/docs/ai/sanity-context) is a hosted, read-only MCP server that gives AI agents access to your content. The template uses it as one more surface that reads the same content as the site: an **Ask** page (`/ask`) where visitors ask questions and get answers grounded in the articles and their rendered videos.

It's an optional extra. Nothing in the render loop depends on it, and `/ask` (plus its nav link) stays hidden until it's configured.

> **Beta.** Knowledge Bases are an opt-in beta feature. Limits and behavior may change before general availability.

## What gets deployed

Everything is declared in [`apps/blueprint/sanity.blueprint.ts`](../apps/blueprint/sanity.blueprint.ts) and deployed with Sanity Blueprints to an **organization-scoped** stack:

| Resource | Type | What it serves |
| --- | --- | --- |
| `site-knowledge` | Knowledge Base | A pre-built index of the articles and project docs: topics, reconciled facts, citations. |
| `site-assistant` | MCP endpoint (Knowledge Base mode) | `site-knowledge`. Used for what/why/how answers. |
| `video-catalog` | MCP endpoint (GROQ mode) | The live dataset, filtered to `post`, `author`, and ready `video` docs. Used for links, lists, and `video.variants[].url`. |

They're two endpoints, not one, on purpose: **an endpoint serves one mode**. If you attach a dataset and a Knowledge Base to the same endpoint, the dataset wins and the Knowledge Base is silently ignored.

## How `/ask` works

`apps/web/app/api/ask/route.ts` (Vercel AI SDK, Claude Haiku 4.5 through the Vercel AI Gateway):

1. Rejects the request if Ask isn't configured, the IP is over the rate limit, or the question is too long.
2. Connects an MCP client to **both** endpoints and merges their tools, dropping `initial_context`.
3. Inlines both endpoints' `/initial-context` (the Knowledge Base outline and the catalog schema) into the instructions, cached in memory for 10 minutes.
4. Streams the answer, capped at 6 tool steps and 1,024 output tokens, then closes the MCP clients.

The tool names don't collide across modes (`knowledge_base_search`/`knowledge_base_read` vs `groq_query`/`schema_explorer`/`array_field_reader`), so the model picks the source per question.

## Setup

**Prerequisites:** an Administrator or Developer role in the Sanity organization, and an Administrator role on the project (to attach the dataset).

1. **Enable Context.** An org admin turns on Context and Knowledge Bases under Manage → your organization → [Labs](https://www.sanity.io/manage/org/labs).
2. **Configure the blueprint.**
   ```bash
   cd apps/blueprint
   cp .env.example .env   # CONTEXT_PROJECT_ID, CONTEXT_DATASET, SITE_URL
   ```
   The variables are deliberately **not** named `SANITY_PROJECT_ID`/`SANITY_DATASET`. The Blueprints CLI reads `SANITY_PROJECT_ID` from the environment as a scope override, which points the org stack at the project and fails with a 404.
3. **Create the stack and deploy.** Use your own login; CI deploy tokens can't attach datasets.
   ```bash
   pnpm dlx sanity@latest blueprints init . --blueprint-type ts --organization-id <org-id> --stack-name production
   pnpm plan
   pnpm run deploy        # not `pnpm deploy`, which is pnpm's built-in command
   ```
4. **Add Knowledge Base sources and build.** A deploy creates the Knowledge Base empty. Get its id with `pnpm dlx sanity@latest context list --organization <org-id>`, then:
   ```bash
   KB=kb...   # the publicId
   pnpm dlx sanity@latest context imports create $KB \
     --sanity-project <project-id> --sanity-dataset production \
     --query '*[_type == "post" && defined(slug.current)]{title, excerpt, "author": author->name, publishedAt, "body": pt::text(body), "videos": *[_type == "video" && post._ref == ^._id && status == "ready"]{title, template, duration}}'
   pnpm dlx sanity@latest context imports create $KB --file README.md
   pnpm dlx sanity@latest context imports create $KB --file docs/architecture.md
   pnpm dlx sanity@latest context build $KB --watch
   pnpm dlx sanity@latest context update $KB --refresh-enabled --refresh-frequency weekly
   ```
   A Knowledge Base created from the CLI starts with scheduled refresh **off**, and the blueprint can't set it, so the last command turns it on.
5. **Mint an org token.** In Manage → your organization → API → Tokens, add a token with **Context → Viewer**. Project tokens are rejected by Context endpoints.
6. **Configure the web app** (`apps/web/.env.local`, or Vercel env):
   ```bash
   SANITY_CONTEXT_TOKEN=...
   SANITY_CONTEXT_ASSISTANT_URL=https://api.sanity.io/v2026-09-01/context/organizations/<org-id>/mcp/site-assistant
   SANITY_CONTEXT_CATALOG_URL=https://api.sanity.io/v2026-09-01/context/organizations/<org-id>/mcp/video-catalog
   ```
   Copy the endpoint URLs from each endpoint's page in the Context app, and replace `<org-id>` (a leftover placeholder fails with `organizationAccessDenied`, "Not a member of this organization"). `/ask` is prerendered, so **rebuild** after adding these.
7. **Enable the model.** The model runs through the Vercel AI Gateway. On Vercel it authenticates with OIDC; locally, run `vercel env pull` in `apps/web` (the OIDC token expires after 12 hours) or set `AI_GATEWAY_API_KEY`. The gateway's free tier doesn't serve Claude Haiku 4.5, so top up paid credits in Vercel → AI first, or every question fails with a 403.

## Keeping it current

- **Refresh** re-checks dataset sources weekly and files issues for what changed; entries update when you apply them. Uploaded files (the docs) never refresh. Re-import them after editing.
- **Issues** flag conflicting claims between sources. Review them in the Context app or with `sanity context issues list $KB --status open`. To fix one, correct the content in Sanity; the next build follows the dataset.
- **Entries can't be hand-edited.** Change the source, or add an instruction in the Context app.
- If the knowledge base's outline changes a lot, the 10-minute initial-context cache in `lib/sanityContext.ts` picks it up on its own.

## Limits and caveats

- **Rate limiting is best-effort.** `lib/askThrottle.ts` is in-memory (20 questions per IP per 10 minutes). It resets on cold start and isn't shared across instances, so back it with a durable store (Vercel KV / Upstash) before relying on it to cap model spend.
- **URLs are dropped from Knowledge Base entries.** Builds keep facts, not links, which is why the catalog endpoint is there.
- **Read-only.** Context MCP never writes to your dataset.
- **Insights** (conversation analytics in the Context app) isn't wired up. It needs `@sanity/context` and `@sanity/client` 8.4+; the web app is on 7.x.

See [Plans & costs](./plans-and-costs.md#sanity-context--optional-beta) for what this costs to run.
