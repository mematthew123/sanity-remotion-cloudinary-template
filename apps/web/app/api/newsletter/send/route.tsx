import {NextRequest, NextResponse} from 'next/server';
import {createClient} from '@sanity/client';
import {render} from '@react-email/render';
import {Resend} from 'resend';
import {timingSafeEqual} from 'node:crypto';
import {NEWSLETTER_BY_EITHER_ID_QUERY, type NewsletterForSend} from '@/lib/sanity.queries';
import {NewsletterTemplate} from '@/components/emails/NewsletterTemplate';

// Auth follows the render route's `Authorization: Bearer ${SECRET}` pattern so
// the same bundled-secret caveat applies (see CLAUDE.md "Env: three prefixes").
const NEWSLETTER_SEND_SECRET = process.env.NEWSLETTER_SEND_SECRET;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME;

// Studio runs at localhost:3333 (dev) or sanity.studio (prod) and calls this
// route cross-origin. The browser preflights with OPTIONS because we send a
// custom `Authorization` header — mirror the render route's CORS handling.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const maxDuration = 60;

export async function OPTIONS() {
  return new NextResponse(null, {status: 200, headers: corsHeaders});
}

// Thin wrapper around NextResponse.json that always merges in CORS headers.
// Without this, every error path would need to spread `corsHeaders` manually
// (the existing render route does that — fine but verbose).
function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {...corsHeaders, ...(init?.headers ?? {})},
  });
}

function secureCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function fromAddress(): string {
  if (!RESEND_FROM_EMAIL) throw new Error('RESEND_FROM_EMAIL not configured');
  return RESEND_FROM_NAME ? `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>` : RESEND_FROM_EMAIL;
}

export async function POST(req: NextRequest) {
  if (!NEWSLETTER_SEND_SECRET) {
    return jsonResponse({error: 'NEWSLETTER_SEND_SECRET not configured'}, {status: 500});
  }
  if (!RESEND_API_KEY) {
    return jsonResponse({error: 'RESEND_API_KEY not configured'}, {status: 500});
  }

  const authHeader = req.headers.get('authorization');
  const expected = `Bearer ${NEWSLETTER_SEND_SECRET}`;
  if (!authHeader || !secureCompare(authHeader, expected)) {
    return jsonResponse({error: 'Unauthorized'}, {status: 401});
  }

  const body = (await req.json().catch(() => ({}))) as {
    documentId?: string;
    confirmAudienceSend?: boolean;
  };
  const {documentId, confirmAudienceSend} = body;
  if (!documentId) return jsonResponse({error: 'Missing documentId'}, {status: 400});

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!projectId || !dataset || !token) {
    return jsonResponse(
      {error: 'Sanity not configured (need NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_WRITE_TOKEN)'},
      {status: 500},
    );
  }

  // Use 'raw' perspective: we need the actual storage `_id` (drafts.X or X)
  // for the ifRevisionID patch below, not the rewritten base id Sanity returns
  // under 'drafts' perspective. Editors compose newsletters as drafts and
  // never click Publish (our plugin replaces the publish action with Send), so
  // we query both ids and pick whichever exists.
  const client = createClient({
    projectId,
    dataset,
    token,
    useCdn: false,
    apiVersion: '2024-12-27',
    perspective: 'raw',
  });

  const baseId = documentId.replace(/^drafts\./, '');
  const draftId = `drafts.${baseId}`;
  const newsletter = await client.fetch<NewsletterForSend | null>(
    NEWSLETTER_BY_EITHER_ID_QUERY,
    {draftId, baseId},
  );
  if (!newsletter) {
    return jsonResponse({error: `Newsletter ${documentId} not found`}, {status: 404});
  }

  // State machine guard. The Studio button disables when status!=='draft' but
  // we re-check server-side because the bundled secret could be replayed.
  if (newsletter.status && newsletter.status !== 'draft') {
    return jsonResponse(
      {error: `Newsletter is in status "${newsletter.status}", expected "draft"`},
      {status: 409},
    );
  }
  if (!newsletter.video || !newsletter.video.gifUrl) {
    return jsonResponse(
      {error: 'Newsletter\'s linked video is not ready or has no site-preview-gif variant'},
      {status: 422},
    );
  }
  if (!newsletter.subject) {
    return jsonResponse({error: 'Newsletter has no subject'}, {status: 422});
  }

  const selectionType = newsletter.recipientSelection?.selectionType;
  if (selectionType !== 'test' && selectionType !== 'audience') {
    return jsonResponse(
      {error: `Invalid recipientSelection.selectionType: ${selectionType}`},
      {status: 422},
    );
  }
  if (selectionType === 'audience' && !RESEND_AUDIENCE_ID) {
    return jsonResponse({error: 'RESEND_AUDIENCE_ID not configured'}, {status: 500});
  }
  if (selectionType === 'audience' && !confirmAudienceSend) {
    // Belt-and-braces: prevent a replayed-secret from triggering an unconfirmed
    // blast to the whole audience. The Studio Send dialog adds this flag only
    // after the editor clicks through the audience-warning confirmation.
    return jsonResponse(
      {error: 'Audience sends require confirmAudienceSend: true'},
      {status: 422},
    );
  }

  // ifRevisionID concurrency guard: two simultaneous clicks both transition
  // draft→sending; the second hits a 409 here instead of double-billing Resend.
  try {
    await client
      .patch(newsletter._id, {ifRevisionID: newsletter._rev})
      .set({status: 'sending'})
      .commit();
  } catch {
    return jsonResponse(
      {error: 'Newsletter was modified concurrently — refresh and try again'},
      {status: 409, headers: {'X-Concurrency-Conflict': '1'}},
    );
  }

  const resend = new Resend(RESEND_API_KEY);

  // Construct both potential email elements outside the try/catch — the lint
  // rule react-hooks/error-boundaries (correctly) flags JSX in try/catch
  // because component-render errors are async. Here we render to a string via
  // @react-email/render, which is synchronous and DOES throw on bad props, so
  // the await inside the try below catches what we need.
  const testElement = (
    <NewsletterTemplate
      newsletter={newsletter}
      siteUrl={SITE_URL}
      // Test mode: no per-recipient unsubscribe substitution available, so we
      // hide the link by pointing it at a benign anchor.
      unsubscribeUrl={`${SITE_URL}#test-send`}
    />
  );
  const audienceElement = <NewsletterTemplate newsletter={newsletter} siteUrl={SITE_URL} />;

  try {
    if (selectionType === 'test') {
      const testEmails = newsletter.recipientSelection?.testEmails ?? [];
      if (testEmails.length === 0) {
        throw new Error('Test send selected but no testEmails configured');
      }
      const html = await render(testElement);

      let sent = 0;
      for (const to of testEmails) {
        const {error} = await resend.emails.send({
          from: fromAddress(),
          to,
          subject: newsletter.subject!,
          html,
        });
        if (error) {
          console.error(`Test send to ${to} failed:`, error);
        } else {
          sent += 1;
        }
      }

      await client
        .patch(newsletter._id)
        .set({
          status: 'sent',
          sentAt: new Date().toISOString(),
          recipientCount: sent,
        })
        .commit();

      return jsonResponse({ok: true, mode: 'test', recipientCount: sent});
    }

    // Audience send — Resend Broadcasts handles list materialization, per-
    // recipient unsubscribe substitution, and List-Unsubscribe headers.
    const html = await render(audienceElement);

    const created = await resend.broadcasts.create({
      audienceId: RESEND_AUDIENCE_ID!,
      from: fromAddress(),
      subject: newsletter.subject!,
      html,
      name: newsletter.title ?? newsletter.subject!,
    });
    if (created.error || !created.data?.id) {
      throw new Error(`Resend broadcast create failed: ${JSON.stringify(created.error)}`);
    }
    const broadcastId = created.data.id;

    // 1-minute delay matches Resend's documented best-practice scheduling cap;
    // tighter scheduling sometimes 4xxs while the broadcast is still materializing.
    const scheduled = await resend.broadcasts.send(broadcastId, {scheduledAt: 'in 1 minute'});
    if (scheduled.error) {
      throw new Error(`Resend broadcast send failed: ${JSON.stringify(scheduled.error)}`);
    }

    await client
      .patch(newsletter._id)
      .set({
        status: 'sent',
        sentAt: new Date().toISOString(),
        resendBroadcastId: broadcastId,
      })
      .commit();

    return jsonResponse({ok: true, mode: 'audience', resendBroadcastId: broadcastId});
  } catch (err) {
    console.error('Newsletter send failed:', err);
    await client
      .patch(newsletter._id)
      .set({status: 'failed'})
      .commit()
      .catch((patchErr) => console.error('Failed to mark newsletter as failed:', patchErr));
    return jsonResponse(
      {error: err instanceof Error ? err.message : 'Send failed'},
      {status: 500},
    );
  }
}
