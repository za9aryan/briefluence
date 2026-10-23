import type { NotificationLocale } from '@briefluence/shared';
import { Link, Section, Text } from '@react-email/components';
import { render } from '@react-email/render';
import { Cta, Layout, Paragraph } from './layout';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

async function build(subject: string, el: React.ReactElement): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
  return { subject, html, text };
}

/** Generic single-event email: every row in the Notifications table uses this template. */
export function NotificationEmail(p: {
  locale: NotificationLocale;
  title: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
}) {
  return (
    <Layout preview={p.body} title={p.title} locale={p.locale}>
      {p.body.split('\n').map((line, i) => (
        <Paragraph key={i}>{line}</Paragraph>
      ))}
      {p.ctaUrl && <Cta href={p.ctaUrl} label={p.ctaLabel ?? 'briefluence'} />}
    </Layout>
  );
}

export function DigestEmail(p: {
  locale: NotificationLocale;
  title: string;
  intro: string;
  items: { title: string; subtitle: string; url: string }[];
  ctaUrl: string;
  ctaLabel: string;
}) {
  return (
    <Layout preview={p.intro} title={p.title} locale={p.locale}>
      <Paragraph>{p.intro}</Paragraph>
      {p.items.map((item, i) => (
        <Section key={i} style={{ borderTop: '1px solid #EEE6EF', padding: '12px 0' }}>
          <Link href={item.url} style={{ color: '#241B2B', fontWeight: 600, fontSize: 15 }}>
            {item.title}
          </Link>
          <Text style={{ color: '#6B6175', fontSize: 13, margin: '4px 0 0' }}>{item.subtitle}</Text>
        </Section>
      ))}
      <Cta href={p.ctaUrl} label={p.ctaLabel} />
    </Layout>
  );
}

export const renderNotificationEmail = (
  locale: NotificationLocale,
  p: Omit<Parameters<typeof NotificationEmail>[0], 'locale'>,
) => build(p.title, <NotificationEmail locale={locale} {...p} />);

export const renderDigestEmail = (p: Parameters<typeof DigestEmail>[0]) =>
  build(p.title, <DigestEmail {...p} />);

type L3 = Record<NotificationLocale, string>;

const AUTH: Record<'verify' | 'reset', { subject: L3; body: L3; cta: L3 }> = {
  verify: {
    subject: { en: 'Confirm your email', ru: 'Подтверди email', hy: 'Հաստատիր էլ. փոստդ' },
    body: {
      en: 'Welcome to briefluence! Confirm your email address to start using your account.\nThe link is valid for 48 hours.',
      ru: 'Добро пожаловать в briefluence! Подтверди email, чтобы начать пользоваться аккаунтом.\nСсылка действует 48 часов.',
      hy: 'Բարի գալուստ briefluence։ Հաստատիր էլ. փոստդ՝ հաշիվն օգտագործելու համար։\nՀղումը գործում է 48 ժամ։',
    },
    cta: { en: 'Confirm email', ru: 'Подтвердить email', hy: 'Հաստատել էլ. փոստը' },
  },
  reset: {
    subject: { en: 'Reset your password', ru: 'Сброс пароля', hy: 'Գաղտնաբառի վերականգնում' },
    body: {
      en: 'Someone asked to reset the password of your briefluence account. If it was you, use the button below; the link is valid for 1 hour.\nIf it was not you, ignore this email.',
      ru: 'Кто-то запросил сброс пароля твоего аккаунта briefluence. Если это ты, нажми кнопку ниже — ссылка действует 1 час.\nЕсли это не ты, просто проигнорируй письмо.',
      hy: 'Ինչ-որ մեկը խնդրել է վերականգնել քո briefluence հաշվի գաղտնաբառը։ Եթե դա դու ես, սեղմիր ներքևի կոճակը. հղումը գործում է 1 ժամ։\nԵթե դա դու չես, անտեսիր այս նամակը։',
    },
    cta: { en: 'Choose a new password', ru: 'Задать новый пароль', hy: 'Ընտրել նոր գաղտնաբառ' },
  },
};

const authEmail =
  (kind: 'verify' | 'reset') =>
  (url: string, locale: NotificationLocale = 'en') => {
    const t = AUTH[kind];
    return build(
      t.subject[locale],
      <NotificationEmail
        locale={locale}
        title={t.subject[locale]}
        body={t.body[locale]}
        ctaUrl={url}
        ctaLabel={t.cta[locale]}
      />,
    );
  };
export const renderVerifyEmail = authEmail('verify');
export const renderResetPasswordEmail = authEmail('reset');

/** Daily digest texts. */
export const DIGEST = {
  bloggerTitle: {
    en: (n: number) => `${n} new brief${n === 1 ? '' : 's'} for you`,
    ru: (n: number) => `Новые брифы для тебя: ${n}`,
    hy: (n: number) => `Նոր բրիֆներ քեզ համար՝ ${n}`,
  },
  bloggerIntro: {
    en: 'Brands posted new briefs that fit your profile:',
    ru: 'Бренды опубликовали новые брифы, которые тебе подходят:',
    hy: 'Բրենդները հրապարակել են նոր բրիֆներ, որոնք համապատասխանում են քեզ։',
  },
  bloggerCta: { en: 'Open brief feed', ru: 'Открыть ленту брифов', hy: 'Բացել բրիֆների լենտը' },
  brandTitle: {
    en: (n: number) => `${n} new applicant${n === 1 ? '' : 's'} yesterday`,
    ru: (n: number) => `Новые отклики за вчера: ${n}`,
    hy: (n: number) => `Երեկվա նոր դիմորդներ՝ ${n}`,
  },
  brandIntro: {
    en: 'Bloggers applied to your briefs:',
    ru: 'Блогеры откликнулись на твои брифы:',
    hy: 'Բլոգերները դիմել են քո բրիֆներին։',
  },
  brandCta: { en: 'Review applicants', ru: 'Смотреть отклики', hy: 'Դիտել դիմորդներին' },
  match: { en: 'Match', ru: 'Совпадение', hy: 'Համընկնում' },
  barter: { en: 'barter', ru: 'бартер', hy: 'բարտեր' },
  upTo: { en: 'up to', ru: 'до', hy: 'մինչև' },
  applyBy: { en: 'apply by', ru: 'откликнуться до', hy: 'դիմել մինչև' },
} as const;
