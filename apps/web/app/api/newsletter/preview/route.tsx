import {NextRequest, NextResponse} from 'next/server';
import {createClient} from '@sanity/client';
import {render} from '@react-email/render';
import {secureCompare} from '@/lib/secureCompare';
import {NEWSLETTER_BY_ID_QUERY, type NewsletterForSend} from '@/lib/sanity.queries';
import {NewsletterTemplate} from '@/components/emails/NewsletterTemplate';

// Preview is a GET because the Studio plugin embeds it in an iframe; iframes
// can't set Authorization headers easily, so the secret travels as a query
// param. The route only reads — no Sanity writes, no Resend calls.
const NEWSLETTER_SEND_SECRET = process.env.NEWSLETTER_SEND_SECRET;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// Iframes (the primary consumer) don't preflight, but adding CORS headers
// here means Studio code can also fetch() this route directly if it ever
// wants to (e.g., to inject the HTML into a Studio component).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, {status: 200, headers: corsHeaders});
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {...corsHeaders, ...(init?.headers ?? {})},
  });
}

export async function GET(req: NextRequest) {
  if (!NEWSLETTER_SEND_SECRET) {
    return jsonResponse({error: 'NEWSLETTER_SEND_SECRET not configured'}, {status: 500});
  }

  const {searchParams} = new URL(req.url);
  const id = searchParams.get('id');
  const secret = searchParams.get('secret');

  if (!id) return jsonResponse({error: 'Missing id'}, {status: 400});
  if (!secret || !secureCompare(secret, NEWSLETTER_SEND_SECRET)) {
    return jsonResponse({error: 'Unauthorized'}, {status: 401});
  }

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (!projectId || !dataset || !token) {
    return jsonResponse(
      {error: 'Sanity not configured (need NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_WRITE_TOKEN)'},
      {status: 500},
    );
  }

  // `drafts` perspective so the preview sees in-progress newsletter docs the
  // editor is still composing. Token required — drafts are private.
  const client = createClient({
    projectId,
    dataset,
    token,
    useCdn: false,
    apiVersion: '2024-12-27',
    perspective: 'drafts',
  });

  const newsletter = await client.fetch<NewsletterForSend | null>(NEWSLETTER_BY_ID_QUERY, {id});
  if (!newsletter) {
    return jsonResponse({error: `Newsletter ${id} not found`}, {status: 404});
  }
  if (!newsletter.video || !newsletter.video.gifUrl) {
    return jsonResponse(
      {error: 'Newsletter\'s linked video is not ready or has no site-preview-gif variant'},
      {status: 422},
    );
  }

  const html = await render(
    <NewsletterTemplate
      newsletter={newsletter}
      siteUrl={SITE_URL}
      unsubscribeUrl="#preview-unsubscribe-placeholder"
    />,
  );

  return new NextResponse(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      // Don't let the iframe cache stale previews while editors are iterating.
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
