import { Container, Heading, Stack, Text } from '@briefluence/ui';
import { getTranslations } from 'next-intl/server';

/** Terms / privacy page rendered from the `legal` namespace (sections a…h). */
export async function LegalPage({ doc }: { doc: 'terms' | 'privacy' }) {
  const t = await getTranslations(`legal.${doc}`);
  const tl = await getTranslations('legal');
  const sections = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].filter((k) => t.has(`sections.${k}.title`));
  return (
    <Container size="md" py={{ base: 8, md: 16 }}>
      <Stack gap={8}>
        <Stack gap={2}>
          <Heading level={1} size="h1">
            {t('title')}
          </Heading>
          <Text size="small" tone="muted">
            {tl('updated')}
          </Text>
        </Stack>
        <Text>{t('intro')}</Text>
        {sections.map((k) => (
          <Stack key={k} gap={2}>
            <Heading level={2} size="h2">
              {t(`sections.${k}.title`)}
            </Heading>
            <Text tone="muted" className="whitespace-pre-line">
              {t(`sections.${k}.body`)}
            </Text>
          </Stack>
        ))}
        <Text size="small" tone="muted">
          {tl('contact')}
        </Text>
      </Stack>
    </Container>
  );
}
