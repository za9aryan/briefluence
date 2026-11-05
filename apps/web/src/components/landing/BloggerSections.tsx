import {
  Badge,
  Card,
  Container,
  Disclosure,
  Grid,
  Heading,
  Icon,
  IconBubble,
  Inline,
  Stack,
  Text,
  buttonStyles,
  type IconName,
} from '@briefluence/ui';
import { getTranslations } from 'next-intl/server';
import { SampleBriefCard, SampleOfferCard } from './SampleCards';
import { FeatureItem, Section } from '@/components/common/Section';

/** /for-influencers: the two ways to earn, each with a static preview built from real UI parts. */
export async function EarnWays() {
  const t = await getTranslations('landing.influencers.earn');
  const tp = await getTranslations('promo');
  const ts = await getTranslations('showcase');
  return (
    <Section title={t('title')} lead={t('lead')}>
      <Grid cols={{ base: 1, lg: 2 }} gap={6}>
        <Stack gap={4}>
          <Stack gap={1}>
            <Heading level={3}>{t('briefs.title')}</Heading>
            <Text tone="muted">{t('briefs.body')}</Text>
          </Stack>
          {/* Decorative sample brief in the feed's card style, with why it fits. */}
          <div aria-hidden className="pointer-events-none mx-auto w-full max-w-sm select-none">
            <SampleBriefCard
              image="/showcase/coffee.webp"
              brand={tp('briefs.coffee.brand')}
              meta={t('brief.meta')}
              title={t('brief.title')}
              slots={3}
              match={88}
              payment="MONEY"
              budget={[80, 130]}
              formats={['REEL']}
              views={640}
              applicants={9}
              className="pb-6"
            />
            <Card p={4} className="relative -mt-6 ml-auto w-11/12 shadow-pop sm:-mr-8">
              <Text size="small" weight="bold">
                {t('brief.why')}
              </Text>
              <Inline gap={2} wrap className="mt-2">
                {(['city', 'age', 'followers'] as const).map((k) => (
                  <Badge key={k} variant="small" tone="success" icon="check">
                    {t(`brief.reasons.${k}`)}
                  </Badge>
                ))}
              </Inline>
            </Card>
          </div>
        </Stack>

        <Stack gap={4}>
          <Stack gap={1}>
            <Heading level={3}>{t('offers.title')}</Heading>
            <Text tone="muted">{t('offers.body')}</Text>
          </Stack>
          {/* Decorative sample offer with an incoming request. */}
          <div aria-hidden className="pointer-events-none mx-auto w-full max-w-sm select-none">
            <SampleOfferCard
              image="/showcase/zofia.webp"
              name={ts('offers.zofia.name')}
              meta={ts('offers.zofia.city')}
              title={t('offer.title')}
              body={t('offer.body')}
              format="REEL"
              price={50}
              className="pb-6"
            />
            <Card p={4} className="relative -mt-6 ml-auto w-11/12 shadow-pop sm:-mr-8">
              <Inline gap={4} align="start">
                <IconBubble name="building" tone="primary" />
                <Stack gap={2} className="min-w-0 flex-1">
                  <Text weight="bold">{t('offer.request')}</Text>
                  <Inline gap={2} wrap>
                    <div className={buttonStyles({ size: 'sm' })}>{t('offer.accept')}</div>
                    <div className={buttonStyles({ size: 'sm', variant: 'secondary' })}>
                      {t('offer.decline')}
                    </div>
                  </Inline>
                </Stack>
              </Inline>
            </Card>
          </div>
        </Stack>
      </Grid>
    </Section>
  );
}

const NO_CATCH: [string, IconName][] = [
  ['commission', 'wallet'],
  ['private', 'lock'],
  ['choice', 'check-circle'],
];

/** /for-influencers: what we don't do to bloggers (only claims the product enforces). */
export async function NoCatch() {
  const t = await getTranslations('landing.influencers.noCatch');
  return (
    <Section raised title={t('title')}>
      <Grid cols={{ base: 1, md: 3 }} gap={8}>
        {NO_CATCH.map(([k, icon]) => (
          <FeatureItem key={k} icon={<Icon name={icon} size="md" />} title={t(`${k}.title`)}>
            {t(`${k}.body`)}
          </FeatureItem>
        ))}
      </Grid>
    </Section>
  );
}

const FAQ = ['followers', 'pay', 'plans', 'review', 'noReply'] as const;

/** /for-influencers: short answers to what bloggers ask before signing up. */
export async function BloggerFaq() {
  const t = await getTranslations('landing.influencers.faq');
  return (
    <section aria-labelledby="faq-title">
      <Container size="md" py={{ base: 8, md: 12, lg: 16 }}>
        <Stack gap={6}>
          <Heading level={2} id="faq-title">
            {t('title')}
          </Heading>
          <div>
            {FAQ.map((k) => (
              <Disclosure key={k} summary={t(`items.${k}.q`)}>
                {t(`items.${k}.a`)}
              </Disclosure>
            ))}
          </div>
        </Stack>
      </Container>
    </section>
  );
}
