// Homepage examples: sample briefs and influencer offers (made-up companies and influencers, shown as
// examples). Every leaf is [en, ru, hy].
export default {
  showcase: {
    eyebrow: ['Examples', 'Примеры', 'Օրինակներ'],
    title: [
      'What you’ll find on briefluence',
      'Что ты найдёшь на briefluence',
      'Ինչ կգտնես briefluence-ում',
    ],
    lead: [
      'Companies post briefs for money, barter or both. Influencers post what they film and for how much.',
      'Компании публикуют брифы за деньги, бартер или и то и другое. Инфлюенсеры — что они снимают и за сколько.',
      'Ընկերությունները հրապարակում են բրիֆներ գումարով, բարտերով կամ երկուսով։ Ինֆլյուենսերները՝ ինչ են նկարում և ինչ արժե։',
    ],
    previous: ['Previous', 'Назад', 'Նախորդը'],
    next: ['Next', 'Далее', 'Հաջորդը'],
    sample: ['Example', 'Пример', 'Օրինակ'],
    briefsTitle: ['Briefs from companies', 'Брифы компаний', 'Ընկերությունների բրիֆները'],
    briefsCta: ['Post a brief for free', 'Разместить бриф бесплатно', 'Անվճար տեղադրել բրիֆ'],
    forCompanies: ['For companies', 'Для компаний', 'Ընկերությունների համար'],
    forInfluencers: ['For influencers', 'Для инфлюенсеров', 'Ինֆլյուենսերների համար'],
    briefsLead: [
      'Say what you need, who it’s for and what you pay: money, barter or both.',
      'Напиши, что нужно, для какой аудитории и что ты платишь: деньги, бартер или всё вместе.',
      'Գրիր, թե ինչ է պետք, ում համար և ինչ ես վճարում՝ գումար, բարտեր կամ երկուսը միասին։',
    ],
    offersLead: [
      'Name a format and a price. Companies send a request, you say yes or no.',
      'Укажи формат и цену. Компании присылают запрос, а ты решаешь, соглашаться или нет.',
      'Նշիր ձևաչափը և գինը։ Ընկերություններն ուղարկում են հարցում, իսկ դու որոշում ես՝ համաձայնել, թե ոչ։',
    ],
    offersTitle: [
      'Offers from influencers',
      'Предложения инфлюенсеров',
      'Ինֆլյուենսերների առաջարկները',
    ],
    offersCta: ['Post your offer', 'Разместить своё предложение', 'Տեղադրել քո առաջարկը'],
    wanted: [
      '{count, plural, one {# influencer wanted} other {# influencers wanted}}',
      '{count, plural, one {Нужен # инфлюенсер} few {Нужны # инфлюенсера} many {Нужно # инфлюенсеров} other {Нужно # инфлюенсера}}',
      '{count, plural, other {Անհրաժեշտ է # ինֆլյուենսեր}}',
    ],
    followers: ['{count} followers', '{count} подписчиков', '{count} հետևորդ'],
    briefs: {
      coffee: {
        brand: ['Nordic Roast', 'Nordic Roast', 'Nordic Roast'],
        city: ['Stockholm', 'Стокгольм', 'Ստոկհոլմ'],
        title: [
          'Reels about our new coffee bar',
          'Reels о нашем новом кофе-баре',
          'Reels մեր նոր սրճարանի մասին',
        ],
      },
      hotel: {
        brand: ['Alpenblick Hotel', 'Alpenblick Hotel', 'Alpenblick Hotel'],
        city: ['Innsbruck', 'Инсбрук', 'Ինսբրուկ'],
        title: [
          'A weekend in the Alps, filmed for Reels',
          'Выходные в Альпах для Reels',
          'Հանգստյան օրեր Ալպերում՝ Reels-ի համար',
        ],
        barter: [
          'Two nights for two with breakfast',
          'Две ночи для двоих с завтраком',
          'Երկու գիշեր երկուսի համար՝ նախաճաշով',
        ],
      },
      skincare: {
        brand: ['Lumière Skin', 'Lumière Skin', 'Lumière Skin'],
        city: ['Paris', 'Париж', 'Փարիզ'],
        title: [
          'Try our new serum on camera',
          'Попробуй нашу новую сыворотку в кадре',
          'Փորձիր մեր նոր շիճուկը տեսախցիկի առաջ',
        ],
        barter: ['+ a full skincare set', '+ полный набор ухода', '+ խնամքի ամբողջական հավաքածու'],
      },
      bakery: {
        brand: ['Bulka Bakery', 'Пекарня «Булка»', 'Bulka հացատուն'],
        city: ['Moscow', 'Москва', 'Մոսկվա'],
        title: [
          'Stories about our morning croissants',
          'Сторис про наши утренние круассаны',
          'Սթորիներ մեր առավոտյան կրուասանների մասին',
        ],
        barter: [
          'Breakfast for two every week for a month',
          'Завтрак на двоих каждую неделю в течение месяца',
          'Նախաճաշ երկուսի համար ամեն շաբաթ՝ մեկ ամիս',
        ],
      },
      gym: {
        brand: ['Pulse Lab', 'Pulse Lab', 'Pulse Lab'],
        city: ['Berlin', 'Берлин', 'Բեռլին'],
        title: [
          'Show your first week at our studio',
          'Покажи свою первую неделю в нашей студии',
          'Ցույց տուր քո առաջին շաբաթը մեր ստուդիայում',
        ],
      },
      outdoor: {
        brand: ['Sever Outdoor', 'Sever Outdoor', 'Sever Outdoor'],
        city: ['Saint Petersburg', 'Санкт-Петербург', 'Սանկտ Պետերբուրգ'],
        title: [
          'Test our winter jacket in real frost',
          'Проверь нашу зимнюю куртку на настоящем морозе',
          'Փորձարկիր մեր ձմեռային բաճկոնն իսկական ցրտին',
        ],
        barter: ['+ the jacket is yours', '+ куртка остаётся у тебя', '+ բաճկոնը մնում է քեզ'],
      },
    },
    offers: {
      anna: {
        name: ['Anna Sokolova', 'Анна Соколова', 'Աննա Սոկոլովա'],
        city: ['Moscow', 'Москва', 'Մոսկվա'],
        title: ['3 Stories about your café', '3 сторис о твоём кафе', '3 սթորի քո սրճարանի մասին'],
      },
      lukas: {
        name: ['Lukas Weber', 'Лукас Вебер', 'Լուկաս Վեբեր'],
        city: ['Berlin', 'Берлин', 'Բեռլին'],
        title: [
          'A Reel from your gym or studio',
          'Reels из твоего зала или студии',
          'Reels քո մարզասրահից կամ ստուդիայից',
        ],
      },
      marie: {
        name: ['Marie Dubois', 'Мари Дюбуа', 'Մարի Դյուբուա'],
        city: ['Lyon', 'Лион', 'Լիոն'],
        title: [
          'Unboxing Reel for beauty brands',
          'Reels с распаковкой для бьюти-брендов',
          'Reels-բացում գեղեցկության բրենդների համար',
        ],
      },
      dmitry: {
        name: ['Dmitry Orlov', 'Дмитрий Орлов', 'Դմիտրի Օռլով'],
        city: ['Saint Petersburg', 'Санкт-Петербург', 'Սանկտ Պետերբուրգ'],
        title: [
          'City walk Stories with a stop at your place',
          'Сторис-прогулка по городу с остановкой у тебя',
          'Սթորի-զբոսանք քաղաքով՝ կանգառով քո մոտ',
        ],
      },
      giulia: {
        name: ['Giulia Rossi', 'Джулия Росси', 'Ջուլիա Ռոսսի'],
        city: ['Milan', 'Милан', 'Միլան'],
        title: ['Restaurant review Reel', 'Reels-обзор ресторана', 'Ռեստորանի Reels-ակնարկ'],
      },
      zofia: {
        name: ['Zofia Nowak', 'Зофья Новак', 'Զոֆյա Նովակ'],
        city: ['Warsaw', 'Варшава', 'Վարշավա'],
        title: [
          'A Story with your link sticker',
          'Сторис со стикером-ссылкой',
          'Սթորի քո հղման սթիքերով',
        ],
      },
    },
  },
};
