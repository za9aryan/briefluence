import {
  Badge,
  Block,
  Card,
  Container,
  Grid,
  Heading,
  Icon,
  Inline,
  Stack,
  Text,
  buttonStyles,
} from '@briefluence/ui';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { FeatureItem, Section } from '@/components/common/Section';
import { BrandInsights } from '@/components/landing/BrandInsights';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { ProcessFunnel } from '@/components/landing/ProcessFunnel';
import { SampleBriefCard } from '@/components/landing/SampleCards';
import { Showcase } from '@/components/landing/Showcase';

export default async function LandingPage() {
  const t = await getTranslations('landing');
  const tw = await getTranslations('showcase');
  const tp = await getTranslations('promo');

  return (
    <>
      {/* Hero */}
      <section>
        <Container py={{ base: 8, md: 16 }}>
          <Grid cols={{ base: 1, lg: 2 }} gap={{ base: 8, lg: 16 }} className="items-center">
            <Stack gap={6} align="start">
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
                {(['free', 'verified', 'options'] as const).map((k) => (
                  <Inline key={k} gap={1}>
                    <Icon name="check" tone="success" />
                    <Text size="small" tone="muted">
                      {t(`hero.points.${k}`)}
                    </Text>
                  </Inline>
                ))}
              </Inline>
            </Stack>

            {/* Sample brief in the feed's card style, with the moment you get picked */}
            <div className="mx-auto w-full max-w-sm">
              <SampleBriefCard
                image="/showcase/hotel.webp"
                brand={tp('briefs.hotel.brand')}
                meta={t('preview.meta')}
                title={t('preview.title')}
                slots={2}
                match={92}
                payment="MIXED"
                budget={50}
                barter={t('preview.stay')}
                formats={['REEL']}
                views={1240}
                applicants={14}
                className="pb-6"
              />
              <Card
                p={4}
                aria-hidden
                className="relative -mt-6 ml-auto w-11/12 shadow-pop sm:-mr-8"
              >
                <Inline gap={2} align="start">
                  <Icon name="check-circle" tone="success" size="md" />
                  <Text size="small" weight="bold">
                    {t('preview.accepted')}
                  </Text>
                </Inline>
              </Card>
            </div>
          </Grid>
        </Container>
      </section>

      <ProcessFunnel
        ns="funnel"
        cta="/signup?role=BRAND"
        points={['verified', 'match', 'contacts']}
        chores={[
          ['search', 'search'],
          ['followers', 'users'],
          ['dm', 'message'],
          ['screens', 'image'],
          ['haggle', 'wallet'],
          ['contacts', 'phone'],
        ]}
      />

      {/* Sample briefs and offers */}
      <Section eyebrow={tw('eyebrow')} title={tw('title')} lead={tw('lead')}>
        <Showcase />
      </Section>

      {/* How it works: the four steps as a tour */}
      <HowItWorks />

      {/* What influencers are looking for (sample of the companies' Insights page) */}
      <BrandInsights cta="/signup?role=BRAND" />

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
                  className={buttonStyles({
                    variant: 'link',
                    className: 'self-start whitespace-normal text-left',
                  })}
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
