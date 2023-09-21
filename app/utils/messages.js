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

    bind: {
        messages: {
            missingPermissions: 'Цю команду можуть використовувати лише адміністратори чату.',
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
                successFirst: `Групу {{name}} успішно налаштовано.\n\nТепер Ви можете налаштувати інші функції боту, такі як оповіщення, через команду /settings.`
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
                message: '' +
                    '<b>Поточна пара у групи {{groupName}}:</b>\n' + 
                    '\n' + 
                    '{{lessonText}}'
                ,
            },
            next: {
                message: '' +
                    '<b>Наступна пара у групи {{groupName}}:</b>\n' + 
                    '<i>{{timeLabel}} ({{timeDiff}})</i>\n' +
                    '\n' + 
                    '{{lessonText}}'
                ,
            },
            today: {
                notFound: `Сьогодні у групи {{groupName}} пар немає.`,
                message: '' +
                    '<b>Пари на сьогодні у групи {{groupName}}:</b>\n' + 
                    '<i>{{timeLabel}}</i>\n' +
                    '\n' + 
                    '{{lessonText}}'
                ,
            },
            tomorrow: {
                notFound: `Завтра у групи {{groupName}} пар немає.`,
                message: '' +
                    '<b>Пари на завтра у групи {{groupName}}:</b>\n' + 
                    '<i>{{timeLabel}}</i>\n' +
                    '\n' + 
                    '{{lessonText}}'
                ,
            },
            nextday: {
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
                withoutGroup: 'Група: <i>Не обрана. /bind для налаштування</i>'
            },
            hasParent: '{{status}} Наявні посилання з іншого чату'
        },
        messages: {
            message: '<b>Налаштування бота у цьому чаті:</b>\n' +
                '\n' +
                '{{groupText}}\n' +
                '\n' +
                '{{showTeachersText}} Відображати вчителів\n' +
                '{{showTimeText}} Відображати час початку та кінця пар\n' +
                '{{beforeNotifText}} Оповіщення за 15 хв. перед початком пари\n' +
                '{{nowNotifText}} Оповіщення про початок пари\n' +
                '{{spotLinksText}} Помічати посилання на дистанційні пари\n' +
                '{{hasParentText}}'
            ,
        },
        buttons: {
            toggleTeachers: {
                [false]: 'Приховати вчителів',
                [true]: 'Відобразити вчителів',
            },
            toggleTime: {
                [false]: 'Приховати час пар',
                [true]: 'Відобразити час пар',
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
            }
        },
        buttons: {
            stageStart: {
                addPerm: 'Так',
                addTemp: 'Так, тимчасово',
                cancel: 'Ні',
            }
        },
        messages: {
            stageStart: {
                message: 'Не хочете додати посилання до поточної пари?',
            },
            stageTemp: {
                added: 'Посилання додано.'
            },
            stageName: {
                message: 'Назвіть посилання.',
                tooLong: 'Назва занадто давна.',
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
            parentAddedFirst: 'Посилання на пари та розклад успішно додані.\n\nТепер Ви можете налаштувати інші функції боту, такі як оповіщення, через команду /settings.',
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