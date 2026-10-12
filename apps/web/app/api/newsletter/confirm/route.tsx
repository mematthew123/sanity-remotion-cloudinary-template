import {NextRequest, NextResponse} from 'next/server';
import {Resend} from 'resend';
import {render} from '@react-email/render';
import {client} from '@/lib/sanity.client';
import {WELCOME_EMAIL_QUERY} from '@/lib/sanity.queries';
import {WelcomeEmailTemplate} from '@/components/emails/WelcomeEmailTemplate';
import {verifySubscribeToken, SUBSCRIBE_TOKEN_SECRET} from '@/lib/subscribeToken';

// The other half of double opt-in. The confirm link from the subscribe email
// lands here: verify the signed token, add the contact to the Resend audience,
// and deliver the GIF-hero welcome email. Then redirect to a friendly page.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME;

function fromAddress(): string {
  if (!RESEND_FROM_EMAIL) throw new Error('RESEND_FROM_EMAIL not configured');
  return RESEND_FROM_NAME ? `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>` : RESEND_FROM_EMAIL;
}

function redirectTo(status: 'ok' | 'already' | 'invalid' | 'error') {
  return NextResponse.redirect(`${SITE_URL}/newsletter/confirmed?status=${status}`);
}

export async function GET(req: NextRequest) {
  if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID || !SUBSCRIBE_TOKEN_SECRET) {
    return redirectTo('error');
  }

  const token = new URL(req.url).searchParams.get('token');
  const email = token ? verifySubscribeToken(token, SUBSCRIBE_TOKEN_SECRET) : null;
  if (!email) return redirectTo('invalid');

  const resend = new Resend(RESEND_API_KEY);

  // Add to the audience. A create error doesn't say *why* it failed, so look
  // the contact up: an active subscriber means a repeat click (skip the
  // welcome); a past unsubscriber who just re-confirmed via a signed link is
  // resubscribed; anything else (rate limit, bad key, network) is a real error.
  const created = await resend.contacts.create({
    audienceId: RESEND_AUDIENCE_ID,
    email,
    unsubscribed: false,
  });
  if (created.error) {
    const existing = await resend.contacts.get({audienceId: RESEND_AUDIENCE_ID, email});
    if (existing.error || !existing.data) {
      console.error('Confirm: contact create failed:', created.error);
      return redirectTo('error');
    }
    if (!existing.data.unsubscribed) return redirectTo('already');
    const updated = await resend.contacts.update({
      audienceId: RESEND_AUDIENCE_ID,
      email,
      unsubscribed: false,
    });
    if (updated.error) {
      console.error('Confirm: resubscribe failed:', updated.error);
      return redirectTo('error');
    }
  }

  // Newly subscribed → send the welcome email if the singleton is configured.
  const welcome = await client.fetch(WELCOME_EMAIL_QUERY);
  if (welcome && welcome.enabled !== false && welcome.subject && welcome.video?.gifUrl) {
    const welcomeEmail = <WelcomeEmailTemplate welcome={welcome} siteUrl={SITE_URL} />;
    try {
      const html = await render(welcomeEmail);
      await resend.emails.send({
        from: fromAddress(),
        to: email,
        subject: welcome.subject,
        html,
      });
    } catch (err) {
      // The subscription succeeded even if the welcome bounced — don't fail the
      // confirm over a send error; just log it.
      console.error('Welcome email send failed:', err);
    }
  }

  return redirectTo('ok');
}
