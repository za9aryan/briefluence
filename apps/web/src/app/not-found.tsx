import { Container, Heading, LogoMark, Stack, Text, buttonStyles } from '@briefluence/ui';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <Container size="sm" className="flex min-h-dvh items-center">
      <Stack gap={4} align="center" className="w-full text-center">
        <LogoMark className="size-16 text-primary" />
        <Heading level={1} size="h1">
          {t('notFoundTitle')}
        </Heading>
        <Text tone="muted">{t('notFoundBody')}</Text>
        <Link href="/" className={buttonStyles({})}>
          {t('goHome')}
        </Link>
      </Stack>
    </Container>
  );
}
