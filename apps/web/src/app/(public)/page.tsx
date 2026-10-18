import {
  Badge,
  Block,
  Card,
  Container,
  Grid,
  Heading,
  Icon,
  Inline,
  ScoreMeter,
  Stack,
  Text,
  buttonStyles,
} from '@briefluence/ui';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { FeatureItem, Section } from '@/components/common/Section';

export default async function LandingPage() {
  const t = await getTranslations('landing');
  const steps = ['post', 'match', 'accept', 'publish'] as const;

  return (
    <>
      {/* Hero */}
      <section>
        <Container py={{ base: 8, md: 16 }}>
          <Grid cols={{ base: 1, lg: 2 }} gap={{ base: 8, lg: 16 }} className="items-center">
            <Stack gap={6} align="start">
              <Badge tone="primary">{t('hero.badge')}</Badge>
              <Heading level={1}>{t('hero.title')}</Heading>
              <Text tone="muted" className="max-w-xl">
                {t('hero.lead')}
              </Text>
              <Stack direction={{ base: 'col', sm: 'row' }} gap={2} className="w-full sm:w-auto">
                <Link href="/signup?role=BRAND" className={buttonStyles({ size: 'lg' })}>
                  {t('hero.ctaBrand')}
                </Link>
                <Link
                  href="/signup?role=INFLUENCER"
                  className={buttonStyles({ size: 'lg', variant: 'secondary' })}
                >
                  {t('hero.ctaInfluencer')}
                </Link>
              </Stack>
              <Inline gap={4} wrap>
                {(['free', 'verified', 'local'] as const).map((k) => (
                  <Inline key={k} gap={1}>
                    <Icon name="check" tone="success" />
                    <Text size="small" tone="muted">
                      {t(`hero.points.${k}`)}
                    </Text>
                  </Inline>
                ))}
              </Inline>
            </Stack>

            {/* Promo card preview, built from the brand book's card pattern */}
            <Stack gap={4} className="mx-auto w-full max-w-md">
              <Card p={4}>
                <Inline justify="between">
                  <Badge tone="barter">{t('preview.barter')}</Badge>
                  <Text size="small" tone="muted">
                    {t('preview.meta')}
                  </Text>
                </Inline>
                <Inline justify="between" align="start" gap={4} className="mt-4">
                  <Stack gap={1}>
                    <Heading level={3}>{t('preview.title')}</Heading>
                    <Text size="small" tone="muted">
                      {t('preview.subtitle')}
                    </Text>
                  </Stack>
                  <ScoreMeter value={92} label={t('preview.match')} />
                </Inline>
                <Inline gap={2} wrap className="mt-4">
                  <Badge icon="instagram">Reels</Badge>
                  <Badge tone="primary" icon="pin">
                    {t('preview.city')}
                  </Badge>
                </Inline>
                <div
                  className={buttonStyles({ block: true, className: 'pointer-events-none mt-6' })}
                >
                  {t('preview.apply')}
                </div>
              </Card>
              <Card p={4} className="ml-auto w-5/6">
                <Inline gap={2}>
                  <Icon name="check-circle" tone="success" size="md" />
                  <Text size="small" weight="bold">
                    {t('preview.accepted')}
                  </Text>
                </Inline>
              </Card>
            </Stack>
          </Grid>
        </Container>
      </section>

      {/* How it works */}
      <Section raised eyebrow={t('how.eyebrow')} title={t('how.title')} lead={t('how.lead')}>
        <Grid cols={{ base: 1, sm: 2, lg: 4 }} gap={6}>
          {steps.map((s, i) => (
            <Stack key={s} gap={2}>
              <span className="mb-2 inline-flex size-11 items-center justify-center rounded-pill bg-primary text-body font-extrabold text-on-primary">
                {i + 1}
              </span>
              <Heading level={3}>{t(`how.steps.${s}.title`)}</Heading>
              <Text tone="muted">{t(`how.steps.${s}.body`)}</Text>
            </Stack>
          ))}
        </Grid>
      </Section>

      {/* Two audiences */}
      <Section>
        <Grid cols={{ base: 1, md: 2 }} gap={6}>
          {(['brands', 'influencers'] as const).map((who) => (
            <Card key={who} p={{ base: 6, md: 8 }}>
              <Stack gap={4}>
                <Badge tone={who === 'brands' ? 'primary' : 'ink'} className="self-start">
                  {t(`audiences.${who}.badge`)}
                </Badge>
                <Heading level={3} size={{ base: 'h2', md: 'h1' }}>
                  {t(`audiences.${who}.title`)}
                </Heading>
                <Stack gap={2}>
                  {(['a', 'b', 'c'] as const).map((k) => (
                    <Inline key={k} gap={2} align="start">
                      <Icon name="check" tone="success" size="md" className="mt-0.5" />
                      <Text tone="muted">{t(`audiences.${who}.points.${k}`)}</Text>
                    </Inline>
                  ))}
                </Stack>
                <Link
                  href={who === 'brands' ? '/for-brands' : '/for-influencers'}
                  className={buttonStyles({ variant: 'link', className: 'self-start' })}
                >
                  {t(`audiences.${who}.more`)} <Icon name="arrow-right" />
                </Link>
              </Stack>
            </Card>
          ))}
        </Grid>
      </Section>

      {/* Trust */}
      <Section raised eyebrow={t('trust.eyebrow')} title={t('trust.title')}>
        <Grid cols={{ base: 1, md: 3 }} gap={8}>
          <FeatureItem icon={<Icon name="shield" size="md" />} title={t('trust.oauth.title')}>
            {t('trust.oauth.body')}
          </FeatureItem>
          <FeatureItem icon={<Icon name="verified" size="md" />} title={t('trust.review.title')}>
            {t('trust.review.body')}
          </FeatureItem>
          <FeatureItem icon={<Icon name="target" size="md" />} title={t('trust.match.title')}>
            {t('trust.match.body')}
          </FeatureItem>
        </Grid>
      </Section>

      {/* CTA */}
      <section>
        <Container py={{ base: 8, md: 16 }}>
          <Block surface="primary" radius="lg" p={{ base: 8, md: 12 }}>
            <Stack gap={4} align="center" className="text-center">
              <Heading level={2} tone="onPrimary">
                {t('cta.title')}
              </Heading>
              <Text tone="onPrimary" className="max-w-xl opacity-90">
                {t('cta.lead')}
              </Text>
              <Stack
                direction={{ base: 'col', sm: 'row' }}
                gap={2}
                className="mt-2 w-full sm:w-auto"
              >
                <Link
                  href="/signup?role=BRAND"
                  className={buttonStyles({ size: 'lg', className: 'bg-on-primary text-primary' })}
                >
                  {t('hero.ctaBrand')}
                </Link>
              </Stack>
            </Stack>
          </Block>
        </Container>
      </section>
    </>
  );
}
