// Marketing blocks on /for-brands (influencer analytics) and /for-influencers (toolkit), with
// made-up sample data. Every leaf is [en, ru, hy].
export default {
  promo: {
    sample: ['Example', 'Пример', 'Օրինակ'],
    briefs: {
      hotel: {
        brand: ['Alpenhof Guest House', 'Гестхаус «Альпенхоф»', 'Alpenhof հյուրատուն'],
      },
      coffee: { brand: ['Nordic Roast', 'Nordic Roast', 'Nordic Roast'] },
    },
    funnel: {
      time: ['Time on chores', 'Время на рутину', 'Ժամանակ առօրյա գործերի վրա'],
      hours: ['{count} h', '{count} ч', '{count} ժ'],
      now: ['now 5 min', 'теперь 5 мин', 'հիմա 5 րոպե'],
    },
    insights: {
      eyebrow: ['Search insights', 'Аналитика поиска', 'Որոնումների վերլուծություն'],
      title: [
        'See what influencers are looking for',
        'Смотри, что ищут инфлюенсеры',
        'Տես, թե ինչ են փնտրում ինֆլյուենսերները',
      ],
      lead: [
        'We count what verified influencers search for and which briefs they open. You see the trends and shape your next brief around them.',
        'Мы считаем, что ищут проверенные инфлюенсеры и какие брифы они открывают. Ты видишь тренды и строишь следующий бриф под них.',
        'Մենք հաշվում ենք, թե ինչ են փնտրում ստուգված ինֆլյուենսերները և որ բրիֆներն են բացում։ Դու տեսնում ես միտումները և դրանց հիման վրա կազմում հաջորդ բրիֆը։',
      ],
      points: {
        wants: [
          'Which niches, formats and platforms are in demand right now',
          'Какие ниши, форматы и платформы сейчас в спросе',
          'Որ նիշաները, ձևաչափերը և հարթակներն են հիմա պահանջված',
        ],
        money: [
          'Money or barter, and the budgets influencers look for',
          'Деньги или бартер и какие бюджеты ищут инфлюенсеры',
          'Գումար, թե բարտեր, և ինչ բյուջեներ են փնտրում ինֆլյուենսերները',
        ],
        cities: [
          'Where they want to collaborate, day by day',
          'Где они хотят сотрудничать, день за днём',
          'Որտեղ են ուզում համագործակցել՝ օր առ օր',
        ],
      },
      privacy: [
        'Anonymous totals only. No one’s personal data.',
        'Только анонимные итоги, без чьих-либо личных данных.',
        'Միայն անանուն ընդհանուր թվեր՝ առանց որևէ մեկի անձնական տվյալների։',
      ],
      searches: ['Searches', 'Поиски', 'Որոնումներ'],
      opens: ['Brief opens', 'Открытия брифов', 'Բրիֆների բացումներ'],
      mostWanted: [
        'Most wanted: {format}',
        'Чаще всего ищут: {format}',
        'Ամենաշատ փնտրվողը՝ {format}',
      ],
    },
    analytics: {
      eyebrow: [
        'Influencer analytics',
        'Аналитика инфлюенсеров',
        'Ինֆլյուենսերների վերլուծություն',
      ],
      title: [
        'Know who you’re working with before you say yes',
        'Знай, с кем работаешь, ещё до того, как скажешь «да»',
        'Իմացիր, ում հետ ես աշխատում, նախքան «այո» ասելը',
      ],
      lead: [
        'Every applicant comes with numbers pulled straight from Instagram, TikTok or YouTube. No screenshots, no guessing.',
        'К каждому отклику прилагаются цифры прямо из Instagram, TikTok или YouTube. Без скриншотов и догадок.',
        'Յուրաքանչյուր դիմումի հետ ստանում ես թվեր անմիջապես Instagram-ից, TikTok-ից կամ YouTube-ից։ Առանց սքրինշոթերի և ենթադրությունների։',
      ],
      points: {
        official: [
          'Followers, views and engagement from the platform’s official API',
          'Подписчики, просмотры и вовлечённость из официального API платформы',
          'Հետևորդներ, դիտումներ և ներգրավվածություն՝ հարթակի պաշտոնական API-ից',
        ],
        audience: [
          'Who the audience is: age, gender and countries',
          'Кто аудитория: возраст, пол и страны',
          'Ով է լսարանը՝ տարիք, սեռ և երկրներ',
        ],
        match: [
          'A match score that shows how well each influencer fits your brief',
          'Оценка совпадения: насколько каждый инфлюенсер подходит под твой бриф',
          'Համընկնման գնահատական՝ որքանով է յուրաքանչյուր ինֆլյուենսեր համապատասխանում քո բրիֆին',
        ],
      },
      card: {
        name: ['Anna Sokolova', 'Анна Соколова', 'Աննա Սոկոլովա'],
        city: ['Moscow', 'Москва', 'Մոսկվա'],
        niche: ['Food and cafés', 'Еда и кафе', 'Սնունդ և սրճարաններ'],
        verified: ['Verified', 'Проверен', 'Ստուգված'],
        synced: [
          'Synced from Instagram today',
          'Обновлено из Instagram сегодня',
          'Թարմացվել է Instagram-ից այսօր',
        ],
        followers: ['Followers', 'Подписчики', 'Հետևորդներ'],
        avgViews: ['Avg. views', 'Ср. просмотры', 'Միջ. դիտումներ'],
        er: ['Engagement', 'Вовлечённость', 'Ներգրավվածություն'],
        posts: ['Posts', 'Публикации', 'Հրապարակումներ'],
        age: ['Audience age', 'Возраст аудитории', 'Լսարանի տարիքը'],
        gender: ['Audience gender', 'Пол аудитории', 'Լսարանի սեռը'],
        women: ['Women', 'Женщины', 'Կանայք'],
        men: ['Men', 'Мужчины', 'Տղամարդիկ'],
        countries: ['Top countries', 'Топ стран', 'Առաջատար երկրներ'],
        match: ['Match with your brief', 'Совпадение с брифом', 'Համընկնում բրիֆի հետ'],
        core: [
          '{percent} of the audience is 18–34',
          '{percent} аудитории — 18–34 года',
          'Լսարանի {percent}-ը 18–34 տարեկան է',
        ],
      },
    },
    toolkit: {
      eyebrow: ['Your toolkit', 'Твои инструменты', 'Քո գործիքները'],
      title: [
        'Everything for collabs, right in your pocket',
        'Всё для коллабораций — в твоём кармане',
        'Ամեն ինչ համագործակցությունների համար՝ քո գրպանում',
      ],
      lead: [
        'Briefs that fit you, offers companies can book, your own public page, and notifications that find you wherever you are.',
        'Брифы, которые тебе подходят, предложения, которые компании могут заказать, своя публичная страница и уведомления, которые найдут тебя где угодно.',
        'Քեզ համապատասխանող բրիֆներ, առաջարկներ, որոնք ընկերությունները կարող են պատվիրել, քո հանրային էջը և ծանուցումներ, որոնք կգտնեն քեզ ամենուր։',
      ],
      cta: ['Join as an influencer', 'Присоединиться как инфлюенсер', 'Միանալ որպես ինֆլյուենսեր'],
      push: {
        title: ['Push notifications', 'Push-уведомления', 'Push ծանուցումներ'],
        body: [
          'New briefs, replies from companies and requests for your offers land on your phone the moment they happen.',
          'Новые брифы, ответы компаний и запросы на твои предложения приходят на телефон сразу же.',
          'Նոր բրիֆները, ընկերությունների պատասխանները և քո առաջարկների հարցումները անմիջապես հասնում են հեռախոսիդ։',
        ],
        time: ['9:41', '9:41', '9:41'],
        date: ['Thursday, 6 November', 'Четверг, 6 ноября', 'Հինգշաբթի, նոյեմբերի 6'],
        now: ['now', 'сейчас', 'հիմա'],
        min: ['2 min ago', '2 мин назад', '2 րոպե առաջ'],
        hour: ['1 h ago', '1 ч назад', '1 ժ առաջ'],
        n1title: [
          'New brief for you · Match 92',
          'Новый бриф для тебя · Совпадение 92',
          'Նոր բրիֆ քեզ համար · Համընկնում 92',
        ],
        n1body: [
          'Reels about our new coffee bar',
          'Reels о нашем новом кофе-баре',
          'Reels մեր նոր սրճարանի մասին',
        ],
        n2title: ['You’re accepted', 'Тебя выбрали', 'Քեզ ընտրեցին'],
        n2body: [
          'Nordic Roast accepted your application. Their contacts are open.',
          'Nordic Roast принял твой отклик. Контакты открыты.',
          'Nordic Roast-ը ընդունեց քո դիմումը։ Կոնտակտները բաց են։',
        ],
        n3title: ['New request', 'Новый запрос', 'Նոր հարցում'],
        n3body: [
          'Bulka Bakery wants “3 Stories about your café”',
          'Пекарня «Булка» хочет «3 сторис о твоём кафе»',
          'Bulka հացատունն ուզում է «3 սթորի քո սրճարանի մասին»',
        ],
      },
      email: {
        title: [
          'A daily email digest',
          'Ежедневный дайджест на почту',
          'Օրական ամփոփում էլ. փոստով',
        ],
        body: [
          'Missed something? Once a day you get the new briefs that fit you in one short email.',
          'Что-то пропустил? Раз в день — короткое письмо с новыми брифами, которые тебе подходят.',
          'Ինչ-որ բան բաց թողե՞լ ես։ Օրը մեկ անգամ ստանում ես կարճ նամակ՝ քեզ համապատասխանող նոր բրիֆներով։',
        ],
        from: ['briefluence', 'briefluence', 'briefluence'],
        subject: [
          '3 new briefs for you today',
          '3 новых брифа для тебя сегодня',
          'Այսօր 3 նոր բրիֆ քեզ համար',
        ],
        r1: [
          'Reels about our new coffee bar',
          'Reels о нашем новом кофе-баре',
          'Reels մեր նոր սրճարանի մասին',
        ],
        r2: [
          'A weekend in the Alps, filmed for Reels',
          'Выходные в Альпах для Reels',
          'Հանգստյան օրեր Ալպերում՝ Reels-ի համար',
        ],
        r3: [
          'Try our new serum on camera',
          'Попробуй нашу новую сыворотку в кадре',
          'Փորձիր մեր նոր շիճուկը տեսախցիկի առաջ',
        ],
        barter: ['Barter', 'Бартер', 'Բարտեր'],
      },
      match: {
        title: [
          'A match score on every brief',
          'Оценка совпадения на каждом брифе',
          'Համընկնման գնահատական յուրաքանչյուր բրիֆի վրա',
        ],
        body: [
          'See at a glance how well a brief fits you, and why.',
          'Сразу видно, насколько бриф тебе подходит и почему.',
          'Միանգամից տեսնում ես, թե որքան է բրիֆը քեզ համապատասխանում և ինչու։',
        ],
        label: ['Match', 'Совпадение', 'Համընկնում'],
        city: ['Your city', 'Твой город', 'Քո քաղաքը'],
        age: ['Audience 18–34', 'Аудитория 18–34', 'Լսարան 18–34'],
        followers: ['5K+ followers', '5K+ подписчиков', '5K+ հետևորդ'],
      },
      track: {
        title: [
          'Track every application',
          'Следи за каждым откликом',
          'Հետևիր յուրաքանչյուր դիմումին',
        ],
        body: [
          'Applied, viewed, shortlisted, accepted: you always know where you stand.',
          'Отправлен, просмотрен, в шорт-листе, принят — ты всегда знаешь, на каком ты этапе.',
          'Ուղարկված, դիտված, ընտրվածների ցուցակում, ընդունված․ միշտ գիտես, թե որտեղ ես։',
        ],
      },
      offers: {
        title: ['Sell your own offers', 'Продавай свои предложения', 'Վաճառիր քո առաջարկները'],
        body: [
          'Set a format and a price. Companies send requests, you accept the ones you like.',
          'Укажи формат и цену. Компании присылают запросы, а ты принимаешь те, что нравятся.',
          'Նշիր ձևաչափը և գինը։ Ընկերություններն ուղարկում են հարցումներ, իսկ դու ընդունում ես քեզ դուր եկածները։',
        ],
        item: ['3 Stories about your café', '3 сторис о твоём кафе', '3 սթորի քո սրճարանի մասին'],
        requests: [
          '{count, plural, one {# new request} other {# new requests}}',
          '{count, plural, one {# новый запрос} few {# новых запроса} many {# новых запросов} other {# новых запроса}}',
          '{count, plural, other {# նոր հարցում}}',
        ],
      },
      page: {
        title: ['Your own public page', 'Своя публичная страница', 'Քո հանրային էջը'],
        body: [
          'Your stats, portfolio and offers on one link. Put it in your bio and let companies come to you.',
          'Статистика, портфолио и предложения по одной ссылке. Поставь её в био — и компании придут сами.',
          'Վիճակագրությունը, պորտֆոլիոն և առաջարկները՝ մեկ հղումով։ Դիր այն բիոյում, և ընկերությունները կգան իրենք։',
        ],
        handle: ['anna', 'anna', 'anna'],
        copy: ['Copy link', 'Скопировать', 'Պատճենել'],
      },
    },
  },
};
