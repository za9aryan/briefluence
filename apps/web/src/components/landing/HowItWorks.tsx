'use client';
import { Avatar, Icon, LogoMark, ScoreMeter, cn, type IconName } from '@briefluence/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Tour } from './FeatureTour';
import tour from './FeatureTour.module.css';
import css from './HowItWorks.module.css';

const STEPS: [key: 'post' | 'match' | 'accept' | 'publish', icon: IconName][] = [
  ['post', 'edit'],
  ['match', 'target'],
  ['accept', 'check-circle'],
  ['publish', 'message'],
];
const ART = { post: PostArt, match: MatchArt, accept: AcceptArt, publish: PublishArt };

/** Home page "How it works": the four steps as a tour with a small scene for each. */
export function HowItWorks() {
  const t = useTranslations('landing.how');
  return (
    <Tour
      id="how"
      eyebrow={t('eyebrow')}
      title={t('title')}
      lead={t('lead')}
      items={STEPS.map(([k, icon]) => {
        const Art = ART[k];
        return {
          key: k,
          icon,
          title: t(`steps.${k}.title`),
          body: t(`steps.${k}.body`),
          art: <Art />,
        };
      })}
    />
  );
}

/* ---------- Scenes (made-up sample data) ---------- */

/** 1. A brief form: targeting chips fill in one by one, then "Publish" turns into "Published". */
function PostArt() {
  const t = useTranslations('promo.how.post');
  const tp = useTranslations('enums.paymentType');
  const chips: [IconName, string][] = [
    ['pin', t('city')],
    ['users', t('audience')],
    ['cake', t('age')],
    ['wallet', tp('MONEY')],
  ];
  return (
    <div className={cn(tour.card, 'w-full max-w-md p-4 sm:p-6')}>
      <div className="flex items-center gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-[10px] bg-primary text-on-primary">
          <LogoMark className="size-4" />
        </span>
        <p className="text-small font-bold text-ink-muted">{t('form')}</p>
      </div>
      <p className={cn(css.typed, 'mt-4 text-h2 font-bold text-ink')}>{t('title')}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map(([icon, label], i) => (
          <span
            key={label}
            className={cn(
              css.pop,
              'inline-flex items-center gap-1 rounded-pill bg-primary-soft px-3 py-1.5 text-small font-bold text-primary-text',
            )}
            style={{ animationDelay: `${500 + i * 280}ms` }}
          >
            <Icon name={icon} size="xs" />
            {label}
          </span>
        ))}
        <span
          className={cn(
            css.pop,
            'inline-flex items-center gap-1 rounded-pill bg-sun px-3 py-1.5 text-small font-bold text-ink',
          )}
          style={{ animationDelay: `${500 + chips.length * 280}ms` }}
        >
          <Icon name="gift" size="xs" />
          {tp('BARTER')}
        </span>
      </div>
      <div className={cn(css.publish, 'mt-6')}>
        <span className={css.publishIdle}>{t('publish')}</span>
        <span className={css.publishDone}>
          <Icon name="check-circle" size="sm" />
          {t('published')}
        </span>
      </div>
    </div>
  );
}

/** 2. A brief from the feed with its match score, and the pitch typing itself out. */
function MatchArt() {
  const ts = useTranslations('showcase.briefs');
  const t = useTranslations('promo.how.match');
  const td = useTranslations('deals');
  const typed = useTyping(t('pitch'), 900);
  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <div className={cn(tour.card, tour.rise, 'flex items-center gap-4 p-2 pr-4')}>
        <span
          className="size-16 shrink-0 rounded-[12px] bg-cover bg-center"
          style={{ backgroundImage: 'url(/showcase/coffee.webp)' }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{ts('coffee.title')}</p>
          <p className="truncate text-small text-ink-muted">{ts('coffee.brand')}</p>
        </div>
        <span className={css.score}>
          <ScoreMeter value={92} label={td('match')} />
        </span>
      </div>
      <div className={cn(tour.card, tour.rise, 'p-4')} style={{ animationDelay: '250ms' }}>
        <p className="text-label uppercase text-ink-muted">{t('pitchLabel')}</p>
        <p className="mt-1 min-h-[4.5em] text-small text-ink">
          {typed}
          <span className={css.caret} />
        </p>
        <div className="mt-2 flex justify-end">
          <span className={cn(css.apply, typed.length === t('pitch').length && css.applyReady)}>
            {t('apply')}
            <Icon name="send" size="xs" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** 3. Company and influencer meet: an "Accepted" stamp, then both contacts unlock. */
function AcceptArt() {
  const t = useTranslations('promo.how.accept');
  const tb = useTranslations('promo');
  const ta = useTranslations('promo.analytics.card');
  const side = (who: 'brand' | 'you') => (
    <div
      className={cn(
        tour.card,
        css.side,
        'flex min-w-0 flex-1 flex-col items-center gap-2 p-4 text-center',
      )}
    >
      {who === 'brand' ? (
        <span className="inline-flex size-14 items-center justify-center rounded-card bg-primary text-on-primary">
          <LogoMark className="size-6" />
        </span>
      ) : (
        <Avatar name={ta('name')} size="lg" />
      )}
      <p className="w-full truncate text-small font-bold text-ink">
        {who === 'brand' ? tb('briefs.coffee.brand') : t('you')}
      </p>
      <span className={css.contact}>
        <Icon name="lock" size="xs" className={css.lockIcon} />
        <Icon name="telegram" size="xs" className={css.tgIcon} />
        <span className="truncate">{who === 'brand' ? '@nordic_roast' : '@anna.eats'}</span>
      </span>
    </div>
  );
  return (
    <div className="relative flex w-full max-w-md flex-col items-center gap-4 pt-4">
      <div className="flex w-full items-stretch gap-4">
        {side('brand')}
        <span className={css.link}>
          <Icon name="repeat" size="sm" />
        </span>
        {side('you')}
      </div>
      <span className={css.stamp}>{t('accepted')}</span>
      <p className={cn(css.swap, 'text-small font-bold text-success')}>
        <Icon name="check-circle" size="xs" className="mr-1 inline" />
        {t('swap')}
      </p>
    </div>
  );
}

/** 4. A short chat to agree on the details, then "Collab done". */
function PublishArt() {
  const t = useTranslations('promo.how.publish');
  const msgs: ['brand' | 'you', string][] = [
    ['brand', t('m1')],
    ['you', t('m2')],
    ['brand', t('m3')],
  ];
  return (
    <div className={cn(tour.card, 'flex w-full max-w-md flex-col gap-2 p-4')}>
      {msgs.map(([who, text], i) => (
        <div
          key={text}
          className={cn(css.bubble, who === 'you' ? css.mine : css.theirs)}
          style={{ animationDelay: `${300 + i * 650}ms` }}
        >
          {text}
        </div>
      ))}
      <div className="mt-2 flex justify-center">
        <span className={css.done} style={{ animationDelay: `${300 + msgs.length * 650}ms` }}>
          <Icon name="check-circle" size="sm" />
          {t('done')}
        </span>
      </div>
    </div>
  );
}

/** Types `text` out after `delay` ms (all at once with reduced motion). */
function useTyping(text: string, delay: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(text.length);
      return;
    }
    let id: number | undefined;
    const start = window.setTimeout(() => {
      id = window.setInterval(() => {
        setN((v) => {
          if (v >= text.length) {
            window.clearInterval(id);
            return v;
          }
          return v + 1;
        });
      }, 28);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, [text, delay]);
  return text.slice(0, n);
}
