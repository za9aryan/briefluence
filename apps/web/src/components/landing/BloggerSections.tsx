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
  ScoreMeter,
  Stack,
  Text,
  buttonStyles,
  type IconName,
} from '@briefluence/ui';
import { getTranslations } from 'next-intl/server';
import { FeatureItem, Section } from '@/components/common/Section';

/** /for-influencers: the two ways to earn, each with a static preview built from real UI parts. */
export async function EarnWays() {
  const t = await getTranslations('landing.influencers.earn');
  return (
    <Section title={t('title')} lead={t('lead')}>
      <Grid cols={{ base: 1, lg: 2 }} gap={6}>
        <Stack gap={4}>
          <Stack gap={1}>
            <Heading level={3}>{t('briefs.title')}</Heading>
            <Text tone="muted">{t('briefs.body')}</Text>
          </Stack>
          {/* Decorative sample brief: nothing here is clickable. */}
          <Card p={4} aria-hidden className="pointer-events-none select-none">
            <Inline justify="between">
              <Badge tone="primary">{t('brief.type')}</Badge>
              <Text size="small" tone="muted">
                {t('brief.meta')}
              </Text>
            </Inline>
            <Inline justify="between" align="start" gap={4} className="mt-4">
              <Stack gap={1}>
                <Heading level={3}>{t('brief.title')}</Heading>
                <Text size="small" weight="bold">
                  {t('brief.budget')}
                </Text>
              </Stack>
              <ScoreMeter value={88} label={t('brief.match')} />
            </Inline>
            <Text size="small" tone="muted" className="mt-4">
              {t('brief.why')}
            </Text>
            <Inline gap={2} wrap className="mt-2">
              {(['city', 'age', 'followers'] as const).map((k) => (
                <Badge key={k} tone="success" icon="check">
                  {t(`brief.reasons.${k}`)}
                </Badge>
              ))}
            </Inline>
            <div className={buttonStyles({ block: true, className: 'mt-6' })}>
              {t('brief.apply')}
            </div>
          </Card>
        </Stack>

        <Stack gap={4}>
          <Stack gap={1}>
            <Heading level={3}>{t('offers.title')}</Heading>
            <Text tone="muted">{t('offers.body')}</Text>
          </Stack>
          {/* Decorative sample service card with an incoming request. */}
          <Stack gap={4} aria-hidden className="pointer-events-none select-none">
            <Card p={4}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <Stack gap={1}>
                  <Inline gap={2}>
                    <Badge icon="instagram">Reels</Badge>
                  </Inline>
                  <Heading level={3} className="mt-2">
                    {t('offer.title')}
                  </Heading>
                  <Text size="small" tone="muted">
                    {t('offer.body')}
                  </Text>
                </Stack>
                <span className="shrink-0 text-h2 font-extrabold text-ink">{t('offer.price')}</span>
              </div>
            </Card>
            <Card p={4} className="ml-auto w-full sm:w-5/6">
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
          </Stack>
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
          <Card p={{ base: 4, md: 6 }} className="py-0 md:py-0">
            {FAQ.map((k) => (
              <Disclosure key={k} summary={t(`items.${k}.q`)}>
                {t(`items.${k}.a`)}
              </Disclosure>
            ))}
          </Card>
        </Stack>
      </Container>
    </section>
  );
}
