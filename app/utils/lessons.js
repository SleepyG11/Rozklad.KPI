import moment from 'moment-timezone';

import { calculateLessonDates, getDayIndex, getLessonAndBreak, getLessonNumber, getWeek } from "./times";
import { getWeekend } from "./weekends";

export function getCurrentLesson(schedule = [], date){
    if (!schedule) return { result: null, reason: 'missingSchedule' };
    if (getWeekend(date)) return { result: null, reason: 'weekend' };

    let dayIndex = getDayIndex(date);
    let number = getLessonNumber(date);
    let lesson = schedule[dayIndex].lessons[number] ?? null;
    if (!lesson) return { result: null, reason: 'notFound' };

    let dates = calculateLessonDates(date, number);
    return { date: dates.lessonStart, number, result: lesson };
}
export function getNextLesson(schedule = [], date){
    if (!schedule) return { result: null, reason: 'missingSchedule' };
    if (schedule.every(day => day.count === 0)) return { result: null, reason: 'notFound' };

    let searchDate = moment(date);
    let searchDayIndex = getDayIndex(date);
    let lessonAndBreak = getLessonAndBreak(date);
    let searchNumber = lessonAndBreak.number + Number(!lessonAndBreak.break);
    let searchIsFound = false;

    let isFirstIteration = true;
    let throttler = 14;

    const nextIteration = () => {
        isFirstIteration = false;
        searchDate.add(1, 'd').startOf('d');
        searchDayIndex = (searchDayIndex + 1) % 14;
    }

    while(throttler--){
        let scheduleDay = schedule[searchDayIndex];
        if (scheduleDay.count === 0 || getWeekend(searchDate)){
            nextIteration(); continue;
        }

        if (!isFirstIteration) {
            searchNumber = scheduleDay.min;
            searchIsFound = true;
            break;
        }

        while(searchNumber <= scheduleDay.max){
            if (scheduleDay.lessons[searchNumber]) {
                searchIsFound = true;
                break;
            };
            searchNumber++;
        }
        if (searchIsFound) break;
        nextIteration();
    }

    if (!searchIsFound) return { result: null, reason: 'notFound' };

    let lessonDates = calculateLessonDates(searchDate, searchNumber);
    return {
        date: lessonDates.lessonStart,
        number: searchNumber,
        result: schedule[searchDayIndex].lessons[searchNumber]
    }
}

export function getTodayLessons(schedule = [], date){
    if (!schedule) return { result: null, reason: 'missingSchedule' };
    if (getWeekend(date)) return { result: null, reason: 'weekend' };

    let scheduleDay = schedule[getDayIndex(date)];
    let dayDate =  moment(date).startOf('d');
    return scheduleDay.count
        ? { result: scheduleDay, date: dayDate }
        : { result: null, date: dayDate, reason: 'notFound' };
}
export function getTomorrowLessons(schedule = [], date){
    return getTodayLessons(schedule, moment(date).add(1, 'd'));
}
export function getNextDayLessons(schedule = [], date){
    if (!schedule) return { result: null, reason: 'missingSchedule' };
    if (schedule.every(day => day.count === 0)) return { result: null, reason: 'notFound' };

    let searchDayIndex = getDayIndex(date);
    let searchDate = moment(date);
    let number = getLessonNumber(date);
    if (number !== -1){
        searchDayIndex = (searchDayIndex + 1) % 14;
        searchDate.add(1, 'd');
    }

    let iterationsCount = 100;

    while(iterationsCount--){
        let scheduleDay = schedule[searchDayIndex];
        if (scheduleDay.count !== 0 && !getWeekend(searchDate)) {
            return { result: scheduleDay, date: searchDate.startOf('d') };
        }

        searchDayIndex = (searchDayIndex + 1) % 14;
        searchDate.add(1, 'd');
    } 

    return { result: null, reason: 'notFound' };
}

export function getCurrentWeekLessons(schedule = [], date){
    let week = getWeek(date);
    return {
        date: moment(date).startOf('w').add(1, 'd'),
        result: schedule ? schedule.slice(week * 7, (week + 1) * 7) : null
    }
}
export function getNextWeekLessons(schedule = [], date){
    return getCurrentWeekLessons(schedule, moment(date).add(1, 'w'));
}
export function getFirstWeekLessons(schedule = [], date){
    return getCurrentWeekLessons(schedule, moment(date).add(getWeek(date) === 1, 'w'))
}
export function getSecondWeekLessons(schedule = [], date){
    return getCurrentWeekLessons(schedule, moment(date).add(getWeek(date) === 0, 'w'))
}