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
import s from './ProcessFunnel.module.css';

/** Hours each chore eats (the "+3 h" tags; the timer adds them up to 14 h). */
const HOURS = [3, 2, 4, 1, 2, 2];

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
  // The ticking number is a CSS counter, so split the unit text around it ("14 h", "14 ч").
  const [hoursBefore = '', hoursAfter = ''] = tp('hours', { count: '§' }).split('§');
  return (
    <section aria-labelledby={`${ns.replace('.', '-')}-title`}>
      <Container py={{ base: 8, md: 12, lg: 16 }}>
        <Grid cols={{ base: 1, lg: 2 }} gap={{ base: 8, lg: 16 }} className="items-center">
          {/* Decorative: the same chores are listed as text for screen readers below. */}
          <div aria-hidden className={`${s.stage} rounded-card`}>
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

            {/* Chores land one by one on a pile (later ones on top). */}
            <div className={s.pile}>
              {chores.slice(0, HOURS.length).map(([key, icon], i) => (
                <div key={key} className={`${s.chip} ${s[`c${i}`]}`}>
                  <span className={s.card}>
                    <Icon name={icon} size="sm" className={s.chipIcon} />
                    {t(`chores.${key}`)}
                    <span className={s.cost}>+{tp('hours', { count: HOURS[i]! })}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className={s.reveal} />
            <div className={s.logo}>
              <LogoMark className="size-10 md:size-12" />
              <span
                lang="en"
                className="font-display text-h2 font-extrabold tracking-tight md:text-h1"
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
