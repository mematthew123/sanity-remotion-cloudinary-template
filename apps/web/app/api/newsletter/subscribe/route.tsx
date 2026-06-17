import {NextRequest, NextResponse} from 'next/server';
import {Resend} from 'resend';
import {render} from '@react-email/render';
import {client} from '@/lib/sanity.client';
import {WELCOME_EMAIL_QUERY} from '@/lib/sanity.queries';
import {ConfirmEmailTemplate} from '@/components/emails/ConfirmEmailTemplate';
import {createSubscribeToken} from '@/lib/subscribeToken';
import {isThrottled, markSent} from '@/lib/signupThrottle';

// Public, visitor-facing endpoint — NO bearer secret (unlike the editor-only
// send/preview routes). It never adds anyone to the audience directly; it only
// emails a signed confirm link (double opt-in). The contact is created later,
// in the confirm route, so an unconfirmed/forged address never enters Resend.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NEWSLETTER_SEND_SECRET = process.env.NEWSLETTER_SEND_SECRET;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fromAddress(): string {
  if (!RESEND_FROM_EMAIL) throw new Error('RESEND_FROM_EMAIL not configured');
  return RESEND_FROM_NAME ? `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>` : RESEND_FROM_EMAIL;
}

export async function POST(req: NextRequest) {
  if (!RESEND_API_KEY || !NEWSLETTER_SEND_SECRET) {
    return NextResponse.json({error: 'Newsletter signup is not configured.'}, {status: 500});
  }

  const body = (await req.json().catch(() => ({}))) as {email?: string; company?: string};

  // Honeypot: the hidden `company` field is invisible to humans. If it's filled,
  // it's a bot — return a fake success so it doesn't retry.
  if (body.company) return NextResponse.json({ok: true});

  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({error: 'Enter a valid email address.'}, {status: 400});
  }

  // Always answer ok past validation so the form never reveals whether an
  // address is already pending or subscribed (no enumeration).
  if (isThrottled(email)) return NextResponse.json({ok: true});

  const welcome = await client.fetch(WELCOME_EMAIL_QUERY);
  // Feature off or singleton unconfigured → accept the request, send nothing.
  if (!welcome || welcome.enabled === false) {
    return NextResponse.json({ok: true, skipped: true});
  }

  const confirmSubject = welcome.confirmationSubject ?? 'Confirm your subscription';
  const token = createSubscribeToken(email, NEWSLETTER_SEND_SECRET);
  const confirmUrl = `${SITE_URL}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
  // Build the element outside the try: @react-email/render throws synchronously
  // on bad props, but the lint rule flags JSX authored inside try/catch.
  const confirmEmail = (
    <ConfirmEmailTemplate
      confirmUrl={confirmUrl}
      subject={confirmSubject}
      body={welcome.confirmationBody ?? 'Click the button below to confirm your subscription.'}
    />
  );

  try {
    const html = await render(confirmEmail);
    const resend = new Resend(RESEND_API_KEY);
    const {error} = await resend.emails.send({
      from: fromAddress(),
      to: email,
      subject: confirmSubject,
      html,
    });
    if (error) throw new Error(JSON.stringify(error));

    markSent(email);
    return NextResponse.json({ok: true});
  } catch (err) {
    console.error('Subscribe confirm-send failed:', err);
    return NextResponse.json(
      {error: 'Could not send the confirmation email. Please try again.'},
      {status: 500},
    );
  }
}
