import {NextRequest, NextResponse} from 'next/server';
import {createClient} from '@sanity/client';
import {render} from '@react-email/render';
import {authorizeStudioRequest} from '@/lib/validateStudioUser';
import {WELCOME_EMAIL_QUERY, type WelcomeEmail} from '@/lib/sanity.queries';
import {WelcomeEmailTemplate} from '@/components/emails/WelcomeEmailTemplate';

// Read-only preview of the welcome-email singleton for the Studio "Preview
// welcome email" action. Mirrors /api/newsletter/preview: the Studio fetch()es
// with the editor's Sanity token in an Authorization header and injects the HTML
// via iframe `srcDoc`, so the token never lands in a URL. No writes, no Resend.
const NEWSLETTER_SEND_SECRET = process.env.NEWSLETTER_SEND_SECRET;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
  if (!(await authorizeStudioRequest(req.headers.get('authorization'), NEWSLETTER_SEND_SECRET))) {
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

  // `drafts` perspective so editors preview unpublished edits to the singleton.
  const sanity = createClient({
    projectId,
    dataset,
    token,
    useCdn: false,
    apiVersion: '2024-12-27',
    perspective: 'drafts',
  });

  const welcome = await sanity.fetch<WelcomeEmail | null>(WELCOME_EMAIL_QUERY);
  if (!welcome) {
    return jsonResponse({error: 'Welcome email not configured yet'}, {status: 404});
  }
  if (!welcome.video || !welcome.video.gifUrl) {
    return jsonResponse(
      {error: "Welcome email's hero video is not ready or has no site-preview-gif variant"},
      {status: 422},
    );
  }

  const html = await render(
    <WelcomeEmailTemplate
      welcome={welcome}
      siteUrl={SITE_URL}
      unsubscribeUrl="#preview-unsubscribe-placeholder"
    />,
  );

  return new NextResponse(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
