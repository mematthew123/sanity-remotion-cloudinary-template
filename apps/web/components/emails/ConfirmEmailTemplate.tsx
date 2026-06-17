import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import {emailStyles as styles} from './shared';

// The double-opt-in confirmation email: a subject, a line of copy, and a single
// confirm button. Intentionally plain — no GIF hero — so it reads as plumbing,
// not a campaign. Subject + body are editor-controlled via the `welcomeEmail`
// singleton; the GIF welcome arrives only after the visitor clicks Confirm.
export interface ConfirmEmailTemplateProps {
  confirmUrl: string;
  subject: string;
  body: string;
}

export function ConfirmEmailTemplate({confirmUrl, subject, body}: ConfirmEmailTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading as="h1" style={styles.heading}>
            {subject}
          </Heading>

          <Text style={styles.intro}>{body}</Text>

          <Section style={{margin: '8px 0 32px 0'}}>
            <Button href={confirmUrl} style={styles.button}>
              Confirm subscription
            </Button>
          </Section>

          <Text style={styles.footer}>
            If you didn&apos;t request this, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ConfirmEmailTemplate;
