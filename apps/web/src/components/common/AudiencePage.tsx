import {
  Card,
  Container,
  Grid,
  Heading,
  Icon,
  Stack,
  Text,
  buttonStyles,
  type IconName,
} from '@briefluence/ui';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { FeatureItem, Section } from './Section';

/** Shared layout of /for-brands and /for-influencers. */
export async function AudiencePage({
  ns,
  features,
  cta,
  stats,
  afterHero,
  children,
}: {
  ns: 'brands' | 'influencers';
  features: [string, IconName][];
  cta: string;
  /** Keys of `landing.<ns>.stats.items` to show as big-number blocks. */
  stats?: string[];
  /** Extra blocks right under the hero. */
  afterHero?: ReactNode;
  /** Extra blocks after the feature list. */
  children?: ReactNode;
}) {
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
      {afterHero}
      {stats?.length ? (
        <section aria-labelledby="stats-title">
          <Container size="lg" py={{ base: 8, md: 12 }}>
            <Stack gap={6}>
              <Stack gap={2}>
                <Heading level={2} id="stats-title">
                  {t('stats.title')}
                </Heading>
                <Text tone="muted">{t('stats.lead')}</Text>
              </Stack>
              <Grid cols={{ base: 1, md: 3 }} gap={4}>
                {stats.map((k) => (
                  <Card key={k} className="flex h-full flex-col">
                    <Stack gap={2} className="flex-1">
                      <p className="text-display font-extrabold leading-none text-primary-text">
                        {t(`stats.items.${k}.value`)}
                      </p>
                      <Text className="flex-1">{t(`stats.items.${k}.label`)}</Text>
                      <Text size="small" tone="muted">
                        {t(`stats.items.${k}.source`)}
                      </Text>
                    </Stack>
                  </Card>
                ))}
              </Grid>
              <Text size="small" tone="muted">
                {t('stats.note')}
              </Text>
            </Stack>
          </Container>
        </section>
      ) : null}
      <Section raised>
        <Grid cols={{ base: 1, md: 2 }} gap={8}>
          {features.map(([k, icon]) => (
            <FeatureItem
              key={k}
              icon={<Icon name={icon} size="md" />}
              title={t(`features.${k}.title`)}
            >
              {t(`features.${k}.body`)}
            </FeatureItem>
          ))}
        </Grid>
      </Section>
      {children}
    </>
  );
}
