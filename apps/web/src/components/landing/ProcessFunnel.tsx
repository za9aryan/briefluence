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
 * The chores a brand does by hand, and each chip's drift path (cqw / cqh from the center).
 * Each chip keeps its own row so long (Armenian) labels never stack on a 360px screen.
 */
const CHORES: { key: string; icon: IconName; path: number[]; r: number; w: string }[] = [
  { key: 'search', icon: 'search', path: [-14, -35, -20, -31, -8, -38], r: -6, w: '2.1s' },
  { key: 'followers', icon: 'users', path: [16, -21, 10, -26, 20, -16], r: 5, w: '2.6s' },
  { key: 'dm', icon: 'message', path: [-16, -7, -10, -2, -21, -11], r: 4, w: '1.9s' },
  { key: 'screens', icon: 'image', path: [14, 7, 20, 3, 8, 11], r: -5, w: '2.4s' },
  { key: 'haggle', icon: 'wallet', path: [-12, 21, -19, 25, -6, 17], r: 6, w: '2.8s' },
  { key: 'contacts', icon: 'phone', path: [16, 35, 10, 31, 21, 38], r: -4, w: '2.2s' },
];
const POINTS = ['verified', 'match', 'contacts'] as const;

function chipStyle(path: number[], r: number, w: string) {
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

/** Home block: six manual chores collapse into one brief (animation left, explanation right). */
export async function ProcessFunnel() {
  const t = await getTranslations('landing.funnel');
  return (
    <section aria-labelledby="funnel-title">
      <Container py={{ base: 8, md: 12, lg: 16 }}>
        <Grid cols={{ base: 1, lg: 2 }} gap={{ base: 8, lg: 16 }} className="items-center">
          {/* Decorative: the same chores are listed as text for screen readers below. */}
          <div
            aria-hidden
            className={`${s.stage} rounded-card border border-line bg-surface-raised`}
          >
            <div className={s.ring} />
            {CHORES.map((c) => (
              <div key={c.key} className={s.chip} style={chipStyle(c.path, c.r, c.w)}>
                <span
                  className={`${s.wobble} rounded-pill border border-line bg-surface px-3 py-2 font-medium text-ink shadow-card`}
                >
                  <Icon name={c.icon} size="sm" className="text-ink-muted" />
                  {t(`chores.${c.key}`)}
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
            <Heading level={2} id="funnel-title">
              {t('title')}
            </Heading>
            <Text tone="muted">{t('lead')}</Text>
            <ul className="sr-only">
              {CHORES.map((c) => (
                <li key={c.key}>{t(`chores.${c.key}`)}</li>
              ))}
            </ul>
            <Stack gap={2}>
              {POINTS.map((k) => (
                <Inline key={k} gap={2} align="start">
                  <Icon name="check" tone="success" size="md" className="mt-0.5" />
                  <Text>{t(`points.${k}`)}</Text>
                </Inline>
              ))}
            </Stack>
            <Link href="/signup?role=BRAND" className={buttonStyles({ className: 'mt-2' })}>
              {t('cta')}
            </Link>
          </Stack>
        </Grid>
      </Container>
    </section>
  );
}
