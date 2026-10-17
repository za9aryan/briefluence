import { Container, Grid, Heading, Icon, Stack, Text, buttonStyles, type IconName } from '@briefluence/ui';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { FeatureItem, Section } from './Section';

/** Shared layout of /for-brands and /for-influencers. */
export async function AudiencePage({ ns, features, cta }: { ns: 'brands' | 'influencers'; features: [string, IconName][]; cta: string }) {
  const t = await getTranslations(`landing.${ns}`);
  return (
    <>
      <section>
        <Container size="lg" py={{ base: 8, md: 16 }}>
          <Stack gap={6} align="start" className="max-w-3xl">
            <Heading level={1}>{t('title')}</Heading>
            <Text tone="muted">{t('lead')}</Text>
            <Link href={cta} className={buttonStyles({ size: 'lg' })}>
              {t('cta')}
            </Link>
          </Stack>
        </Container>
      </section>
      <Section raised>
        <Grid cols={{ base: 1, md: 2 }} gap={8}>
          {features.map(([k, icon]) => (
            <FeatureItem key={k} icon={<Icon name={icon} size="md" />} title={t(`features.${k}.title`)}>
              {t(`features.${k}.body`)}
            </FeatureItem>
          ))}
        </Grid>
      </Section>
    </>
  );
}
