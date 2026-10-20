// Source for the portfolio namespace (blogger settings, apply, brand view, admin review): every leaf is [en, ru, hy].
// Regenerate JSON: node scripts/write-messages.mjs messages/_src/portfolio.mjs
export default {
  portfolio: {
    settings: {
      title: ['Portfolio', 'Портфолио', 'Պորտֆոլիո'],
      lead: [
        'Show work you’ve already done. Brands see approved items on your profile, and you can attach up to {max} when you apply.',
        'Покажи работы, которые ты уже делал. Бренды видят одобренные работы в твоём профиле, а при отклике можно приложить до {max}.',
        'Ցույց տուր արդեն արած աշխատանքներդ։ Բրենդները տեսնում են հաստատվածները քո պրոֆիլում, իսկ դիմելիս կարող ես կցել մինչև {max}-ը։',
      ],
      add: ['Add work', 'Добавить работу', 'Ավելացնել աշխատանք'],
      empty: ['No work added yet', 'Работ пока нет', 'Աշխատանքներ դեռ չկան'],
      emptyLead: [
        'Add a screenshot of a story, a photo from a shoot or a Reel cover.',
        'Добавь скриншот сторис, фото со съёмки или обложку Reels.',
        'Ավելացրու սթորիի սքրինշոթ, նկարահանման լուսանկար կամ Reels-ի շապիկ։',
      ],
      limit: [
        'You’ve added the maximum of {max} items. Delete one to add another.',
        'Добавлено максимум — {max} работ. Удали одну, чтобы добавить новую.',
        'Ավելացրել ես առավելագույնը՝ {max} աշխատանք։ Ջնջիր մեկը՝ նորն ավելացնելու համար։',
      ],
      reviewNote: [
        'We check each item before brands see it. Editing an approved item sends it back to review.',
        'Мы проверяем каждую работу, прежде чем её увидят бренды. Изменённая работа снова уходит на проверку.',
        'Մենք ստուգում ենք յուրաքանչյուր աշխատանք, նախքան բրենդները կտեսնեն այն։ Փոփոխված աշխատանքը նորից ուղարկվում է ստուգման։',
      ],
      edit: ['Edit', 'Изменить', 'Խմբագրել'],
      delete: ['Delete', 'Удалить', 'Ջնջել'],
      deleteTitle: ['Delete this work?', 'Удалить эту работу?', 'Ջնջե՞լ այս աշխատանքը'],
      deleteBody: [
        'It disappears from your profile and from applications it was attached to.',
        'Она пропадёт из профиля и из откликов, к которым была приложена.',
        'Այն կանհետանա պրոֆիլիցդ և այն դիմումներից, որոնց կցված էր։',
      ],
      deleted: ['Deleted', 'Удалено', 'Ջնջված է'],
      actions: ['Actions', 'Действия', 'Գործողություններ'],
      status: {
        PENDING: ['In review', 'На проверке', 'Ստուգման մեջ'],
        APPROVED: ['Visible to brands', 'Видно брендам', 'Տեսանելի է բրենդներին'],
        REJECTED: ['Not approved', 'Не одобрено', 'Չի հաստատվել'],
      },
      rejectedReason: ['Reason: {reason}', 'Причина: {reason}', 'Պատճառը՝ {reason}'],
    },
    form: {
      titleNew: ['Add work', 'Новая работа', 'Նոր աշխատանք'],
      titleEdit: ['Edit work', 'Изменить работу', 'Խմբագրել աշխատանքը'],
      image: ['Image', 'Изображение', 'Նկար'],
      imageHint: [
        'PNG, JPEG or WebP, up to 5 MB. A story screenshot works too.',
        'PNG, JPEG или WebP, до 5 МБ. Подойдёт и скриншот сторис.',
        'PNG, JPEG կամ WebP, մինչև 5 ՄԲ։ Սթորիի սքրինշոթն էլ կհամապատասխանի։',
      ],
      imageRequired: ['Add an image', 'Добавь изображение', 'Ավելացրու նկար'],
      name: ['Title', 'Название', 'Անվանում'],
      namePlaceholder: ['Story for a coffee shop', 'Сторис для кофейни', 'Սթորի սրճարանի համար'],
      description: ['Description', 'Описание', 'Նկարագրություն'],
      descriptionPlaceholder: [
        'What you did and how it went',
        'Что ты сделал и что из этого вышло',
        'Ինչ ես արել և ինչ ստացվեց',
      ],
      link: ['Link', 'Ссылка', 'Հղում'],
      linkHint: [
        'Where to see it: a Reel, TikTok, YouTube video or a site.',
        'Где это посмотреть: Reels, TikTok, видео на YouTube или сайт.',
        'Որտեղ դիտել՝ Reels, TikTok, YouTube տեսանյութ կամ կայք։',
      ],
      saved: [
        'Saved. We’ll review it soon.',
        'Сохранено. Скоро проверим.',
        'Պահպանված է։ Շուտով կստուգենք։',
      ],
    },
    faq: {
      title: ['About your work', 'О твоей работе', 'Քո աշխատանքի մասին'],
      lead: [
        'Optional. Brands see only the questions you answer.',
        'Необязательно. Бренды видят только те вопросы, на которые ты ответил.',
        'Պարտադիր չէ։ Բրենդները տեսնում են միայն այն հարցերը, որոնց պատասխանել ես։',
      ],
      questions: {
        brandsWorked: [
          'What brands have you worked with?',
          'С какими брендами ты работал?',
          'Ո՞ր բրենդների հետ ես աշխատել։',
        ],
        audience: ['Who is your audience?', 'Кто твоя аудитория?', 'Ո՞վ է քո լսարանը։'],
        brandsWanted: [
          'What brands do you want to work with?',
          'С какими брендами хочешь работать?',
          'Ո՞ր բրենդների հետ ես ուզում աշխատել։',
        ],
      },
      placeholders: {
        brandsWorked: [
          'For example: two cafes in Yerevan, a gym, a clothing store',
          'Например: две кофейни в Ереване, фитнес-клуб, магазин одежды',
          'Օրինակ՝ երկու սրճարան Երևանում, մարզասրահ, հագուստի խանութ',
        ],
        audience: [
          'For example: women 20–30 in Yerevan who love food and travel',
          'Например: девушки 20–30 из Еревана, которые любят еду и путешествия',
          'Օրինակ՝ 20–30 տարեկան կանայք Երևանից, որ սիրում են ուտելիք և ճամփորդություն',
        ],
        brandsWanted: [
          'For example: restaurants, beauty salons, travel agencies',
          'Например: рестораны, салоны красоты, турагентства',
          'Օրինակ՝ ռեստորաններ, գեղեցկության սրահներ, տուրիստական գործակալություններ',
        ],
      },
    },
    view: {
      portfolio: ['Portfolio', 'Портфолио', 'Պորտֆոլիո'],
      faq: ['About the blogger', 'О блогере', 'Բլոգերի մասին'],
      questions: {
        brandsWorked: [
          'What brands has the blogger worked with?',
          'С какими брендами работал блогер?',
          'Ո՞ր բրենդների հետ է աշխատել բլոգերը։',
        ],
        audience: ['Who is their audience?', 'Кто аудитория блогера?', 'Ո՞վ է բլոգերի լսարանը։'],
        brandsWanted: [
          'What brands do they want to work with?',
          'С какими брендами блогер хочет работать?',
          'Ո՞ր բրենդների հետ է ուզում աշխատել բլոգերը։',
        ],
      },
      openLink: ['Open', 'Открыть', 'Բացել'],
      attached: ['Attached work', 'Приложенные работы', 'Կցված աշխատանքներ'],
      close: ['Close', 'Закрыть', 'Փակել'],
    },
    apply: {
      title: ['Attach your work', 'Приложи свои работы', 'Կցիր քո աշխատանքները'],
      hint: [
        'Pick up to {max} to show the brand. Optional.',
        'Выбери до {max}, чтобы показать бренду. Необязательно.',
        'Ընտրիր մինչև {max}-ը՝ բրենդին ցույց տալու համար։ Պարտադիր չէ։',
      ],
      none: [
        'Add work to your portfolio in Settings to show brands what you’ve done.',
        'Добавь работы в портфолио в настройках, чтобы показать брендам, что ты уже делал.',
        'Ավելացրու աշխատանքներ պորտֆոլիոյում՝ կարգավորումներում, որ բրենդները տեսնեն՝ ինչ ես արել։',
      ],
      openSettings: ['Open portfolio', 'Открыть портфолио', 'Բացել պորտֆոլիոն'],
      pendingNote: [
        'Items in review show up here once approved.',
        'Работы на проверке появятся здесь после одобрения.',
        'Ստուգման մեջ գտնվող աշխատանքները կհայտնվեն այստեղ հաստատվելուց հետո։',
      ],
    },
    admin: {
      title: ['Portfolio review', 'Проверка портфолио', 'Պորտֆոլիոյի ստուգում'],
      lead: [
        'Check each item before brands see it: the image suits brands and nothing is misleading.',
        'Проверь каждую работу, прежде чем её увидят бренды: изображение подходит брендам и ничего не вводит в заблуждение.',
        'Ստուգիր յուրաքանչյուր աշխատանք, նախքան բրենդները կտեսնեն այն՝ նկարը համապատասխանում է բրենդներին, և ոչինչ մոլորեցնող չէ։',
      ],
      tabPending: ['Waiting', 'Ожидают', 'Սպասում են'],
      tabApproved: ['Approved', 'Одобрены', 'Հաստատված'],
      tabRejected: ['Rejected', 'Отклонены', 'Մերժված'],
      empty: ['Nothing to review', 'Проверять нечего', 'Ստուգելու բան չկա'],
      updated: ['Updated {date}', 'Обновлено {date}', 'Թարմացվել է {date}'],
      openLink: ['Open link', 'Открыть ссылку', 'Բացել հղումը'],
      approve: ['Approve', 'Одобрить', 'Հաստատել'],
      reject: ['Reject', 'Отклонить', 'Մերժել'],
      rejectTitle: ['Reject this work', 'Отклонить работу', 'Մերժել աշխատանքը'],
      reason: ['Reason', 'Причина', 'Պատճառ'],
      reasonHint: [
        'The blogger sees this and can fix the item.',
        'Блогер увидит причину и сможет исправить работу.',
        'Բլոգերը կտեսնի պատճառը և կկարողանա ուղղել աշխատանքը։',
      ],
      approved: ['Approved', 'Одобрено', 'Հաստատված է'],
      rejected: ['Rejected', 'Отклонено', 'Մերժված է'],
      previousReason: ['Reason: {reason}', 'Причина: {reason}', 'Պատճառը՝ {reason}'],
    },
  },
};
