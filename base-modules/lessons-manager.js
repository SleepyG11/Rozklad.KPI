const moment = require('moment-timezone');
const path = require('path');
const ejs = require('ejs');
function now(...args){ return moment(...args).tz('Europe/Kiev') };
function onRange(min, value, max){ return value >= min && value <= max };
function clamp(min, value, max){ return Math.max(min, Math.min(max, value)) };

const ChatsManager = require('./chats-manager');

class LessonsManager{
    constructor(){
        this.dayLocales = {
            name: [
                'Понеділок',
                'Вівторок',
                'Середа',
                'Четвер',
                'П\'ятниця',
                'Субота',
                'Неділя'
            ],
            on: [
                'Понеділок',
                'Вівторок',
                'Середу',
                'Четвер',
                'П\'ятницю',
                'Суботу',
                'Неділю'
            ],
            when: [
                'Понеділка',
                'Вівторка',
                'Середи',
                'Четверга',
                'П\'ятниці',
                'Суботи',
                'Неділі'
            ]
        } 
        this.weekLocales = {
            name: [
                'Перший тиждень',
                'Другий тиждень'
            ],
            on: [
                'Першому тижні',
                'Другому тижні'
            ],
            when: [
                'Першого тижня',
                'Другого тижня'
            ]
        }
        this.monthLocales = {
            name: [
                'Січень',
                'Лютий',
                'Березень',
                'Квітень',
                'Травень',
                'Червень',
                'Липень',
                'Серпень',
                'Вересень',
                'Жовтень',
                'Листопад',
                'Грудень'
            ],
            on: [
                'Січні',
                'Лютому',
                'Березні',
                'Квітні',
                'Травні',
                'Червні',
                'Липні',
                'Серпні',
                'Вересні',
                'Жовтні',
                'Листопаді',
                'Грудні'
            ],
            when: [
                'Січня',
                'Лютого',
                'Березня',
                'Квітня',
                'Травня',
                'Червня',
                'Липня',
                'Серпня',
                'Вересня',
                'Жовтня',
                'Листопада',
                'Грудня'
            ],
        }

        this.invertedWeek = false;

        this.shufflesRawData = require('../json-data/shuffles-data.json');
        this.weekendsRawData = require('../json-data/weekends-data.json');

        this.decrement = 115;
        this.offset = 8 * 60 + 10;

        this.lessonIntervals = [
            '08:30 - 10:05',
            '10:25 - 12:00',
            '12:20 - 13:55',
            '14:15 - 15:50',
            '16:10 - 17:45',
            '18:30 - 20:05'
        ]

        this.getters = {
            current: (...args) => this.getCurrentLesson(...args),
            next: (...args) => this.getNextLesson(...args),

            today: (...args) => this.getTodayLessons(...args),
            tomorrow: (...args) => this.getTomorrowLessons(...args),
            nextday: (...args) => this.getNextdayLessons(...args),

            week_current: (...args) => this.getCurrentWeekLessons(...args),
            week_next: (...args) => this.getNextWeekLessons(...args),

            week_first: (...args) => this.getFirstWeekLessons(...args),
            week_second: (...args) => this.getSecondWeekLessons(...args),
        }
    }

    localizeDay(day){
        let d = clamp(0, day, 6);
        return {
            name: this.dayLocales.name[d],
            on: this.dayLocales.on[d],
            when: this.dayLocales.when[d]
        }
    }
    localizeWeek(week){
        let w = clamp(0, week, 1);
        return {
            name: this.weekLocales.name[w],
            on: this.weekLocales.on[w],
            when: this.weekLocales.when[w]
        }
    }
    localizeMonth(month){
        let m = clamp(0, month, 11);
        return {
            name: this.monthLocales.name[m],
            on: this.monthLocales.on[m],
            when: this.monthLocales.when[m]
        }
    }

    dateDefinition(date){
        let int = date - now()
        if (int < 0) return 'Помилка!'
        if (int < 60000) return 'Ось-ось почнеться'
        if (int < 3600000){
            let m = Math.round(int / 60000);
            if (String(m).match(/1[0-9]$/)) return 'Через ' + m + ' хвилин';
            switch(m % 10){
                case 1: return 'Через ' + m + ' хвилину';
                case 2: case 3: case 4: return 'Через ' + m + ' хвилини';
                default: return 'Через ' + m + ' хвилин';
            }
        }
        if (int < 86400000 * 1.5){
            let h = Math.floor(int / 3600000);
            let m = Math.floor((int - h*3600000)/60000);
            if (m === 0) m = '';
            else if (String(m).match(/1[0-9]$/)) m += ' хвилин';
            else{
                switch(m % 10){
                    case 1: m += ' хвилину'; break;
                    case 2: case 3: case 4: m += ' хвилини'; break;
                    default: m += ' хвилин'; break;
                }
            }
            if (String(h).match(/1[0-9]$/)) h += ' годин';
            else{
                switch(h % 10){
                    case 1: h += ' годину'; break;
                    case 2: case 3: case 4: h += ' години'; break;
                    default: h += ' годин'; break;
                }
            }
            return 'Через ' + h + ' ' + m;
        }
        else{
            let days = Math.round(int / 86400000);
            if (String(days).match(/1[0-9]$/)) return 'Через ' + days + ' днів';
            switch(days % 10){
                case 1: return 'Через ' + days + ' день'
                case 2: case 3: case 4: return 'Через ' + days + ' дні';
                default: return 'Через ' + days + ' днів';
            }
        }
    }
    getLessonInterval(lesson){
        return this.lessonIntervals[lesson];
    }

    // ---------------------------

    getDateWeek(date, invert){
        return Math.floor(((now(date).unix() - 1524344400 - 86400) / 604800) % 2) ^ this.invertedWeek ^ invert;
    }

    getLessonDates(lesson, date){
        let d = now(date);
        if (lesson < 0) return {
            date: d,
            breakStart: d.clone().startOf('day'),
            lessonStart: d.clone().startOf('day'),
            lessonEnd: d.clone().set({ h: 8, m: 10, s: 0, ms: 0 }),
            isDayStart: true,
            isDayEnd: false
        };
        if (lesson > 6) return {
            date: d,
            breakStart: d.clone().set({ h: 20, m: 5, s: 0, ms: 0 }),
            lessonStart: d.clone().set({ h: 20, m: 5, s: 0, ms: 0 }),
            lessonEnd: d.clone().endOf('day'),
            isDayStart: false,
            isDayEnd: true
        }
        if (lesson == 6) return {
            date: d,
            breakStart: d.clone().set({ h: 17, m: 45, s: 0, ms: 0 }),
            lessonStart: d.clone().set({ h: 18, m: 30, s: 0, ms: 0 }),
            lessonEnd: d.clone().set({ h: 20, m: 5, s: 0, ms: 0 }),
            isDayStart: false,
            isDayEnd: false
        }
        return {
            date: d,
            breakStart: d.clone().set({ h: 0, m: this.offset + this.decrement * lesson, s: 0, ms: 0 }),
            lessonStart: d.clone().set({ h: 0, m: this.offset + this.decrement * lesson + 20, s: 0, ms: 0 }),
            lessonEnd: d.clone().set({ h: 0, m: this.offset + this.decrement * (lesson + 1), s: 0, ms: 0 }),
            isDayStart: false,
            isDayEnd: false
        }
    }
    getLessonNumberAndBreak(date){
        let d = now(date);
        let lesson = -1;
        let isBreak = false;
        // До 8:10 пар нет = -1
        if (d.isBefore(d.clone().set({ h: 8, m: 10, s: 0, ms: 0 }))) {
            lesson = -1;
            isBreak = false;
        }
        // С 8:10 до 17:45 отнимаем от всех минут время начало первой пары и делим на продолжительность
        else if (d.isBetween(d.clone().set({ h: 8, m: 10, s: 0, ms: 0 }), d.clone().set({ h: 17, m: 45, s: 0, ms: 0 }), 's', '[)')){
            let rawNumber = d.diff(d.clone().set({h: 0, m: 0, s: 0, ms: 0}), 'm') - this.offset;
            lesson = Math.floor(rawNumber / this.decrement);
            isBreak = rawNumber % this.decrement < 20;
        }
        // 6 пара хардкод
        else if (d.isBetween(d.clone().set({ h: 17, m: 45, s: 0, ms: 0 }), d.clone().set({ h: 20, m: 5, s: 0, ms: 0 }), 's', '[)')){
            lesson = 6;
            isBreak = d.isBetween(d.clone().set({h: 17, m: 45, s: 0, ms: 0 }), d.clone().set({h: 18, m: 30, s: 0, ms: 0 }), 's', '[)');
        // После 6 пары ничего нет
        } else {
            lesson = 7;
            isBreak = false;
        }
        return {
            lesson, isBreak
        }
    }
    /**
     * @returns {String | null}
     */
    getWeekend(date){
        let d = now(date);
        let weekend = this.weekendsRawData.days[d.format('DD.MM')] || null;
        if (!weekend){
            for (let range in this.weekendsRawData.ranges){
                let [start, end] = range.split(' - ');
                if (d.isSameOrAfter(now(start, 'DD.MM'), 'day')){
                    if (d.isSameOrBefore(now(end, 'DD.MM'), 'day')) weekend = this.weekendsRawData.ranges[range];
                    break;
                }
            }
        }
        return weekend;
    }
    getShuffle(date){
        let d = now(date);
        return this.shufflesRawData[d.format('DD.MM')] || null;
    }
    getLessonParams(lesson, date, invert = false){
        let d = now(date);

        let month = d.month();
        let week = this.getDateWeek(d, invert);
        let day = (6 + d.weekday()) % 7;

        let lessonNumberData = lesson !== null && !isNaN(lesson) ? {
            lesson: clamp(-1, lesson, 7),
            isBreak: false
        } : this.getLessonNumberAndBreak(d);

        let shuffle = this.getShuffle(d);
        let lessonMonth = shuffle ? shuffle.month : month;
        let lessonWeek = (shuffle ? week ^ shuffle.invert : week);
        let lessonDay = shuffle ? shuffle.day : day;
        let dayIndex = lessonDay + 7 * lessonWeek;

        let weekend = this.getWeekend(d);

        return {
            month, week, day, lessonMonth, lessonWeek, lessonDay, dayIndex,
            isShuffle: shuffle !== null, shuffle, isWeekend: weekend !== null, weekend,
            resultIsWeekend: weekend !== null && shuffle === null,
            ...lessonNumberData,
            ...this.getLessonDates(lessonNumberData.lesson, d)
        }
    }

    findNextLessonParams(scheduleData, date, invert = false){
        // Если здесь не массив расписания - ничего не возвращаем.
        if (!Array.isArray(scheduleData) || scheduleData.length !== 14) return null;
        // Если в нём нет ни одной пары, то его нет смысла итерировать - ничего не возвращаем.
        if (scheduleData.every(day => day.meta.count === 0)) return null;

        let d = now(date);

        let currentDate = d.clone();
        let week = this.getDateWeek(d, invert);
        let day = (6 + d.weekday()) % 7;
        let dayIndex = day + 7 * week;
        let { lesson, isBreak } = this.getLessonNumberAndBreak(d);
        let isStartIteration = true;
        let throttler = 14 * 6; // Обрабатываем не более 12 недель.
        while(throttler--){
            const stop = () => {
                isStartIteration = false;
                currentDate = currentDate.add(1, 'day').startOf('day');
                dayIndex = (dayIndex + 1) % 14;
                week = Math.floor(dayIndex / 7);
            }
            // Смотрим, есть ли перенос. Если есть - корректируем искомый индекс.
            let shuffle = this.getShuffle(currentDate);
            let resultDayIndex = shuffle ? (shuffle.day + 7 * (week ^ shuffle.invert)) : dayIndex;
            // Получаем день, в котором ищем пары
            let scheduleDay = scheduleData[resultDayIndex];
            // Если пар нет либо это выходной без замен, то идём дальше
            if (scheduleDay.meta.count === 0 || (!shuffle && this.getWeekend(currentDate))) {
                stop(); continue;
            };
            // Если это первая итерация, смотрим следующие пары на сегодня.
            if (isStartIteration){
                // Если щас перерыв - убираем его, иначе берём следующую пару.
                isBreak ? isBreak = false : lesson++;
                // Ищем пару, которые остались на сегодня, но не более 6
                while (lesson <= 6 && lesson <= scheduleDay.meta.max){
                    // Если есть - отлично! Возвращаем её.
                    if (scheduleDay[lesson]) return this.getLessonParams(lesson, currentDate, invert);
                    lesson++;
                }
                // Не нашли - значит сегодня пар уже нет. Идём дальше.
                stop(); continue;
            }
            // Количество пар больше чем 0, выходных нет. Значит, берём самую первую и возвращаем её.
            return this.getLessonParams(scheduleDay.meta.min, currentDate, invert);
        }
        // За все итерации ничего не нашли.
        return null;
    }

    // ---------------------------

    getCurrentLesson(scheduleData, date, invert){
        let lessonParams = this.getLessonParams(null, date, invert);
        return {
            name: scheduleData.name,
            faculty: scheduleData.faculty,
            lesson: scheduleData.schedule?.[lessonParams.dayIndex]?.[lessonParams.lesson] || null,
            params: lessonParams,
            nextParams: lessonParams
        }
    }
    getNextLesson(scheduleData, date, invert){
        let lessonParams = this.getLessonParams(null, date, invert);
        let nextLessonParams = this.findNextLessonParams(scheduleData.schedule, date, invert);
        if (nextLessonParams) return {
            name: scheduleData.name,
            faculty: scheduleData.faculty,
            lesson: scheduleData.schedule?.[nextLessonParams.dayIndex]?.[nextLessonParams.lesson] || null,
            params: lessonParams,
            nextParams: nextLessonParams
        }
        return {
            name: scheduleData.name,
            faculty: scheduleData.faculty,
            lesson: null,
            params: lessonParams,
            nextParams: null
        }
    }

    getTodayLessons(scheduleData, date, invert){
        let lessonParams = this.getLessonParams(null, date, invert);
        return {
            name: scheduleData.name,
            faculty: scheduleData.faculty,
            lessons: scheduleData.schedule?.[lessonParams.dayIndex],
            params: lessonParams,
            nextParams: lessonParams
        }
    }
    getTomorrowLessons(scheduleData, date, invert){
        let lessonParams = this.getLessonParams(null, date, invert);
        let nextParams = this.getLessonParams(null, now(date).add(1, 'day').startOf('day'), invert);
        return {
            name: scheduleData.name,
            faculty: scheduleData.faculty,
            lessons: scheduleData.schedule?.[nextParams.dayIndex],
            params: lessonParams,
            nextParams
        }
    }
    getNextdayLessons(scheduleData, date, invert){
        let lessonParams = this.getLessonParams(null, date, invert);
        let nextLessonParams = lessonParams.isDayStart ?
            this.findNextLessonParams(scheduleData.schedule, date, invert) :
            this.findNextLessonParams(scheduleData.schedule, now(date).add(1, 'day').startOf('day'), invert);
        if (nextLessonParams) return {
            name: scheduleData.name,
            faculty: scheduleData.faculty,
            lessons: scheduleData.schedule?.[nextLessonParams.dayIndex],
            params: lessonParams,
            nextParams: nextLessonParams,
        }
        return {
            name: scheduleData.name,
            faculty: scheduleData.faculty,
            lessons: null,
            params: lessonParams,
            nextParams: null,
        }
    }

    getCurrentWeekLessons(scheduleData, date, invert){
        let lessonParams = this.getLessonParams(null, date, invert);
        return {
            name: scheduleData.name,
            faculty: scheduleData.faculty,
            lessons: scheduleData.schedule?.slice(7 * lessonParams.lessonWeek, 7 + 7 * lessonParams.lessonWeek),
            params: lessonParams,
            nextParams: lessonParams
        }
    }
    getNextWeekLessons(scheduleData, date, invert){
        let lessonParams = this.getLessonParams(null, date, invert);
        let nextParams = this.getLessonParams(null, now(date).add(1, 'week'), invert);
        return {
            name: scheduleData.name,
            faculty: scheduleData.faculty,
            lessons: scheduleData.schedule?.slice(7 * nextParams.lessonWeek, 7 + 7 * nextParams.lessonWeek),
            params: lessonParams,
            nextParams
        }
    }

    getFirstWeekLessons(scheduleData, date, invert){
        let week = this.getDateWeek(date, invert);
        if (week === 0) return this.getCurrentWeekLessons(scheduleData, date, invert);
        return this.getNextWeekLessons(scheduleData, date, invert);
    }
    getSecondWeekLessons(scheduleData, date, invert){
        let week = this.getDateWeek(date, invert);
        if (week === 1) return this.getCurrentWeekLessons(scheduleData, date, invert);
        return this.getNextWeekLessons(scheduleData, date, invert);
    }

    // ---------------------------

    async buildMessage(command, schedule, chatData, hideTeachers, hideTime){
        let getter = this.getters[command](schedule);
        let renderObject = {
            schedule: getter, chat: chatData, links: null,
            params: { hideTeachers, hideTime, currentWeek: this.getDateWeek() },
            localizer: {
                day: i => this.localizeDay(i),
                week: i => this.localizeWeek(i),
                month: i => this.localizeMonth(i),
                diff: i => this.dateDefinition(i),
                interval: i => this.getLessonInterval(i)
            }
        }
        const render = async (file, buttons, hash) => {
            renderObject.links = hash ? await ChatsManager.getLessonLinksFrom(chatData, getter.lesson.hash) : null;
            let text = await ejs.renderFile(path.join(__dirname, file), renderObject);
            return { text, inline_keyboard: buttons || undefined }
        }
        switch (command){
            case 'current': {
                if (getter.params.resultIsWeekend) return render(
                    '../views/lessons/weekend/current.ejs',
                    [[{ text: 'Наступна пара', callback_data: 'next?hTime=' +hideTime+ '&uuid=' + schedule.uuid }]]
                )
                if (!getter.lesson) return render(
                    '../views/lessons/not-found/current.ejs',
                    [[{ text: 'Наступна пара', callback_data: 'next?hTime=' +hideTime+ '&uuid=' + schedule.uuid }]]
                )
                return render('../views/lessons/current.ejs', null, getter.lesson.hash);
            }
            case 'next': {
                if (!getter.nextParams) return render('../views/lessons/not-found/next.ejs', null)
                return render('../views/lessons/next.ejs', null, getter.lesson.hash);
            }
            case 'today':
            case 'tomorrow': {
                if (getter.nextParams.resultIsWeekend) return render(
                    '../views/lessons/weekend/' +command+ '.ejs',
                    [[{ text: 'Наступний робочий день', callback_data: 'nextday?uuid=' + schedule.uuid }]]
                )
                if (getter.lessons.meta.count === 0) return render(
                    '../views/lessons/not-found/' +command+ '.ejs',
                    [[{ text: 'Наступний робочий день', callback_data: 'nextday?uuid=' + schedule.uuid }]]
                );
                return render('../views/lessons/' +command+ '.ejs', null);
            }
            case 'nextday': {
                if (!getter.nextParams) return render('../views/lessons/not-found/nextday.ejs', null);
                return render('../views/lessons/nextday.ejs', null);
            }
            case 'week_current':
            case 'week_next':
            case 'week_first':
            case 'week_second': {
                // Текущая, альтернативная
                let commands = ['week_first', 'week_second'];
                if (getter.nextParams.week === 1) commands.reverse();
                let teachersToggleButton = { 
                    text: hideTeachers ? 'Показати вчителів' : 'Приховати вчителів',
                    callback_data: commands[0] + '?hTch=' + !hideTeachers + '&uuid=' + schedule.uuid
                };
                let nextToggleButton = {
                    text: commands[1] === 'week_first' ? 'Перший тиждень' : 'Другий тиждень',
                    callback_data: commands[1] + '?hTch=' + hideTeachers + '&uuid=' + schedule.uuid
                };
                let resultButtons = [nextToggleButton, teachersToggleButton];
                let fullText = await ejs.renderFile(path.join(__dirname, '../views/lessons/week.ejs'), renderObject);
                if (fullText.length > 4096 + 7 + 5 * 5 * 21){ // Максимум + оглавление тэга + 5 дней по 5 пар с их форматированием, без учёта учителей
                    renderObject.params.hideTeachers = true;
                    resultButtons.pop();
                    fullText = await ejs.renderFile(path.join(__dirname, '../views/lessons/week.ejs'),  renderObject);
                }
                if (fullText.length > 4096 + 7 + 5 * 5 * 21){
                    return render('../views/lessons/too-long-week.ejs', null)
                }
                return render('../views/lessons/week.ejs', [resultButtons])
            }
        }
    }
}

module.exports = new LessonsManager();