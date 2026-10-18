import { TIMEZONE } from './constants';
import type { Currency, NotificationType, RejectionReason } from './enums';
import { formatMoney } from './money';

/**
 * Notification texts in all UI languages. The API stores a notification as `type` + `params`
 * (raw values: titles, minor-unit amounts, ISO dates) and renders it in the reader's language —
 * for emails on the server, for the bell / list in the browser. Voice: informal (ru «ты», hy «դու»).
 */
export const NOTIFICATION_LOCALES = ['en', 'ru', 'hy'] as const;
export type NotificationLocale = (typeof NOTIFICATION_LOCALES)[number];

export type NotificationParams = Record<string, string | number | null | undefined>;

export interface RenderedNotification {
  title: string;
  body: string;
  /** Button label for emails. */
  cta: string;
}

const INTL: Record<NotificationLocale, string> = { en: 'en-GB', ru: 'ru-RU', hy: 'hy-AM' };

export function isNotificationLocale(v: unknown): v is NotificationLocale {
  return typeof v === 'string' && (NOTIFICATION_LOCALES as readonly string[]).includes(v);
}

type L3 = Record<NotificationLocale, string>;

const REASONS: Record<RejectionReason, L3> = {
  BUDGET: { en: 'the budget did not fit', ru: 'не подошёл бюджет', hy: 'բյուջեն չհամապատասխանեց' },
  AUDIENCE: {
    en: 'the audience was not the right fit',
    ru: 'не подошла аудитория',
    hy: 'լսարանը չհամապատասխանեց',
  },
  NICHE: {
    en: 'the niche was not the right fit',
    ru: 'не подошла ниша',
    hy: 'նիշան չհամապատասխանեց',
  },
  OTHER: {
    en: 'the brand chose other bloggers',
    ru: 'бренд выбрал других блогеров',
    hy: 'բրենդն ընտրեց այլ բլոգերների',
  },
};

const PLATFORMS: Record<string, L3> = {
  INSTAGRAM: { en: 'Instagram', ru: 'Instagram', hy: 'Instagram' },
  TIKTOK: { en: 'TikTok', ru: 'TikTok', hy: 'TikTok' },
  YOUTUBE: { en: 'YouTube', ru: 'YouTube', hy: 'YouTube' },
};

function helpers(locale: NotificationLocale) {
  const plural = new Intl.PluralRules(INTL[locale]);
  return {
    money: (minor: unknown, currency: unknown) =>
      typeof minor === 'number' && typeof currency === 'string'
        ? formatMoney(minor, currency as Currency, INTL[locale])
        : '',
    date: (iso: unknown) =>
      typeof iso === 'string'
        ? new Intl.DateTimeFormat(INTL[locale], {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: TIMEZONE,
          }).format(new Date(iso))
        : '',
    /** Picks a form by CLDR plural category; `forms` keys: one, few, many, other. */
    plural: (n: number, forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }) =>
      (forms[plural.select(n)] ?? forms.other).replace('#', String(n)),
  };
}

type Renderer = (
  p: NotificationParams,
  h: ReturnType<typeof helpers>,
  locale: NotificationLocale,
) => Omit<RenderedNotification, 'cta'>;

const s = (v: unknown) => (v == null ? '' : String(v));

const CATALOG: Record<NotificationType, { cta: L3; render: Record<NotificationLocale, Renderer> }> =
  {
    VERIFICATION_PENDING: {
      cta: { en: 'Open review queue', ru: 'Открыть очередь проверки', hy: 'Բացել ստուգման հերթը' },
      render: {
        en: (p) => ({
          title: 'New blogger waiting for review',
          body: `${s(p.name)} sent their profile for verification.`,
        }),
        ru: (p) => ({
          title: 'Новый блогер ждёт проверки',
          body: `${s(p.name)} отправил(а) профиль на проверку.`,
        }),
        hy: (p) => ({
          title: 'Նոր բլոգերը սպասում է ստուգման',
          body: `${s(p.name)}-ը ուղարկել է պրոֆիլը ստուգման։`,
        }),
      },
    },
    VERIFICATION_APPROVED: {
      cta: { en: 'Browse briefs', ru: 'Смотреть брифы', hy: 'Դիտել բրիֆները' },
      render: {
        en: () => ({
          title: 'You are verified',
          body: 'Your profile is approved. Brands now see your Verified badge, and your brief feed is open.',
        }),
        ru: () => ({
          title: 'Ты проверен',
          body: 'Профиль одобрен. Бренды видят значок «Проверен», а лента брифов открыта.',
        }),
        hy: () => ({
          title: 'Դու ստուգված ես',
          body: 'Պրոֆիլը հաստատված է։ Բրենդները տեսնում են «Ստուգված» նշանը, իսկ բրիֆների լենտը բաց է։',
        }),
      },
    },
    VERIFICATION_REJECTED: {
      cta: { en: 'Update your profile', ru: 'Обновить профиль', hy: 'Թարմացնել պրոֆիլը' },
      render: {
        en: (p) => ({
          title: 'Your profile needs changes',
          body: `Reason: ${s(p.reason)}\nFix it and send your profile again.`,
        }),
        ru: (p) => ({
          title: 'Профиль нужно доработать',
          body: `Причина: ${s(p.reason)}\nИсправь и отправь профиль снова.`,
        }),
        hy: (p) => ({
          title: 'Պրոֆիլը պետք է լրամշակել',
          body: `Պատճառը՝ ${s(p.reason)}\nՈւղղիր և կրկին ուղարկիր պրոֆիլը։`,
        }),
      },
    },
    NEW_MATCHING_DEALS: {
      cta: { en: 'Open brief feed', ru: 'Открыть ленту брифов', hy: 'Բացել բրիֆների լենտը' },
      render: {
        en: (p, h) => ({
          title: h.plural(Number(p.count), {
            one: '# new brief matches you',
            other: '# new briefs match you',
          }),
          body: s(p.list),
        }),
        ru: (p, h) => ({
          title: h.plural(Number(p.count), {
            one: 'Тебе подходит # новый бриф',
            few: 'Тебе подходят # новых брифа',
            many: 'Тебе подходят # новых брифов',
            other: 'Тебе подходят # новых брифа',
          }),
          body: s(p.list),
        }),
        hy: (p, h) => ({
          title: h.plural(Number(p.count), {
            one: '# նոր բրիֆ համապատասխանում է քեզ',
            other: '# նոր բրիֆ համապատասխանում է քեզ',
          }),
          body: s(p.list),
        }),
      },
    },
    NEW_APPLICANT: {
      cta: { en: 'Review applicants', ru: 'Смотреть отклики', hy: 'Դիտել դիմորդներին' },
      render: {
        en: (p) => ({
          title: 'New applicant',
          body: `${s(p.name)} applied to "${s(p.deal)}" (match ${s(p.score)}%).`,
        }),
        ru: (p) => ({
          title: 'Новый отклик',
          body: `${s(p.name)} откликнулся на «${s(p.deal)}» (совпадение ${s(p.score)}%).`,
        }),
        hy: (p) => ({
          title: 'Նոր դիմորդ',
          body: `${s(p.name)}-ը դիմել է «${s(p.deal)}» բրիֆին (համընկնում ${s(p.score)}%)։`,
        }),
      },
    },
    APPLICATION_VIEWED: {
      cta: { en: 'My applications', ru: 'Мои заявки', hy: 'Իմ հայտերը' },
      render: {
        en: (p) => ({
          title: 'Your application was viewed',
          body: `The brand viewed your application to "${s(p.deal)}".`,
        }),
        ru: (p) => ({
          title: 'Твою заявку посмотрели',
          body: `Бренд посмотрел твою заявку на «${s(p.deal)}».`,
        }),
        hy: (p) => ({
          title: 'Քո հայտը դիտվել է',
          body: `Բրենդը դիտել է քո հայտը «${s(p.deal)}» բրիֆին։`,
        }),
      },
    },
    APPLICATION_SHORTLISTED: {
      cta: { en: 'My applications', ru: 'Мои заявки', hy: 'Իմ հայտերը' },
      render: {
        en: (p) => ({
          title: 'You were shortlisted',
          body: `You are on the shortlist for "${s(p.deal)}".`,
        }),
        ru: (p) => ({ title: 'Ты в шорт-листе', body: `Ты в шорт-листе брифа «${s(p.deal)}».` }),
        hy: (p) => ({
          title: 'Դու ընտրվածների մեջ ես',
          body: `Դու «${s(p.deal)}» բրիֆի ընտրվածների ցուցակում ես։`,
        }),
      },
    },
    APPLICATION_ACCEPTED: {
      cta: { en: 'See contacts', ru: 'Смотреть контакты', hy: 'Տեսնել կոնտակտները' },
      render: {
        en: (p) => ({
          title: 'Your application is approved',
          body: `The brand accepted you for "${s(p.deal)}". Their contacts are now in My applications.`,
        }),
        ru: (p) => ({
          title: 'Твоя заявка одобрена',
          body: `Бренд принял тебя в «${s(p.deal)}». Его контакты теперь в разделе «Мои заявки».`,
        }),
        hy: (p) => ({
          title: 'Քո հայտը հաստատված է',
          body: `Բրենդն ընդունել է քեզ «${s(p.deal)}» բրիֆում։ Նրա կոնտակտներն այժմ «Իմ հայտերը» բաժնում են։`,
        }),
      },
    },
    APPLICATION_REJECTED: {
      cta: { en: 'Find other briefs', ru: 'Найти другие брифы', hy: 'Գտնել այլ բրիֆներ' },
      render: {
        en: (p) => ({
          title: 'Not this time',
          body: `Your application to "${s(p.deal)}" was not selected: ${REASONS[(p.reason as RejectionReason) ?? 'OTHER']?.en ?? REASONS.OTHER.en}.`,
        }),
        ru: (p) => ({
          title: 'В этот раз нет',
          body: `Заявку на «${s(p.deal)}» не выбрали: ${REASONS[(p.reason as RejectionReason) ?? 'OTHER']?.ru ?? REASONS.OTHER.ru}.`,
        }),
        hy: (p) => ({
          title: 'Այս անգամ՝ ոչ',
          body: `«${s(p.deal)}» բրիֆի հայտը չի ընտրվել․ ${REASONS[(p.reason as RejectionReason) ?? 'OTHER']?.hy ?? REASONS.OTHER.hy}։`,
        }),
      },
    },
    APPLICATION_COMPLETED: {
      cta: { en: 'My applications', ru: 'Мои заявки', hy: 'Իմ հայտերը' },
      render: {
        en: (p) => ({
          title: 'Collab completed',
          body: `The brand confirmed your work on "${s(p.deal)}". Great job!`,
        }),
        ru: (p) => ({
          title: 'Коллаб выполнен',
          body: `Бренд подтвердил твою работу по «${s(p.deal)}». Отличная работа!`,
        }),
        hy: (p) => ({
          title: 'Համագործակցությունն ավարտված է',
          body: `Բրենդը հաստատել է քո աշխատանքը «${s(p.deal)}» բրիֆում։ Հիանալի է։`,
        }),
      },
    },
    POST_SUBMITTED: {
      cta: { en: 'Review the post', ru: 'Посмотреть пост', hy: 'Դիտել հրապարակումը' },
      render: {
        en: (p) => ({
          title: 'Content published',
          body: `${s(p.name)} published the content for "${s(p.deal)}". Check it and mark the collab done.`,
        }),
        ru: (p) => ({
          title: 'Контент опубликован',
          body: `${s(p.name)} опубликовал(а) контент для «${s(p.deal)}». Проверь и отметь коллаб выполненным.`,
        }),
        hy: (p) => ({
          title: 'Բովանդակությունը հրապարակված է',
          body: `${s(p.name)}-ը հրապարակել է «${s(p.deal)}» բրիֆի բովանդակությունը։ Ստուգիր և նշիր կատարված։`,
        }),
      },
    },
    DEAL_FILLED: {
      cta: { en: 'Open brief', ru: 'Открыть бриф', hy: 'Բացել բրիֆը' },
      render: {
        en: (p, h) => ({
          title: 'Brief filled',
          body: `"${s(p.deal)}" reached ${h.plural(Number(p.slots), { one: '# place', other: '# places' })} and was closed automatically.`,
        }),
        ru: (p, h) => ({
          title: 'Бриф заполнен',
          body: `«${s(p.deal)}»: заняты все ${h.plural(Number(p.slots), { one: '# место', few: '# места', many: '# мест', other: '# места' })}, бриф закрыт автоматически.`,
        }),
        hy: (p) => ({
          title: 'Բրիֆը լրացված է',
          body: `«${s(p.deal)}» բրիֆի բոլոր ${s(p.slots)} տեղերը զբաղված են, և այն ավտոմատ փակվել է։`,
        }),
      },
    },
    DEAL_REVIEW_PENDING: {
      cta: { en: 'Open review queue', ru: 'Открыть очередь проверки', hy: 'Բացել ստուգման հերթը' },
      render: {
        en: (p) => ({
          title: 'New brief waiting for review',
          body: `${s(p.brand)}: "${s(p.deal)}"`,
        }),
        ru: (p) => ({ title: 'Новый бриф ждёт проверки', body: `${s(p.brand)}: «${s(p.deal)}»` }),
        hy: (p) => ({
          title: 'Նոր բրիֆը սպասում է ստուգման',
          body: `${s(p.brand)}՝ «${s(p.deal)}»`,
        }),
      },
    },
    DEAL_APPROVED: {
      cta: { en: 'Open brief', ru: 'Открыть бриф', hy: 'Բացել բրիֆը' },
      render: {
        en: (p) => ({
          title: 'Your brief is live',
          body: `"${s(p.deal)}" passed the check. Matching bloggers can see it and apply.`,
        }),
        ru: (p) => ({
          title: 'Бриф опубликован',
          body: `«${s(p.deal)}» прошёл проверку. Подходящие блогеры уже видят его и могут откликнуться.`,
        }),
        hy: (p) => ({
          title: 'Բրիֆը հրապարակված է',
          body: `«${s(p.deal)}»-ն անցավ ստուգումը։ Համապատասխան բլոգերներն արդեն տեսնում են այն և կարող են դիմել։`,
        }),
      },
    },
    DEAL_REJECTED: {
      cta: { en: 'Edit brief', ru: 'Изменить бриф', hy: 'Խմբագրել բրիֆը' },
      render: {
        en: (p) => ({
          title: 'Your brief needs changes',
          body: `"${s(p.deal)}"\nReason: ${s(p.reason)}\nFix it and send it again.`,
        }),
        ru: (p) => ({
          title: 'Бриф нужно доработать',
          body: `«${s(p.deal)}»\nПричина: ${s(p.reason)}\nИсправь и отправь снова.`,
        }),
        hy: (p) => ({
          title: 'Բրիֆը պետք է լրամշակել',
          body: `«${s(p.deal)}»\nՊատճառը՝ ${s(p.reason)}\nՈւղղիր և կրկին ուղարկիր։`,
        }),
      },
    },
    DEAL_EXPIRED: {
      cta: { en: 'Open brief', ru: 'Открыть бриф', hy: 'Բացել բրիֆը' },
      render: {
        en: (p) => ({
          title: 'Brief expired',
          body: `"${s(p.deal)}" passed its application deadline and no longer takes applications.`,
        }),
        ru: (p) => ({
          title: 'Бриф истёк',
          body: `У «${s(p.deal)}» прошёл дедлайн, заявки больше не принимаются.`,
        }),
        hy: (p) => ({
          title: 'Բրիֆի ժամկետն անցել է',
          body: `«${s(p.deal)}» բրիֆի վերջնաժամկետն անցել է, հայտեր այլևս չեն ընդունվում։`,
        }),
      },
    },
    TRIAL_ENDING: {
      cta: { en: 'Choose Pro', ru: 'Выбрать Pro', hy: 'Ընտրել Pro' },
      render: {
        en: (p, h) => ({
          title: `Your free Pro days end in ${h.plural(Number(p.days), { one: '# day', other: '# days' })}`,
          body: `After ${h.date(p.date)} you move to the free Basic plan. Choose Pro for ${h.money(p.amount, p.currency)}/month to keep unlimited applications.`,
        }),
        ru: (p, h) => ({
          title: `Бесплатные дни Pro закончатся через ${h.plural(Number(p.days), { one: '# день', few: '# дня', many: '# дней', other: '# дня' })}`,
          body: `После ${h.date(p.date)} ты перейдёшь на бесплатный тариф Basic. Выбери Pro за ${h.money(p.amount, p.currency)} в месяц, чтобы откликаться без ограничений.`,
        }),
        hy: (p, h) => ({
          title: `Pro-ի անվճար օրերն ավարտվում են ${s(p.days)} օրից`,
          body: `${h.date(p.date)}-ից հետո կանցնես անվճար Basic փաթեթին։ Ընտրիր Pro ամսական ${h.money(p.amount, p.currency)}-ով՝ առանց սահմանափակման դիմելու համար։`,
        }),
      },
    },
    PAYMENT_SUCCEEDED: {
      cta: { en: 'View billing', ru: 'Открыть оплату', hy: 'Բացել վճարումը' },
      render: {
        en: (p, h) => ({
          title: 'Payment received',
          body: `We charged ${h.money(p.amount, p.currency)}. Your plan is active until ${h.date(p.until)}.`,
        }),
        ru: (p, h) => ({
          title: 'Оплата прошла',
          body: `Списано ${h.money(p.amount, p.currency)}. Подписка активна до ${h.date(p.until)}.`,
        }),
        hy: (p, h) => ({
          title: 'Վճարումն ստացվել է',
          body: `Գանձվել է ${h.money(p.amount, p.currency)}։ Բաժանորդագրությունն ակտիվ է մինչև ${h.date(p.until)}։`,
        }),
      },
    },
    PAYMENT_FAILED: {
      cta: { en: 'Update card', ru: 'Обновить карту', hy: 'Թարմացնել քարտը' },
      render: {
        en: (p, h) => ({
          title: 'Payment failed',
          body: p.retry
            ? `We could not charge ${h.money(p.amount, p.currency)}. We will try again on ${h.date(p.retry)}, or you can pay now with another card.`
            : `Your payment of ${h.money(p.amount, p.currency)} did not go through. Please try again.`,
        }),
        ru: (p, h) => ({
          title: 'Платёж не прошёл',
          body: p.retry
            ? `Не получилось списать ${h.money(p.amount, p.currency)}. Попробуем снова ${h.date(p.retry)}, или оплати сейчас другой картой.`
            : `Платёж на ${h.money(p.amount, p.currency)} не прошёл. Попробуй ещё раз.`,
        }),
        hy: (p, h) => ({
          title: 'Վճարումը չանցավ',
          body: p.retry
            ? `Չհաջողվեց գանձել ${h.money(p.amount, p.currency)}։ Կրկին կփորձենք ${h.date(p.retry)}, կամ վճարիր հիմա այլ քարտով։`
            : `${h.money(p.amount, p.currency)} վճարումը չանցավ։ Փորձիր կրկին։`,
        }),
      },
    },
    SUBSCRIPTION_EXPIRED: {
      cta: { en: 'Choose Pro', ru: 'Выбрать Pro', hy: 'Ընտրել Pro' },
      render: {
        en: (p, h) => ({
          title: p.reason === 'trial' ? 'Your free Pro days have ended' : 'Your Pro plan has ended',
          body: `${p.reason === 'retries' ? 'We could not charge your card after several tries. ' : ''}You are on the free Basic plan now: ${s(p.limit)} applications per 30 days. Choose Pro for ${h.money(p.amount, p.currency)}/month for unlimited applications.`,
        }),
        ru: (p, h) => ({
          title: p.reason === 'trial' ? 'Бесплатные дни Pro закончились' : 'Тариф Pro закончился',
          body: `${p.reason === 'retries' ? 'Не получилось списать оплату после нескольких попыток. ' : ''}Теперь у тебя бесплатный тариф Basic: ${s(p.limit)} откликов за 30 дней. Выбери Pro за ${h.money(p.amount, p.currency)} в месяц — откликайся без ограничений.`,
        }),
        hy: (p, h) => ({
          title: p.reason === 'trial' ? 'Pro-ի անվճար օրերն ավարտվել են' : 'Pro փաթեթն ավարտվել է',
          body: `${p.reason === 'retries' ? 'Մի քանի փորձից հետո չհաջողվեց գանձել քարտից։ ' : ''}Այժմ դու անվճար Basic փաթեթում ես՝ ${s(p.limit)} դիմում 30 օրում։ Ընտրիր Pro ամսական ${h.money(p.amount, p.currency)}-ով՝ առանց սահմանափակման դիմելու համար։`,
        }),
      },
    },
    SOCIAL_TOKEN_REVOKED: {
      cta: { en: 'Reconnect account', ru: 'Переподключить аккаунт', hy: 'Վերամիացնել հաշիվը' },
      render: {
        en: (p) => ({
          title: 'Reconnect your account',
          body: `We lost access to your ${PLATFORMS[s(p.platform)]?.en ?? s(p.platform)} account @${s(p.username)}. Reconnect it so brands see up-to-date stats.`,
        }),
        ru: (p) => ({
          title: 'Переподключи аккаунт',
          body: `Мы потеряли доступ к аккаунту ${PLATFORMS[s(p.platform)]?.ru ?? s(p.platform)} @${s(p.username)}. Подключи его снова, чтобы бренды видели свежую статистику.`,
        }),
        hy: (p) => ({
          title: 'Վերամիացրու հաշիվդ',
          body: `Մենք կորցրել ենք մուտքը ${PLATFORMS[s(p.platform)]?.hy ?? s(p.platform)} @${s(p.username)} հաշվին։ Կրկին միացրու այն, որ բրենդները տեսնեն թարմ վիճակագրությունը։`,
        }),
      },
    },
    SOCIAL_ACCOUNT_PENDING: {
      cta: { en: 'Open review queue', ru: 'Открыть очередь проверки', hy: 'Բացել ստուգման հերթը' },
      render: {
        en: (p) => ({
          title: 'New account waiting for review',
          body: `${s(p.name)} added ${PLATFORMS[s(p.platform)]?.en ?? s(p.platform)} @${s(p.username)}.`,
        }),
        ru: (p) => ({
          title: 'Новый аккаунт ждёт проверки',
          body: `${s(p.name)} добавил(а) ${PLATFORMS[s(p.platform)]?.ru ?? s(p.platform)} @${s(p.username)}.`,
        }),
        hy: (p) => ({
          title: 'Նոր հաշիվը սպասում է ստուգման',
          body: `${s(p.name)}-ը ավելացրել է ${PLATFORMS[s(p.platform)]?.hy ?? s(p.platform)} @${s(p.username)}։`,
        }),
      },
    },
    SOCIAL_ACCOUNT_APPROVED: {
      cta: { en: 'Find briefs', ru: 'Найти брифы', hy: 'Գտնել բրիֆներ' },
      render: {
        en: (p) => ({
          title: 'Account approved',
          body: `${PLATFORMS[s(p.platform)]?.en ?? s(p.platform)} @${s(p.username)} passed the check. You can apply with it now.`,
        }),
        ru: (p) => ({
          title: 'Аккаунт одобрен',
          body: `${PLATFORMS[s(p.platform)]?.ru ?? s(p.platform)} @${s(p.username)} прошёл проверку. Теперь с ним можно откликаться.`,
        }),
        hy: (p) => ({
          title: 'Հաշիվը հաստատված է',
          body: `${PLATFORMS[s(p.platform)]?.hy ?? s(p.platform)} @${s(p.username)}-ն անցավ ստուգումը։ Այժմ կարող ես դրանով դիմել։`,
        }),
      },
    },
    SOCIAL_ACCOUNT_REUSED: {
      cta: { en: 'Check the account', ru: 'Проверить аккаунт', hy: 'Ստուգել հաշիվը' },
      render: {
        en: (p) => ({
          title: 'Possible re-registration',
          body: `${PLATFORMS[s(p.platform)]?.en ?? s(p.platform)} @${s(p.username)} was linked to another user before. Now added by ${s(p.name)}.`,
        }),
        ru: (p) => ({
          title: 'Возможна повторная регистрация',
          body: `${PLATFORMS[s(p.platform)]?.ru ?? s(p.platform)} @${s(p.username)} раньше был привязан к другому пользователю. Сейчас его добавил(а) ${s(p.name)}.`,
        }),
        hy: (p) => ({
          title: 'Հնարավոր կրկնակի գրանցում',
          body: `${PLATFORMS[s(p.platform)]?.hy ?? s(p.platform)} @${s(p.username)}-ն նախկինում կապված է եղել այլ օգտատիրոջ։ Այժմ ավելացրել է ${s(p.name)}-ը։`,
        }),
      },
    },
    SOCIAL_ACCOUNT_REJECTED: {
      cta: { en: 'Open verification', ru: 'Открыть верификацию', hy: 'Բացել ստուգումը' },
      render: {
        en: (p) => ({
          title: 'Account not approved',
          body: `${PLATFORMS[s(p.platform)]?.en ?? s(p.platform)} @${s(p.username)}\nReason: ${s(p.reason)}`,
        }),
        ru: (p) => ({
          title: 'Аккаунт не одобрен',
          body: `${PLATFORMS[s(p.platform)]?.ru ?? s(p.platform)} @${s(p.username)}\nПричина: ${s(p.reason)}`,
        }),
        hy: (p) => ({
          title: 'Հաշիվը չի հաստատվել',
          body: `${PLATFORMS[s(p.platform)]?.hy ?? s(p.platform)} @${s(p.username)}\nՊատճառը՝ ${s(p.reason)}`,
        }),
      },
    },
  };

/** Renders a notification in a language; unknown types return null (callers fall back to stored text). */
export function renderNotification(
  type: string,
  params: NotificationParams | null | undefined,
  locale: NotificationLocale,
): RenderedNotification | null {
  const entry = CATALOG[type as NotificationType];
  if (!entry) return null;
  const loc = isNotificationLocale(locale) ? locale : 'en';
  return { ...entry.render[loc](params ?? {}, helpers(loc), loc), cta: entry.cta[loc] };
}
