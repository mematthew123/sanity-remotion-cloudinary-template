import {NextRequest, NextResponse} from 'next/server';
import {createClient} from '@sanity/client';
import {render} from '@react-email/render';
import {Resend} from 'resend';
import {authorizeStudioRequest} from '@/lib/validateStudioUser';
import {NEWSLETTER_BY_EITHER_ID_QUERY, type NewsletterForSend} from '@/lib/sanity.queries';
import {NewsletterTemplate} from '@/components/emails/NewsletterTemplate';

// Auth mirrors the render route (see lib/validateStudioUser): the Studio sends
// the logged-in editor's Sanity token, validated server-side as a write-capable
// project member. NEWSLETTER_SEND_SECRET stays as an OPTIONAL server-side
// fallback for CI/automation — it is no longer bundled into the Studio's JS.
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

// A doc stuck in `sending` (the function died mid-send) can be re-sent once it's
// clearly abandoned — well past maxDuration — but only if no broadcast was ever
// created for it, so a reclaim can never email the audience twice. Mirrored in
// the Studio's SendNewsletterAction.
const STALE_SENDING_MS = 5 * 60 * 1000;

// `failed` is only ever set when nothing reached the audience, so it's sendable.
function sendableReason(newsletter: {
  status?: string | null;
  _updatedAt?: string | null;
  resendBroadcastId?: string | null;
}): string | null {
  const status = newsletter.status ?? 'draft';
  if (status === 'draft' || status === 'failed') return null;
  if (status === 'sending') {
    const age = Date.now() - new Date(newsletter._updatedAt ?? 0).getTime();
    if (age > STALE_SENDING_MS && !newsletter.resendBroadcastId) return null;
    return 'Newsletter is already sending';
  }
  return `Newsletter is in status "${status}"`;
}

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

function fromAddress(): string {
  if (!RESEND_FROM_EMAIL) throw new Error('RESEND_FROM_EMAIL not configured');
  return RESEND_FROM_NAME ? `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>` : RESEND_FROM_EMAIL;
}

export async function POST(req: NextRequest) {
  if (!RESEND_API_KEY) {
    return jsonResponse({error: 'RESEND_API_KEY not configured'}, {status: 500});
  }

  const authHeader = req.headers.get('authorization');
  if (!(await authorizeStudioRequest(authHeader, NEWSLETTER_SEND_SECRET))) {
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

  // State machine guard. The Studio button disables on the same rule, but we
  // re-check server-side because the fallback secret could be replayed.
  const notSendable = sendableReason(newsletter);
  if (notSendable) {
    return jsonResponse({error: notSendable}, {status: 409});
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

  // Set once Resend has accepted the broadcast. From then on the audience will
  // be emailed, so no error may mark the doc `failed` (which is re-sendable).
  let scheduledBroadcastId: string | null = null;

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

      // A test send is a rehearsal: back to `draft` so the real send stays
      // available, with the test timestamp recorded alongside.
      await client
        .patch(newsletter._id)
        .set({status: 'draft', ...(sent > 0 ? {lastTestSentAt: new Date().toISOString()} : {})})
        .commit();

      if (sent === 0) {
        return jsonResponse(
          {error: 'No test emails were delivered — check the server logs for Resend errors'},
          {status: 502},
        );
      }
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

    // Record the broadcast before scheduling it, so a doc left in `sending` by a
    // crash after this point is never reclaimed (see sendableReason).
    await client.patch(newsletter._id).set({resendBroadcastId: broadcastId}).commit();

    // 1-minute delay matches Resend's documented best-practice scheduling cap;
    // tighter scheduling sometimes 4xxs while the broadcast is still materializing.
    const scheduled = await resend.broadcasts.send(broadcastId, {scheduledAt: 'in 1 minute'});
    if (scheduled.error) {
      throw new Error(`Resend broadcast send failed: ${JSON.stringify(scheduled.error)}`);
    }
    scheduledBroadcastId = broadcastId;

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
    if (scheduledBroadcastId) {
      // The broadcast is going out; only the final status write failed. Report
      // success so nobody retries — the doc stays `sending` with its broadcast
      // id, which is never reclaimed.
      console.error('Broadcast scheduled but marking the newsletter sent failed:', err);
      return jsonResponse({
        ok: true,
        mode: 'audience',
        resendBroadcastId: scheduledBroadcastId,
        warning: 'Broadcast scheduled, but the newsletter status could not be updated',
      });
    }
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
