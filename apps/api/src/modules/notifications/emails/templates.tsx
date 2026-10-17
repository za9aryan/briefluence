import { Link, Section, Text } from '@react-email/components';
import { render } from '@react-email/render';
import { Cta, Layout, Paragraph } from './layout';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

async function build(subject: string, el: React.ReactElement): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
  return { subject, html, text };
}

/** Generic single-event email: every row in the Notifications table uses this template. */
export function NotificationEmail(p: { title: string; body: string; ctaUrl?: string; ctaLabel?: string }) {
  return (
    <Layout preview={p.body} title={p.title}>
      {p.body.split('\n').map((line, i) => (
        <Paragraph key={i}>{line}</Paragraph>
      ))}
      {p.ctaUrl && <Cta href={p.ctaUrl} label={p.ctaLabel ?? 'Open Briefluence'} />}
    </Layout>
  );
}

export function DigestEmail(p: {
  title: string;
  intro: string;
  items: { title: string; subtitle: string; url: string }[];
  ctaUrl: string;
  ctaLabel: string;
}) {
  return (
    <Layout preview={p.intro} title={p.title}>
      <Paragraph>{p.intro}</Paragraph>
      {p.items.map((item, i) => (
        <Section key={i} style={{ borderTop: '1px solid #EEE6EF', padding: '12px 0' }}>
          <Link href={item.url} style={{ color: '#241B2B', fontWeight: 600, fontSize: 15 }}>
            {item.title}
          </Link>
          <Text style={{ color: '#6B6175', fontSize: 13, margin: '4px 0 0' }}>{item.subtitle}</Text>
        </Section>
      ))}
      <Cta href={p.ctaUrl} label={p.ctaLabel} />
    </Layout>
  );
}

export const renderNotificationEmail = (p: Parameters<typeof NotificationEmail>[0]) =>
  build(p.title, <NotificationEmail {...p} />);

export const renderDigestEmail = (p: Parameters<typeof DigestEmail>[0]) => build(p.title, <DigestEmail {...p} />);

export const renderVerifyEmail = (url: string) =>
  build(
    'Confirm your email',
    <NotificationEmail
      title="Confirm your email"
      body={'Welcome to briefluence! Please confirm your email address to start using your account.\nThe link is valid for 48 hours.'}
      ctaUrl={url}
      ctaLabel="Confirm email"
    />,
  );

export const renderResetPasswordEmail = (url: string) =>
  build(
    'Reset your password',
    <NotificationEmail
      title="Reset your password"
      body={'Someone asked to reset the password of your Briefluence account. If it was you, use the button below; the link is valid for 1 hour.\nIf it was not you, ignore this email.'}
      ctaUrl={url}
      ctaLabel="Choose a new password"
    />,
  );
