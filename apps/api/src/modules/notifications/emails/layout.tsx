import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components';
import type { ReactNode } from 'react';

// Brand book tokens (light theme); emails cannot use CSS variables reliably.
const colors = { brand: '#C8187F', onBrand: '#FFFFFF', text: '#241B2B', muted: '#6B6175', bg: '#FCFAFD', line: '#EEE6EF' };
const font = "Manrope, 'Noto Sans Armenian', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export function Layout({ preview, title, children }: { preview: string; title: string; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.bg, fontFamily: font, margin: 0 }}>
        <Container style={{ maxWidth: 560, margin: '32px auto', backgroundColor: '#fff', borderRadius: 16, padding: 32, border: `1px solid ${colors.line}` }}>
          <Text style={{ color: colors.brand, fontWeight: 800, fontSize: 20, margin: 0, letterSpacing: '-0.01em' }}>briefluence</Text>
          <Heading as="h1" style={{ color: colors.text, fontSize: 22, margin: '24px 0 12px' }}>
            {title}
          </Heading>
          {children}
          <Hr style={{ margin: '32px 0 16px', borderColor: colors.line }} />
          <Text style={{ color: colors.muted, fontSize: 12, margin: 0 }}>
            You receive this email because you have a briefluence account. Digest emails can be turned off in your
            account settings.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={{ color: colors.text, fontSize: 15, lineHeight: '24px', margin: '0 0 12px' }}>{children}</Text>;
}

export function Cta({ href, label }: { href: string; label: string }) {
  return (
    <Section style={{ margin: '24px 0 8px' }}>
      <Button
        href={href}
        style={{
          backgroundColor: colors.brand,
          color: colors.onBrand,
          borderRadius: 999,
          padding: '12px 24px',
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        {label}
      </Button>
    </Section>
  );
}
