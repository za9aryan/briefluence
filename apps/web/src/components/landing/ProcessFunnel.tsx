import {
  Container,
  Eyebrow,
  Grid,
  Heading,
  Icon,
  Inline,
  LogoMark,
  Stack,
  Text,
  buttonStyles,
  type IconName,
} from '@briefluence/ui';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import s from './ProcessFunnel.module.css';

/**
 * Drift path of each chip slot (cqw / cqh from the center) and its wobble speed.
 * Each slot keeps its own row so long (Armenian) labels never stack on a 360px screen.
 */
const SLOTS: { path: number[]; r: number; w: string }[] = [
  { path: [-14, -35, -20, -31, -8, -38], r: -6, w: '2.1s' },
  { path: [16, -21, 10, -26, 20, -16], r: 5, w: '2.6s' },
  { path: [-16, -7, -10, -2, -21, -11], r: 4, w: '1.9s' },
  { path: [14, 7, 20, 3, 8, 11], r: -5, w: '2.4s' },
  { path: [-12, 21, -19, 25, -6, 17], r: 6, w: '2.8s' },
  { path: [16, 35, 10, 31, 21, 38], r: -4, w: '2.2s' },
];

function chipStyle({ path, r, w }: (typeof SLOTS)[number]) {
  const [x1, y1, x2, y2, x3, y3] = path;
  return {
    '--x1': `${x1}cqw`,
    '--y1': `${y1}cqh`,
    '--x2': `${x2}cqw`,
    '--y2': `${y2}cqh`,
    '--x3': `${x3}cqw`,
    '--y3': `${y3}cqh`,
    '--r': `${r}deg`,
    '--w': w,
  } as CSSProperties;
}

/**
 * "Six chores → briefluence" block (animation left, explanation right). Used on the home page
 * (brand chores) and on /for-influencers (blogger chores). Texts: `landing.<ns>`
 * with eyebrow, title, lead, cta, chores.<key>, points.<key>.
 */
export async function ProcessFunnel({
  ns,
  chores,
  points,
  cta,
}: {
  ns: 'funnel' | 'influencers.funnel';
  /** Up to six [key, icon] pairs, in slot order. */
  chores: [string, IconName][];
  points: string[];
  cta: string;
}) {
  const t = await getTranslations(`landing.${ns}`);
  return (
    <section aria-labelledby={`${ns.replace('.', '-')}-title`}>
      <Container py={{ base: 8, md: 12, lg: 16 }}>
        <Grid cols={{ base: 1, lg: 2 }} gap={{ base: 8, lg: 16 }} className="items-center">
          {/* Decorative: the same chores are listed as text for screen readers below. */}
          <div
            aria-hidden
            className={`${s.stage} rounded-card border border-line bg-surface-raised`}
          >
            <div className={s.ring} />
            {chores.slice(0, SLOTS.length).map(([key, icon], i) => (
              <div key={key} className={s.chip} style={chipStyle(SLOTS[i]!)}>
                <span
                  className={`${s.wobble} rounded-pill border border-line bg-surface px-3 py-2 font-medium text-ink shadow-card`}
                >
                  <Icon name={icon} size="sm" className="text-ink-muted" />
                  {t(`chores.${key}`)}
                </span>
              </div>
            ))}
            <div className={`${s.logo} inline-flex items-center gap-2`}>
              <LogoMark className="size-10 text-primary md:size-12" />
              <span
                lang="en"
                className="font-display text-h2 font-extrabold tracking-tight text-ink md:text-h1"
              >
                briefluence
              </span>
            </div>
          </div>

          <Stack gap={4} align="start">
            <Eyebrow>{t('eyebrow')}</Eyebrow>
            <Heading level={2} id={`${ns.replace('.', '-')}-title`}>
              {t('title')}
            </Heading>
            <Text tone="muted">{t('lead')}</Text>
            <ul className="sr-only">
              {chores.map(([key]) => (
                <li key={key}>{t(`chores.${key}`)}</li>
              ))}
            </ul>
            <Stack gap={2}>
              {points.map((k) => (
                <Inline key={k} gap={2} align="start">
                  <Icon name="check" tone="success" size="md" className="mt-0.5" />
                  <Text>{t(`points.${k}`)}</Text>
                </Inline>
              ))}
            </Stack>
            <Link href={cta} className={buttonStyles({ className: 'mt-2' })}>
              {t('cta')}
            </Link>
          </Stack>
        </Grid>
      </Container>
    </section>
  );
}
