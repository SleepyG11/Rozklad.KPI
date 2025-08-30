import moment from 'moment-timezone';

import { getLessonDates } from "./times.js";
import { l } from "./messages.js";
import _ from 'lodash';

const LESSON_TIMES = {
    0: '08:30 - 10:05',
    1: '10:25 - 12:00',
    2: '12:20 - 13:55',
    3: '14:15 - 15:50',
    4: '16:10 - 17:45',
    5: '18:30 - 20:05',
}

function countToLocalize(n){
    switch(n){
        case 0: return 'missing';
        case 1: return 'single';
        default: return 'multiple';
    }
}

export function formatGroupName(name = ''){
    return name.trim().toLowerCase().replace(/^[а-яіїєґ]{2}\-/i, (match) => match.toUpperCase());
}
export function formatCapitalize(string){
    return string.substring(0, 1).toUpperCase() + string.substring(1);
}

export function formatTimeDefinition(date){
    let duration = moment.duration(moment(date).diff());
    if (duration.asMilliseconds() < 0) return 'Помилка!';
    let minutes = Math.floor(duration.asMinutes());
    if (minutes < 1) return 'Ось-ось почнеться';
    if (minutes < 60){
        if (String(minutes).match(/1[0-9]$/)) return 'Через ' + minutes + ' хвилин';
        switch(minutes % 10){
            case 1: return 'Через ' + minutes + ' хвилину';
            case 2: 
            case 3: 
            case 4: return 'Через ' + minutes + ' хвилини';
            default: return 'Через ' + minutes + ' хвилин';
        }
    }
    let hours = Math.floor(duration.asHours());
    if (hours < 36){
        let h = hours, m = minutes % 60;
        if (minutes === 0) m = '';
        else if (String(minutes).match(/1[0-9]$/)) m += ' хвилин';
        else{
            switch(minutes % 10){
                case 1: m += ' хвилину'; break;
                case 2: 
                case 3: 
                case 4: m += ' хвилини'; break;
                default: m += ' хвилин'; break;
            }
        }
        if (String(h).match(/1[0-9]$/)) h += ' годин';
        else{
            switch(hours % 10){
                case 1: h += ' годину'; break;
                case 2: case 3: case 4: h += ' години'; break;
                default: h += ' годин'; break;
            }
        }
        return 'Через ' + h + ' ' + m;
    }
    else{
        let days = Math.floor(duration.asDays());
        if (String(days).match(/1[0-9]$/)) return 'Через ' + days + ' днів';
        switch(days % 10){
            case 1: return 'Через ' + days + ' день'
            case 2: 
            case 3: 
            case 4: return 'Через ' + days + ' дні';
            default: return 'Через ' + days + ' днів';
        }
    }
}

export function formatDateLabels(date){
    let inputDate = moment(date);
    return {
        diff: formatTimeDefinition(getLessonDates(inputDate).lessonStart).toLowerCase(),
        label: formatCapitalize(inputDate.format('dddd, DD MMMM')),
        dayOfWeek: inputDate.format('dddd'),
        dayOfMonth: inputDate.format('DD MMMM'),
    }
}

export function formatSingleLesson(lesson, number, links){
    let lessonRooms = l(
        'lesson.templates.single.rooms.' + countToLocalize(lesson.rooms.length),
        { rooms: lesson.rooms.join(', ') }
    );
    let lessonTeachers = l(
        'lesson.templates.single.teachers.' + countToLocalize(lesson.teachers.length),
        { teachers: lesson.teachers.map(t => `· ${t}`).join('\n') }
    );
    let lessonLinks = links.length ? l(
        'lesson.templates.single.links',
        { links: links.map(link => {
            return `<a href="${_.escape(link.url)}">${link.name.replace(/\</g, '&lt;').replace(/\>/g, '&gt;')}</a>`
        }).join(', ') }
    ) : '';
    return l('lesson.templates.single.message', {
        lessonName: lesson.name,
        lessonNumber: number + 1,
        lessonTimes: LESSON_TIMES[number],
        lessonType: lesson.types.join(', ') || 'Невідомо',
        lessonRooms, lessonTeachers,
        lessonLinks
    })
}
export function formatLessonsDay(day, time = false, teachers = false, skipEmpty = false){
    let formattedLessons = [];
    let timeKey = time ? 'withTime' : 'withoutTime'
    for (let number = 0; number <= Math.max(4, day.max); number++){
        let lesson = day.lessons[number];
        if (!lesson) {
            if (!skipEmpty) formattedLessons.push(
                l('lesson.templates.day.lesson.' + timeKey, {
                    lessonNumber: number + 1,
                    lessonTimes: LESSON_TIMES[number],
                    lessonData: l('lesson.templates.day.missing.' + timeKey)
                }),
            )
            continue;
        };
        let lessonRooms = lesson.rooms.join(', ');
        let lessonType = lesson.types.join(', ');
        let formattedLesson = [
            l('lesson.templates.day.lesson.' + timeKey, {
                lessonNumber: number + 1,
                lessonTimes: LESSON_TIMES[number],
                lessonData: [
                    lessonRooms ? l('lesson.templates.day.rooms', { rooms: lessonRooms }) : '',
                    lessonType ? l('lesson.templates.day.type', { type: lessonType }) : ''
                ].filter(Boolean).join(' · ')
            }),
            lesson.name
        ].join(' - ');
        if (teachers && lesson.teachers.length){
            formattedLesson += '\n';
            formattedLesson += lesson.teachers.map(t => {
                return l('lesson.templates.day.teacher', { teacher: t })
            }).join('\n');
        }
        formattedLessons.push(formattedLesson);
    }
    return formattedLessons.join('\n');
}
export function formatLessonsWeek(week, teachers = false){
    week ?? new Array(7).fill({ count: 0 });
    let formattedDays = [];
    let maxDayToShow = week[5].count ? 5 : 4;
    for (let dayNumber = 0; dayNumber <= maxDayToShow; dayNumber++){
        let day = week[dayNumber];
        let dayText;
        if (!day.count) {
            dayText = l('lesson.templates.week.missing')
        } else {
            dayText = formatLessonsDay(day, false, teachers, true);
        }
        formattedDays.push(
            l('lesson.templates.week.day', { 
                weekday: l('utils.daysNumber.' + dayNumber),
                dayText
            })
        )
    }
    return formattedDays.join('\n\n');
}

export function formatChatSettings(chat, schedule){
    const activeText = (b) => b ? '🔹' : '🔸';
    return l('settings.messages.message', {
        groupText: l(`settings.templates.title.${schedule ? 'withGroup' : 'withoutGroup'}`, {
            groupName: schedule?.name
        }),
        showTeachersText: activeText(!chat.hideTeachers),
        showTimeText: activeText(!chat.hideTime),
        spotLinksText: activeText(!chat.ignoreLinks),
        beforeNotifText: activeText(chat.beforeNotif),
        nowNotifText: activeText(chat.nowNotif),
        hasParentText: chat.parentChatId ? l('settings.templates.hasParent', {
            status: activeText(true)
        }) : ''
    })
}