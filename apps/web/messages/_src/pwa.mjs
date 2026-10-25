// Source for the pwa namespace (install the app + push notifications in settings): [en, ru, hy].
// Regenerate JSON: node scripts/write-messages.mjs messages/_src/pwa.mjs
export default {
  pwa: {
    title: ['App and notifications', 'Приложение и уведомления', 'Հավելված և ծանուցումներ'],
    lead: [
      'Use briefluence like an app and get notified right away.',
      'Пользуйся briefluence как приложением и получай уведомления сразу.',
      'Օգտագործիր briefluence-ը որպես հավելված և ստացիր ծանուցումներ անմիջապես։',
    ],
    install: {
      title: ['Add to your Home Screen', 'Добавь на экран «Домой»', 'Ավելացրու գլխավոր էկրանին'],
      installed: [
        'Done: you’re using briefluence as an app.',
        'Готово: ты пользуешься briefluence как приложением.',
        'Պատրաստ է․ դու օգտագործում ես briefluence-ը որպես հավելված։',
      ],
      button: ['Install the app', 'Установить приложение', 'Տեղադրել հավելվածը'],
      ios: {
        s1: [
          'Open this page in Safari.',
          'Открой эту страницу в Safari.',
          'Բացիր այս էջը Safari-ում։',
        ],
        s2: [
          'Tap Share (the square with an arrow).',
          'Нажми «Поделиться» (квадрат со стрелкой).',
          'Սեղմիր «Կիսվել» (քառակուսի՝ սլաքով)։',
        ],
        s3: [
          'Choose “Add to Home Screen”, then Add.',
          'Выбери «На экран „Домой“», затем «Добавить».',
          'Ընտրիր «Ավելացնել գլխավոր էկրանին», հետո՝ «Ավելացնել»։',
        ],
        s4: [
          'Open briefluence from your Home Screen.',
          'Открой briefluence с экрана «Домой».',
          'Բացիր briefluence-ը գլխավոր էկրանից։',
        ],
      },
      android: {
        s1: [
          'Open the browser menu (⋮).',
          'Открой меню браузера (⋮).',
          'Բացիր դիտարկիչի ընտրացանկը (⋮)։',
        ],
        s2: [
          'Tap “Install app” or “Add to Home screen”.',
          'Нажми «Установить приложение» или «Добавить на главный экран».',
          'Սեղմիր «Տեղադրել հավելվածը» կամ «Ավելացնել գլխավոր էկրանին»։',
        ],
      },
      desktop: [
        'In Chrome or Edge, click the install icon in the address bar or choose “Install briefluence” in the menu. In Safari on a Mac: File → Add to Dock.',
        'В Chrome или Edge нажми значок установки в адресной строке или выбери «Установить briefluence» в меню. В Safari на Mac: Файл → Добавить в Dock.',
        'Chrome-ում կամ Edge-ում սեղմիր հասցեի տողի տեղադրման պատկերակը կամ ընտրացանկում ընտրիր «Տեղադրել briefluence»։ Mac-ի Safari-ում՝ Ֆայլ → Ավելացնել Dock-ին։',
      ],
    },
    banner: {
      install: [
        'Add briefluence to your Home Screen to get notified about replies and new requests.',
        'Добавь briefluence на экран «Домой», чтобы получать уведомления об ответах и новых запросах.',
        'Ավելացրու briefluence-ը գլխավոր էկրանին՝ պատասխանների և նոր հարցումների մասին ծանուցումներ ստանալու համար։',
      ],
      push: [
        'Turn on notifications so you don’t miss replies and new requests.',
        'Включи уведомления, чтобы не пропустить ответы и новые запросы.',
        'Միացրու ծանուցումները, որ բաց չթողնես պատասխաններն ու նոր հարցումները։',
      ],
      howTo: ['Show me how', 'Как это сделать', 'Ինչպես անել'],
      installButton: ['Install', 'Установить', 'Տեղադրել'],
      turnOn: ['Turn on', 'Включить', 'Միացնել'],
      dismiss: ['Hide this reminder', 'Скрыть напоминание', 'Թաքցնել հիշեցումը'],
    },
    push: {
      label: [
        'Push notifications on this device',
        'Push-уведомления на этом устройстве',
        'Push-ծանուցումներ այս սարքում',
      ],
      off: [
        'Get notified about replies, accepted applications and new requests, even when briefluence is closed.',
        'Узнавай об ответах, принятых откликах и новых запросах, даже когда briefluence закрыт.',
        'Իմացիր պատասխանների, ընդունված դիմումների և նոր հարցումների մասին, նույնիսկ երբ briefluence-ը փակ է։',
      ],
      on: [
        'On. Notifications will come to this device.',
        'Включено. Уведомления будут приходить на это устройство.',
        'Միացված է։ Ծանուցումները կգան այս սարքին։',
      ],
      needsInstall: [
        'On iPhone and iPad, add briefluence to your Home Screen first (see above), open it from there, then turn this on.',
        'На iPhone и iPad сначала добавь briefluence на экран «Домой» (см. выше), открой его оттуда и включи здесь.',
        'iPhone-ում և iPad-ում նախ ավելացրու briefluence-ը գլխավոր էկրանին (տես վերևում), բացիր այնտեղից, հետո միացրու այստեղ։',
      ],
      denied: [
        'Notifications are blocked for this site. Allow them in your browser or phone settings, then come back.',
        'Уведомления для сайта заблокированы. Разреши их в настройках браузера или телефона и вернись сюда.',
        'Կայքի ծանուցումներն արգելափակված են։ Թույլատրիր դրանք դիտարկիչի կամ հեռախոսի կարգավորումներում և վերադարձիր։',
      ],
      unsupported: [
        'This browser can’t show push notifications. Try Chrome, Edge, Firefox or Safari.',
        'Этот браузер не умеет показывать push-уведомления. Попробуй Chrome, Edge, Firefox или Safari.',
        'Այս դիտարկիչը չի կարող ցույց տալ push-ծանուցումներ։ Փորձիր Chrome, Edge, Firefox կամ Safari։',
      ],
      unavailable: [
        'Push notifications aren’t available yet.',
        'Push-уведомления пока недоступны.',
        'Push-ծանուցումները դեռ հասանելի չեն։',
      ],
      enabledToast: [
        'Push notifications are on',
        'Push-уведомления включены',
        'Push-ծանուցումները միացված են',
      ],
      disabledToast: [
        'Push notifications are off',
        'Push-уведомления выключены',
        'Push-ծանուցումներն անջատված են',
      ],
    },
  },
};
