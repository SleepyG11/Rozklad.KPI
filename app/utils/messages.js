import _ from 'lodash';

const LOCALES = {
    bind: {
        missingPermissions: 'Цю команду можуть використовувати лише адміністратори чату.',
        stageStart: {
            title: 'Введіть назву групи.',
            placeholder: 'Назва групи. Наприклад: ХД-01'
        },
        stageName: {
            notFound: 'Групу не було знайдено.',
            foundOne: 'По запиту знайдено групу {{name}}. Продовжити?',
            foundMultiple: 'По запиту було знайдено декілька груп.\nОберіть потрібну.',
            hideButton: 'Сховати список',
            acceptButton: 'Так',
            cancelButton: 'Ні',
        },
        stageData: {
            notFound: 'Групу не було знайдено.',
            foundMultiple: 'У групи {{name}} знайдено декілька варіантів.\nОберіть потрібний.',
            hideButton: 'Сховати список',
        },
        stageEnd: {
            notFound: 'Не вдалося отримати розклад.',
            success: `Групу {{name}} успішно налаштовано.`,
            successFirst: `Групу {{name}} успішно налаштовано.\nТепер було б непогано налаштувати інші функції боту. Почати?`
        }
    },
    lessons: {
        noSchedule: 'Розклад не було знайдено.',
        notBinded: {
            asUser: 'У цьому чаті не обрана група.',
            asAdmin: 'У цьому чаті не обрана група. (<i>/bind для налаштування</i>)'
        },
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
        isCurrentWeek: {
            [false]: 'Наступний',
            [true]: 'Поточний'
        },

        stageData: {
            notFound: 'Групу не було знайдено.',
            foundMultiple: 'У групи {{name}} знайдено декілька варіантів.\nОберіть потрібний.',
            hideButton: 'Сховати список',
        },

        typeSingle: {
            roomsFormat: {
                missing: 'Аудиторія: <i>Невідома</i>',
                single: 'Аудиторія: <i>{{rooms}}</i>',
                multiple: 'Аудиторії: <i>{{rooms}}</i>',
            },
            teachersFormat: {
                missing: 'Викладач: <i>Невідомо</i>',
                single: 'Викладач:\n<i>{{teachers}}</i>',
                multiple: 'Викладачі:\n<i>{{teachers}}</i>',
            },
            linksFormat: 'Посилання: {{links}}',
            fullFormat: '' +
                '<b>{{lessonName}}</b>\n' +
                '<i>{{lessonNumber}} пара / {{lessonTimes}} / {{lessonType}}</i> \n' +
                '\n' +
                '{{lessonRooms}}\n' +
                '{{lessonTeachers}}\n' +
                '{{lessonLinks}}'
            ,
        },
        typeDay: {
            missingFormat: {
                withTime: '<i>–</i>',
                withoutTime: '<i>Нічого</i>',
            },
            roomsFormat: '<u>{{rooms}}</u>',
            typeFormat: '<i>{{type}}</i>',
            lessonFormat: {
                withTime: '<b>[{{lessonNumber}}] [{{lessonTimes}}]</b> {{lessonData}}',
                withoutTime: '<b>[{{lessonNumber}}]</b> {{lessonData}}',
            }
        },
        typeWeek: {
            showTeachers: 'Показати викладачів',
            hideTeachers: 'Приховати викладачів',
            toFirst: 'Перший тиждень',
            toSecond: 'Другий тиждень',
            missingFormat: '<i>Пар немає</i>',
            titleFormat: '{{weekNumberText}} тиждень ({{isCurrentWeekText}}) у групи {{groupName}}:',
            dayFormat: '' +
                '<b>{{weekday}}</b>\n' +
                '{{dayText}}'
            ,
            fullFormat: '{{title}}\n' +
                '\n' + 
                '{{lessonText}}'
            ,
        },
        current: {
            notFound: `Зараз у групи {{groupName}} пар немає.`,
            format: '' +
                '<b>Поточна пара у групи {{groupName}}:</b>\n' + 
                '\n' + 
                '{{lessonText}}'
            ,
        },
        next: {
            format: '' +
                '<b>Наступна пара у групи {{groupName}}:</b>\n' + 
                '<i>{{timeLabel}} ({{timeDiff}})</i>\n' +
                '\n' + 
                '{{lessonText}}'
            ,
        },
        today: {
            notFound: `Сьогодні у групи {{groupName}} пар немає.`,
            format: '' +
                '<b>Пари на сьогодні у групи {{groupName}}:</b>\n' + 
                '<i>{{timeLabel}}</i>\n' +
                '\n' + 
                '{{lessonText}}'
            ,
        },
        tomorrow: {
            notFound: `Завтра у групи {{groupName}} пар немає.`,
            format: '' +
                '<b>Пари на завтра у групи {{groupName}}:</b>\n' + 
                '<i>{{timeLabel}}</i>\n' +
                '\n' + 
                '{{lessonText}}'
            ,
        },
        nextday: {
            format: '' +
            '<b>Наступний робочий день у групи {{groupName}}:</b>\n' + 
            '<i>{{timeLabel}}</i>\n' +
            '\n' + 
            '{{lessonText}}'
            ,
        },
    },
    settings: {
        groupFormat: 'Група: <b>{{groupName}}</b>',
        noGroupFormat: 'Група: <i>Не обрана. /bind для налаштування</i>',
        fullFormat: '<b>Налаштування бота у цьому чаті:</b>\n' +
            '\n' +
            '{{groupText}}\n' +
            '\n' +
            '{{showTeachersText}} Відображати вчителів\n' +
            '{{showTimeText}} Відображати час початку та кінця пар\n' +
            '{{beforeNotifText}} Оповіщення за 15 хв. перед початком пари\n' +
            '{{nowNotifText}} Оповіщення про початок пари\n' +
            '{{spotLinksText}} Помічати посилання на дистанційні пари\n'
        ,
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
    }
}

export function localize(string, params){
    return String(string).replace(/(?<!\\)\{\{(.+?)(?<!\\)\}\}/g, (match, g1) => {
        return String(_.get(params, g1, match));
    });
}
export function localizeKey(key, params){
    return localize(_.get(LOCALES, key, '{{'+key+'}}'), params);
}