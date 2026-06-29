# Plans & costs

Every external service this template touches, what it's for, and what it costs. The goal: no surprise bill, and a clear line between what runs **free for a demo** and what you **must pay for** in production.

> Prices drift. The numbers below are accurate as of mid-2026 and link to the canonical pricing page for each service — check those before budgeting.

## At a glance

| Service | Role in the template | Free tier enough for a demo? | When you must pay | Paid entry point |
| --- | --- | --- | --- | --- |
| **Sanity** | CMS: content, schema, render/newsletter triggers | ✅ Yes (core) | Only for the **Assist** "Brand AI" menu | **Growth — $15/seat/mo** |
| **Cloudinary** | Canonical video host + variant derivations (partner) | ✅ Yes | At real video volume / bandwidth | Plus — $89/mo |
| **Vercel** | *Hosting only* — runs the render route / sandbox **when deployed** | ✅ Not needed locally (renders run on your machine) | Deploying the hosted app | **Pro — $20/seat/mo** + usage |
| **Resend** | Newsletter sends, broadcasts, signup audience | ✅ Yes | At list size / send volume | Pro — $20/mo |
| **ElevenLabs** | TTS for the `article-narrated` composition (optional) | ❌ No (no free commercial use) | Any real/commercial use | Starter — ~$5/mo |

**You can run the whole core loop free.** With only **Sanity** and **Cloudinary** configured — both have genuinely usable free tiers — the render route renders with headless Chromium **on your own machine** and uploads straight to Cloudinary, so you can clone, render a video, and see it play on the site **without a Vercel account at all** (see [Vercel](#vercel--only-for-the-hosted-deployment) below). **Vercel Pro becomes the floor only when you deploy the hosted app**, where renders move into a Vercel Sandbox. The two *content features* that need paid plans — Sanity Assist and ElevenLabs — are documented in [configuration.md → Optional / paid features](./configuration.md#optional--paid-features) and degrade gracefully when absent.

---

## Vercel — only for the hosted deployment

Vercel does **two** jobs here: it hosts the deployed web app, and `/api/video/render` orchestrates the render inside an ephemeral **Vercel Sandbox**, staging the output on **Vercel Blob** before handing it to Cloudinary. Neither is required to run the template locally.

**Free local path (no Vercel account):** when the route runs outside Vercel and has no `BLOB_READ_WRITE_TOKEN` (or you set `LOCAL_RENDER=true`), it renders the composition with **headless Chromium on your machine** via `@remotion/renderer` and uploads the MP4 straight to Cloudinary — no Sandbox, no Blob store. So `pnpm dev:web` + Sanity + Cloudinary is a complete, $0 render loop. Chromium downloads once on the first render (~1 min, one-time). This path is local-only; a Vercel deployment always uses the Sandbox. See [vercel-sandbox.md](./vercel-sandbox.md) and the `useLocalRender` branch in `apps/web/app/api/video/render/route.ts`.

> Caveat: local renders use *your* machine's CPU. Promo/teaser are fine (<a minute or two); the long-form `article-narrated` composition is CPU-bound and slow off the sandbox's 8 vCPUs — keep that one on a Vercel deploy.

**Why Pro is the floor once you deploy:**

- The render route declares `export const maxDuration = 800` (`apps/web/app/api/video/render/route.ts`). **800s is a Pro/Enterprise ceiling.** Hobby caps a function at 10s by default, and even with Fluid Compute (on by default) tops out at **300s** — so the shipped value won't deploy on Hobby.
- The `article-narrated` render takes **5–7 minutes** (300–420s). That exceeds Hobby's 300s Fluid Compute cap no matter how you configure it — narrated **cannot** run on a Hobby deploy.
- Promo/teaser renders finish in **<60s**. Those alone *could* fit a Hobby deploy if you lower `maxDuration` to ≤300 and never enable narrated — see the escape hatch below.

**Costs on Pro:** $20/seat/mo, plus usage-based **Active CPU + memory time** for the function and the sandbox (renders are CPU-bound; narrated uses 8 vCPUs), plus **Vercel Blob** storage. Blob cost here is minimal: render output is staged then immediately `del()`'d, and only the small build-time sandbox snapshot is retained.

**Escape hatch for a free Hobby deploy:** ship promo/teaser only — lower `maxDuration` to `300`, leave `SANITY_STUDIO_ENABLE_NARRATED` off (it already is), and accept the 300s Fluid cap. This is not the default; the deployed template assumes Pro.

Pricing: [vercel.com/pricing](https://vercel.com/pricing) · [Function limits](https://vercel.com/docs/functions/limitations) · setup in [vercel-sandbox.md](./vercel-sandbox.md).

---

## Cloudinary — partner, free tier is generous

The canonical MP4 lives in Cloudinary, and every site/email/long-form variant is a Cloudinary *derivation* of that one file (no re-renders). See [architecture.md](./architecture.md#the-cloudinary-variant-system).

**Free plan:** 25 credits/month. One credit = **1 GB storage**, **1 GB delivered bandwidth**, or **1,000 transformations** — pooled across all three. For video, 1 transformation credit = ~500s SD or ~250s HD. Max video file size is **100 MB** on free. The eager variants generated at render time each count as transformations.

**The catch:** self-serve tiers **don't bill overages — they suspend the account** when credits run out. For a demo, 25 credits is plenty; at real traffic, **video bandwidth is what burns credits fastest**. Next tier is **Plus at $89/mo** (225 credits), then Advanced at $224/mo (600 credits).

Pricing: [cloudinary.com/pricing](https://cloudinary.com/pricing) · [How credits work](https://cloudinary.com/documentation/developer_onboarding_faq_credits).

---

## Sanity — free for the core, Growth for Assist

The CMS, the render triggers, and the newsletter actions all run on Sanity. The **core loop works on the Free plan**: the render route reads/writes `video` docs with a write token, and the site reads published content **token-free** (requires a **public** dataset — or add a read token in `apps/web/lib/sanity.client.ts`).

**What needs a paid plan:** only the **Assist "Brand AI" menu** (Rewrite as voice / Generate video copy). Agent Actions (Transform/Generate) are a **paid feature on the Growth plan and up (~$15/seat/mo)** and consume AI credits — unavailable on Free. The template keeps the menu visible (it showcases Sanity) but converts a plan-gated failure into an explanatory toast. See [assist.md](./assist.md) and [configuration.md → Optional / paid features](./configuration.md#optional--paid-features).

Pricing: [sanity.io pricing](https://www.sanity.io/docs/platform-management/plans-and-payments) · [Agent Actions](https://www.sanity.io/docs/agent-actions/introduction).

---

## Resend — newsletter & signup, free tier covers a demo

The newsletter and public-signup fan-out uses **both** Resend products:

- **Transactional** (`resend.emails.send`) — newsletter test sends, the double-opt-in confirm email, and the GIF welcome email.
- **Marketing / Audiences** (`resend.broadcasts.create` + `resend.contacts.create`) — the audience-mode newsletter blast and the public signup adding confirmed contacts to `RESEND_AUDIENCE_ID`.

**Free plan:** 3,000 emails/month, **100/day**, **1,000 contacts**, 1 verified domain. Broadcasts send to existing contacts on free — enough to demo the whole loop. The **sender domain must be verified** or sends land in spam (see [configuration.md → Custom domain & Resend sender](./configuration.md#custom-domain--resend-sender)).

**When you pay:** the 100/day limit or 1,000-contact ceiling. **Pro is $20/mo** (50k emails, no daily limit, 10 domains); larger marketing-contact tiers are billed per contact stored.

Pricing: [resend.com/pricing](https://resend.com/pricing) · [Quotas & limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits).

---

## ElevenLabs — optional, paid for any real use

Only the `article-narrated` composition uses ElevenLabs (TTS of the post body). It's **off by default** (`SANITY_STUDIO_ENABLE_NARRATED`).

**Free API tier:** ~10 minutes/month, **no commercial license, forced attribution** — unusable for real promo content. Commercial use needs at least the **Starter plan (~$5/mo)**. Heavier API tiers run $99/mo (Pro) and up; TTS is ~$0.10 per 1,000 characters (multilingual) or ~$0.05 (Flash/Turbo).

Pricing: [elevenlabs.io/pricing/api](https://elevenlabs.io/pricing/api). Setup in [configuration.md → Optional / paid features](./configuration.md#optional--paid-features).

---

## Bottom line

- **$0 to run locally:** Sanity + Cloudinary free tiers only. Renders run on your machine (headless Chromium) and upload to Cloudinary — no Vercel account. This is the fastest way to clone and see the whole loop work.
- **Cheapest real deployment:** Vercel Pro ($20/seat/mo) is the floor once you host the app. Sanity, Cloudinary, and Resend free tiers still cover a demo deploy; you pay them only at volume.
- **Full showcase** (Assist + narrated): add **Sanity Growth** ($15/seat/mo) and an **ElevenLabs** paid plan (~$5/mo+) on top.
- **Free-est possible deploy** (Hobby): promo/teaser only, `maxDuration ≤ 300`, no narrated, no Assist — see the Vercel escape hatch above.
