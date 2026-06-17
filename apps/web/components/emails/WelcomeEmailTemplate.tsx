import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type {WelcomeEmail} from '@/lib/sanity.queries';
import {Hero, emailStyles as styles, renderIntro} from './shared';

// The welcome email a new subscriber receives after confirming (double opt-in).
// Content is editor-controlled via the `welcomeEmail` singleton in Studio, and
// the GIF hero is the `site-preview-gif` variant of the chosen render — the same
// fan-out asset the newsletter uses, here closing the visitor-facing loop.
export interface WelcomeEmailTemplateProps {
  welcome: WelcomeEmail;
  siteUrl: string;
  unsubscribeUrl?: string;
}

export function WelcomeEmailTemplate({welcome, siteUrl, unsubscribeUrl}: WelcomeEmailTemplateProps) {
  const {subject, previewText, intro, video, post} = welcome;
  const heroUrl = video?.gifUrl ?? video?.posterUrl ?? null;
  const heroAlt = video?.title ?? 'Video preview';
  const ctaHref = post?.slug ? `${siteUrl}/posts/${post.slug}` : null;

  return (
    <Html>
      <Head />
      {previewText ? <Preview>{previewText}</Preview> : null}
      <Body style={styles.body}>
        <Container style={styles.container}>
          {previewText ? <Text style={styles.preheader}>{previewText}</Text> : null}

          {intro && Array.isArray(intro) && intro.length > 0 ? (
            <Section>{renderIntro(intro)}</Section>
          ) : null}

          {heroUrl ? <Hero heroUrl={heroUrl} heroAlt={heroAlt} ctaHref={ctaHref} /> : null}

          <Heading as="h1" style={styles.heading}>
            {post?.title ?? video?.title ?? subject}
          </Heading>

          {post?.excerpt ? <Text style={styles.excerpt}>{post.excerpt}</Text> : null}

          {ctaHref ? (
            <Section style={{margin: '0 0 32px 0'}}>
              <Button href={ctaHref} style={styles.button}>
                Watch on the site
              </Button>
            </Section>
          ) : null}

          <Hr style={styles.hr} />

          <Text style={styles.footer}>
            You&apos;re receiving this because you confirmed your subscription.
            {unsubscribeUrl ? (
              <>
                {' '}
                <Link href={unsubscribeUrl} style={styles.footerLink}>
                  Unsubscribe
                </Link>
              </>
            ) : null}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmailTemplate;
