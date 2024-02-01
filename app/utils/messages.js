import _ from 'lodash';

const LOCALES = {
    utils: {
        daysNumber: {
            0: 'Понеділок',
            1: 'Вівторок',
            2: 'Середа',
            3: 'Четвер',
            4: 'П\'ятниця',
            5: 'Субота',
            6: 'Неділя',
        },
        weeksNumber: {
            0: 'Перший',
            1: 'Другий'
        },
        currentWeek: {
            [false]: 'Наступний',
            [true]: 'Поточний'
        },
    },

    global: {
        cantUseButton: '❗️ Ви не можете використовувати цю кнопку.',
        cantUseAdminCommand: '❗️ Цю команду можуть використовувати лише адміністратори чату.',
        replyMessageDeleted: '❗️ Цільове повідомлення було видалено.',
        groupChatOnly: '❗️ Цю команду можна використовувати лише у групових чатах.',
    },

    bind: {
        messages: {
            stageStart: {
                enterGroupName: 'Введіть назву групи.',
            },
            stageName: {
                notFound: 'Групу не було знайдено.',
                foundOne: 'По запиту знайдено групу {{name}}. Продовжити?',
                foundMultiple: 'По запиту було знайдено декілька груп.\nОберіть потрібну.',
            },
            stageData: {
                notFound: 'Групу не було знайдено.',
                foundMultiple: 'У групи {{name}} знайдено декілька варіантів.\nОберіть потрібний.',
            },
            stageEnd: {
                notFound: 'Не вдалося отримати розклад.',
                success: `Групу {{name}} успішно налаштовано.`,
                successFirst: '' +
                    'Групу {{name}} успішно налаштовано.' +
                    '\n' +
                    'Тепер Ви можете налаштувати інші функції боту, такі як оповіщення, через команду /settings.\n' + 
                    'Ознайомитись з усіма командами бота: /help.'
                ,
            }
        },
        buttons: {
            stageName: {
                accept: 'Так',
                cancel: 'Ні',
                hide: 'Сховати список',
            },
            stageData: {
                hide: 'Сховати список',
            },
        },
        placeholders: {
            stageStart: {
                groupName: 'Назва групи. Наприклад: ХД-01'
            },
        },
    },
    unbind: {
        messages: {
            success: 'Група успішно видалена.'
        }
    },
    lesson: {
        messages: {
            tooLong: 'Не вдалося відобразити розклад тижня через занадто великий розмір.',
            noSchedule: 'Розклад не було знайдено.',
            notBinded: {
                asUser: 'У цьому чаті не обрана група.',
                asAdmin: 'У цьому чаті не обрана група. (<i>/bind для налаштування</i>)'
            },

            stageData: {
                notFound: 'Групу не було знайдено.',
                foundMultiple: 'У групи {{name}} знайдено декілька варіантів.\nОберіть потрібний.',
            },
        },
        buttons: {
            nextLesson: 'Наступна пара',
            nextday: 'Наступний робочий день',

            showTeachers: 'Показати викладачів',
            hideTeachers: 'Приховати викладачів',

            firstWeek: 'Перший тиждень',
            secondWeek: 'Другий тиждень',

            stageData: {
                hide: 'Сховати список',
            }
        },

        templates: {
            single: {
                rooms: {
                    missing: 'Аудиторія: <i>Невідома</i>',
                    single: 'Аудиторія: <i>{{rooms}}</i>',
                    multiple: 'Аудиторії: <i>{{rooms}}</i>',
                },
                teachers: {
                    missing: 'Викладач: <i>Невідомо</i>',
                    single: 'Викладач:\n<i>{{teachers}}</i>',
                    multiple: 'Викладачі:\n<i>{{teachers}}</i>',
                },
                teacher: ' ≻  <i>{{teacher}}</i>',
                links: 'Посилання: {{links}}',
                message: '' +
                    '<b>{{lessonName}}</b>\n' +
                    '<i>{{lessonNumber}} пара / {{lessonTimes}} / {{lessonType}}</i> \n' +
                    '\n' +
                    '{{lessonRooms}}\n' +
                    '{{lessonTeachers}}\n' +
                    '{{lessonLinks}}'
                ,
            },
            day: {
                missing: {
                    withTime: '<i>–</i>',
                    withoutTime: '<i>Нічого</i>',
                },
                rooms: '<u>{{rooms}}</u>',
                type: '<i>{{type}}</i>',
                teacher: ' ≻  <i>{{teacher}}</i>',
                lesson: {
                    withTime: '<b>[{{lessonNumber}}] [{{lessonTimes}}]</b> {{lessonData}}',
                    withoutTime: '<b>[{{lessonNumber}}]</b> {{lessonData}}',
                }
            },
            week: {
                missing: '<i>Пар немає</i>',
                title: '<b>{{weekNumberText}} тиждень ({{isCurrentWeekText}}) у групи {{groupName}}:</b>',
                day: '' +
                    '<b>{{weekday}}</b>\n' +
                    '{{dayText}}'
                ,
                message: '{{title}}\n' +
                    '\n' + 
                    '{{lessonText}}'
                ,
            }
        },

        targets: {
            current: {
                notFound: `Зараз у групи {{groupName}} пар немає.`,
                weekend: `Зараз {{weekendName}}, тому пар немає.`,
                message: '' +
                    '<b>Поточна пара у групи {{groupName}}:</b>\n' + 
                    '\n' + 
                    '{{lessonText}}'
                ,
            },
            next: {
                notFound: `Наступну пару у групи {{groupName}} не знайдено.`,
                message: '' +
                    '<b>Наступна пара у групи {{groupName}}:</b>\n' + 
                    '<i>{{timeLabel}} ({{timeDiff}})</i>\n' +
                    '\n' + 
                    '{{lessonText}}'
                ,
            },
            today: {
                notFound: `Сьогодні у групи {{groupName}} пар немає.`,
                weekend: `Зараз {{weekendName}}, тому пар немає.`,
                message: '' +
                    '<b>Пари на сьогодні у групи {{groupName}}:</b>\n' + 
                    '<i>{{timeLabel}}</i>\n' +
                    '\n' + 
                    '{{lessonText}}'
                ,
            },
            tomorrow: {
                notFound: `Завтра у групи {{groupName}} пар немає.`,
                weekend: `Завтра {{weekendName}}, тому пар не буде.`,
                message: '' +
                    '<b>Пари на завтра у групи {{groupName}}:</b>\n' + 
                    '<i>{{timeLabel}}</i>\n' +
                    '\n' + 
                    '{{lessonText}}'
                ,
            },
            nextday: {
                notFound: `Наступний робочий день у групи {{groupName}} не знайдено.`,
                message: '' +
                    '<b>Наступний робочий день у групи {{groupName}}:</b>\n' + 
                    '<i>{{timeLabel}}</i>\n' +
                    '\n' + 
                    '{{lessonText}}'
                ,
            },
        },
    },
    settings: {
        templates: {
            title: {
                withGroup: 'Група: <b>{{groupName}}</b>',
                withoutGroup: 'Група: <i>Не обрана, /bind для налаштування</i>'
            },
            hasParent: '{{status}} Наявні посилання з іншого чату'
        },
        messages: {
            message: '<b>Налаштування бота у цьому чаті:</b>\n' +
                '\n' +
                '{{groupText}}\n' +
                '\n' +
                '{{showTeachersText}} Відображати викладачів\n' +
                '{{showTimeText}} Відображати час початку та кінця пар\n' +
                '{{beforeNotifText}} Оповіщення за 15 хв. перед початком пари\n' +
                '{{nowNotifText}} Оповіщення про початок пари\n' +
                '{{spotLinksText}} Помічати посилання на дистанційні пари\n' +
                '{{hasParentText}}\n' +
                '\n' +
                'Більш детально про функції бота - /help'
            ,
        },
        buttons: {
            toggleTeachers: {
                [false]: 'Не відображати викладачів',
                [true]: 'Відображати викладачів',
            },
            toggleTime: {
                [false]: 'Не відображати час пар',
                [true]: 'Відображати час пар',
            },
            toggleBeforeNotif: {
                [false]: 'Не надсилати оповіщення за 15 хв. до пари',
                [true]: 'Надсилати оповіщення за 15 хв. до пари',
            },
            toggleNowNotif: {
                [false]: 'Не надсилати оповіщення про початок пари',
                [true]: 'Надсилати оповіщення про початок пари',
            },
            toggleLinks: {
                [false]: 'Ігнорувати посилання на пари',
                [true]: 'Помічати посилання на пари',
            },
            removeParent: 'Видалити посилання іншого чату',
            close: 'Закрити',
        },
    },

    link: {
        placeholders: {
            stageName: {
                linkName: 'Назва посилання',
            },
            directive: {
                linkUrl: 'Посилання на пару Zoom, Meet, Microsoft Teams'
            }
        },
        buttons: {
            stageStart: {
                addPerm: 'Так',
                addTemp: 'Так, тимчасово',
                cancel: 'Ні',
            },
            directive: {
                addPerm: 'Постійне',
                addTemp: 'Тимчасове',
                cancel: 'Відмінити'
            }
        },
        messages: {
            directive: {
                noLesson: 'Зараз немає пари, до якої можна додати посилання.',
                limitExceeded: 'У пари забагато посилань.',
                alreadyExists: 'Це посилання вже було додано.',
                chooseType: 'Який тип цього посилання?',
                invalidUrl: 'Посилання не є дійсним посиланням на Zoom, Meet або Microsoft Teams.',

                message: 'Введіть посилання на поточну пару.',
            },
            stageStart: {
                message: 'Хочете додати посилання до поточної пари?',
            },
            stageTemp: {
                added: 'Посилання додано.'
            },
            stageName: {
                message: 'Назвіть посилання <i>(не більше 32 символів)</i>.',
                tooLong: 'Назва занадто довга. Спробуйте ще раз.',
                added: 'Посилання додано.'
            }
        },
    },
    linksDelete: {
        messages: {
            noLesson: 'Зараз немає пари.',
            allDeleted: 'Усі посилання на пару були видалені.',
            noLinks: 'На цю пару немає доданих посилань.',
            message: 'Оберіть посилання, які хочете видалити.'
        },
        buttons: {
            close: 'Закрити',
        }
    },
    linksShare: {
        messages: {
            message: '' +
                'Ви можете перенести посилання та розклад з цього чату до приватного, використовуючи посилання нижче.\n' +
                'Корисно, коли Ви хочете отримувати їх в оповіщеннях, не заважаючи іншим.'
            ,
        },
        buttons: {
            add: 'Додати посилання',
        }
    },

    start: {
        messages: {
            parentAdded: 'Посилання на пари та розклад успішно додані.',
            parentAddedFirst: '' +
                'Посилання на пари та розклад успішно додані.\n' + 
                '\n' +
                'Тепер Ви можете налаштувати інші функції боту, такі як оповіщення, через команду /settings.\n' + 
                'Ознайомитись з усіма командами бота: /help.'
            ,
            message: '' +
                '<b>Привіт! Я бот, який хоче допомогти Вам та Вашій групі слідкувати за розкладом у КПІ в Telegram!</b>\n' + 
                'Які пари зараз, сьогодні, завтра, цього або наступного тижня - одразу у Вашому чаті, ' + 
                'навіть коли http://roz.kpi.ua не працює або https://schedule.kpi.ua не оновлює розклад!\n' +
                '\n' + 
                '- Використовуйте в особистих повідомленнях, або додайте мене до свого чату групи;\n' + 
                '- Налаштуйте групу, розклад якої Вам потрібен, командою /bind;\n' + 
                '- Готово! Використовуйте інші команди бота: /help.\n' +
                '\n' +
                'За додатковою інформацією або у разі проблеми з ботом, звертайтесь до @SleepyG11 або /about.'
            ,
        }
    },
    about: {
        messages: {
            message: '' +
                '<a href="t.me/{{botUsername}}">{{botName}}</a> - неофіційний бот для більш зручного моніторингу <a href="{{scheduleHost}}">розкладу НТУУ "КПІ"</a>.\n' +
                '\n' +
                'Є питання, побажання, або знайшли помилку?\n' +
                'Звертайтесь до <a href="t.me/SleepyG11">@SleepyG11</a> або допоможіть боту стати краще через <a href="https://github.com/makatymba2001/Rozklad.KPI">GitHub</a>!\n' +
                '\n' +
                'Дякую, що використовуєте бота!'
            ,
        }
    },

    help: {
        buttons: {
            notifs: 'Про оповіщення про пари',
            links: 'Про посилання на пари',
            privacy: 'Приватність та використання даних',
        },
        messages: {
            notifs: '' +
                'Бот має функцію за 15 хвилин або на початок пари нагадувати про неї, надіславши оповіщення до чату.\n' +
                'Працює як у приватних, так і групових чатах.\n' +
                '\n' +
                'Якщо пара дистанційна, корисно буде додати посилання до неї, щоб мати змогу швидко під\'єднатись у майбутньому.\n' +
                '\n' +
                'За замовчуванням оповіщення вимкнені, але Ви можете це налаштувати у /settings.'
            ,
            links: '' +
                'Зараз більша частина пар є дистанційними та проводяться через Zoom, Meet, Microsoft Teams та інші сервіси.\n' +
                'Зберігати та шукати потрібне посилання буває важко, але бот це може робити за вас!\n' +
                'Команда /links_add дає змогу додати посилання до поточної пари, а /links_delete видалити непотрібні.\n' +
                '\n' +
                'Якщо бот знаходиться у груповому чаті, може виникнути необхідність "скопіювати" усі посилання до приватного чату, ' + 
                'щоб вони з\'являлись в оповіщеннях, не заважаючи групі. Для цього може стати у нагоді команда /links_share.\n' +
                '\n' + 
                'Також бот має можливість додавати посилання на пари зі звичайних повідомлень, але лише при наявності відоповідних прав. ' + 
                '<a href="https://core.telegram.org/bots/features#privacy-mode">Детальніше</a>.'
            ,
            privacy: '' +
                'Для коректної роботи боту виконується обробка даних, таких як:\n- ID чату\n- наявність прав адміна у учасника.\n' +
                '\n' +
                'Для роботи функції додавання посилань на пару з повідомлень, боту необхідний доступ до повідомлень. ' +
                'За замочуванням бот за для Вашої безпеки не має його, але Ви можете власноруч налаштувати це. ' + 
                '<a href="https://core.telegram.org/bots/features#privacy-mode">Детальніше</a>.'
            ,

            message: 
                '<b>Усі команди бота:</b>\n' +
                '\n' +
                '<b>Загальні</b>\n' +
                '/start - Почати роботу з ботом\n' +
                '/help - Повний список команд та додаткова інформація\n' +
                '/about - Знайшли помилку або є що сказати?\n' +
                '\n' +
                '<b>Нашалтування</b>\n' +
                '/settings - Налаштування бота\n' +
                '/bind - Налаштувати групу\n' +
                '/unbind - Видалити групу\n' +
                '/links_delete - Видалити посилання на пару\n' +
                '/links_share - Поділитися посиланнями на пари\n' +
                '\n' +
                '<b>Розклад</b>\n' +
                '/current [група] - Поточна пара\n' +
                '/next [група] - Наступна пара\n' +
                '/today [група] - Пари на сьогодні\n' +
                '/tomorrow [група] - Пари на завтра\n' +
                '/nextday [група] - Пари на наступний робочий день\n' +
                '/week_current [група] - Пари на поточний тиждень\n' +
                '/week_next [група] - Пари на наступний тиждень\n' +
                '<i>Ці команди можна використовувати щоб швидко дізнатись пари іншої групи. Наприклад: <code>/current ХД-31</code></i>'
            ,
        }
    }
}

export function localize(string, params){
    return String(string).replace(/(?<!\\)\{\{(.+?)(?<!\\)\}\}/g, (match, g1) => {
        return String(_.get(params, g1, match));
    });
}
export function localizeKey(key, params){
    return localize(_.get(LOCALES, key, key), params);
}
export function localizeKeyboard(keyboard, params){
    ;[keyboard].flat(+Infinity).forEach(button => {
        if ('text' in button) {
            button.text = localizeKey(button.text, params);
        }
    })
    return keyboard;
}
export const l = localizeKey;