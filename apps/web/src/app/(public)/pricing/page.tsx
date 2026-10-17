import { formatMoney } from '@briefluence/shared';
import { Badge, Card, Container, Grid, Heading, Icon, Inline, Stack, Text, buttonStyles } from '@briefluence/ui';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Section } from '@/components/common/Section';
import { INTL_LOCALE, type Locale } from '@/i18n/config';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('nav'))('pricing') };
}

const PRICE_MINOR = Number(process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE_MINOR ?? 999);
const PRICE_CURRENCY = (process.env.NEXT_PUBLIC_SUBSCRIPTION_CURRENCY ?? 'USD') as 'USD' | 'AMD';

export default async function PricingPage() {
  const t = await getTranslations('landing.pricing');
  const locale = (await getLocale()) as Locale;
  const price = formatMoney(PRICE_MINOR, PRICE_CURRENCY, INTL_LOCALE[locale]);
  const plans = [
    { key: 'brand' as const, href: '/signup?role=BRAND', highlight: false },
    { key: 'influencer' as const, href: '/signup?role=INFLUENCER', highlight: true },
  ];
  return (
    <>
      <section>
        <Container size="lg" py={{ base: 8, md: 16 }}>
          <Stack gap={4} className="max-w-2xl">
            <Heading level={1}>{t('title')}</Heading>
            <Text tone="muted">{t('lead')}</Text>
          </Stack>
          <Grid cols={{ base: 1, md: 2 }} gap={6} className="mt-8 md:mt-12">
            {plans.map((p) => (
              <Card key={p.key} p={{ base: 6, md: 8 }} className={p.highlight ? 'border-2 border-primary' : undefined}>
                <Stack gap={6}>
                  <Badge tone={p.highlight ? 'primary' : 'neutral'} className="self-start">
                    {t(`${p.key}.name`)}
                  </Badge>
                  <Stack gap={1}>
                    <span className="text-display font-extrabold text-ink">{p.key === 'influencer' ? t('influencer.price', { price }) : t('brand.price')}</span>
                    <Text tone="muted">{t(`${p.key}.period`)}</Text>
                  </Stack>
                  <Stack gap={2}>
                    {(['a', 'b', 'c', 'd'] as const).map((k) => (
                      <Inline key={k} gap={2}>
                        <Icon name="check" tone="success" />
                        <Text>{t(`${p.key}.features.${k}`)}</Text>
                      </Inline>
                    ))}
                  </Stack>
                  <Link href={p.href} className={buttonStyles({ variant: p.highlight ? 'primary' : 'secondary', size: 'lg', block: true })}>
                    {t(`${p.key}.cta`)}
                  </Link>
                </Stack>
              </Card>
            ))}
          </Grid>
        </Container>
      </section>
      <Section raised title={t('faq.title')}>
        <Grid cols={{ base: 1, md: 3 }} gap={8}>
          {(['card', 'cancel', 'cards'] as const).map((k) => (
            <Stack key={k} gap={2}>
              <Heading level={3}>{t(`faq.${k}.q`)}</Heading>
              <Text tone="muted">{t(`faq.${k}.a`)}</Text>
            </Stack>
          ))}
        </Grid>
      </Section>
    </>
  );
}
