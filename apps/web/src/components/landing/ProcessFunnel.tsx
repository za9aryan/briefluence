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
 * Each slot keeps its own row so long (Armenian) labels never stack on a 360px screen; rows sit
 * a little low to leave the top-left corner to the timer.
 */
/** Hours each chore eats (shown as "+3 h" tags; they add up to the 14 h on the timer). */
const HOURS = [3, 2, 4, 1, 2, 2];

const SLOTS: { path: number[]; r: number; w: string }[] = [
  { path: [-14, -21, -20, -18, -8, -23], r: -6, w: '0.62s' },
  { path: [16, -10, 10, -14, 20, -6], r: 5, w: '0.8s' },
  { path: [-16, 1, -10, 5, -21, -2], r: 4, w: '0.55s' },
  { path: [14, 13, 20, 9, 8, 16], r: -5, w: '0.72s' },
  { path: [-12, 24, -19, 27, -6, 21], r: 6, w: '0.9s' },
  { path: [16, 35, 10, 32, 21, 37], r: -4, w: '0.66s' },
];

function chipStyle({ path, r, w }: (typeof SLOTS)[number], i: number) {
  const [x1, y1, x2, y2, x3, y3] = path;
  return {
    // Fixed row on narrow stages (see the container query in the CSS).
    '--row': `${-22 + i * 12.5}cqh`,
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
 * "Six chores → one brief" block (animation left, explanation right). Used on the home page
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
  const tp = await getTranslations('promo.funnel');
  const ts = await getTranslations('showcase');
  const who = ns === 'funnel' ? 'brand' : 'influencer';
  // What lands in the result card: influencers for a company, briefs for an influencer.
  const rows =
    who === 'brand'
      ? (['anna', 'lukas', 'marie'] as const).map((k) => ts(`offers.${k}.name`))
      : (['coffee', 'hotel', 'gym'] as const).map((k) => ts(`briefs.${k}.brand`));
  const scores = [96, 91, 87];
  // The ticking number is a CSS counter, so split the unit text around it ("14 h", "14 ч").
  const [hoursBefore = '', hoursAfter = ''] = tp('hours', { count: '§' }).split('§');
  return (
    <section aria-labelledby={`${ns.replace('.', '-')}-title`}>
      <Container py={{ base: 8, md: 12, lg: 16 }}>
        <Grid cols={{ base: 1, lg: 2 }} gap={{ base: 8, lg: 16 }} className="items-center">
          {/* Decorative: the same chores are listed as text for screen readers below. */}
          <div aria-hidden className={`${s.stage} rounded-card`}>
            {/* Timer: hours spent on chores tick up, then "now 5 min". */}
            <div className={s.timer}>
              <span className={s.timerLabel}>{tp('time')}</span>
              <span className={s.timerValue}>
                <span className={s.count}>
                  {hoursBefore}
                  <span className={s.num} />
                  {hoursAfter}
                </span>
                <span className={s.now}>{tp('now')}</span>
              </span>
            </div>

            {chores.slice(0, SLOTS.length).map(([key, icon], i) => (
              <div key={key} className={s.chip} style={chipStyle(SLOTS[i]!, i)}>
                <span className={s.wobble}>
                  <Icon name={icon} size="sm" className={s.chipIcon} />
                  {t(`chores.${key}`)}
                  <span className={s.cost} style={{ '--d': `${i * -0.23}s` } as CSSProperties}>
                    +{tp('hours', { count: HOURS[i]! })}
                  </span>
                  <span className={s.strike} />
                </span>
              </div>
            ))}

            <div className={s.burst} />

            {/* The result: one card where the chores were. */}
            <div className={s.result}>
              <div className="flex items-center gap-2 border-b border-line pb-2">
                <span className="inline-flex size-8 items-center justify-center rounded-[10px] bg-primary text-on-primary">
                  <LogoMark className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-small font-bold text-ink">{tp(`${who}.title`)}</p>
                  <p className="truncate text-[11px] text-ink-muted">{tp(`${who}.sub`)}</p>
                </div>
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {rows.map((name, i) => (
                  <li key={name} className={s.row} style={{ '--i': i } as CSSProperties}>
                    <span className={s.avatar} style={{ background: `var(--bf-chart-${i + 1})` }}>
                      {name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join('')}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-small font-bold text-ink">
                      {name}
                    </span>
                    <span className={s.score}>{scores[i]}</span>
                  </li>
                ))}
              </ul>
              <div className={s.toast}>
                <Icon name="check-circle" size="sm" />
                {tp(`${who}.toast`)}
              </div>
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
