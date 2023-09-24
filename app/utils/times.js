import moment from 'moment-timezone';

const LONG_BRAKE_DURATION = 20;
const SHORT_BRAKE_DURATION = 5;
const LESSON_DURATION = 90;
const LESSON_WITH_BRAKES_DURATION = LESSON_DURATION + SHORT_BRAKE_DURATION + LONG_BRAKE_DURATION;
const LESSONS_START_TIME = 490; // 8 * 60 + 10, 8:10

const FIRST_LESSON = {
    BREAK_START: { h: 8, m: 10, s: 0, ms: 0 },
    LESSON_START: { h: 8, m: 30, s: 0, ms: 0 },
    LESSON_END: { h: 10, m: 5, s: 0, ms: 0 }
}
const SIXTH_LESSON = {
    BREAK_START: { h: 17, m: 45, s: 0, ms: 0 },
    LESSON_START: { h: 18, m: 30, s: 0, ms: 0 },
    LESSON_END: { h: 20, m: 5, s: 0, ms: 0 }
}

const WEEK_START_DATE = moment(0).add(4, 'd').startOf('d');

function onRange(min, value, max){
    return value >= min && value <= max
}
function getElapsedMinutes(date){
    let inputDate = moment(date);
    return inputDate.diff(inputDate.clone().startOf('day'), 'm') - LESSONS_START_TIME
}

export function calculateDayIndex(week, day){
    return day + 7 * week;
}
export function calculateLessonDates(date, number){
    let inputDate = moment(date);
    if (number === 5) return {
        breakStart: inputDate.clone().set(SIXTH_LESSON.BREAK_START),
        lessonStart: inputDate.clone().set(SIXTH_LESSON.LESSON_START),
        lessonEnd: inputDate.clone().set(SIXTH_LESSON.LESSON_END),
        isDayStart: false,
        isDayEnd: false
    }
    if (number > 5) return {
        breakStart: inputDate.clone().set(SIXTH_LESSON.LESSON_END),
        lessonStart: inputDate.clone().set(SIXTH_LESSON.LESSON_END),
        lessonEnd: inputDate.clone().endOf('day'),
        isDayStart: false,
        isDayEnd: true
    }
    if (number < 0) return {
        breakStart: inputDate.clone().startOf('day'),
        lessonStart: inputDate.clone().startOf('day'),
        lessonEnd: inputDate.clone().set(FIRST_LESSON.BREAK_START),
        isDayStart: false,
        isDayEnd: true
    }
    return {
        breakStart: inputDate.clone().set({ h: 0, m: LESSONS_START_TIME + LESSON_WITH_BRAKES_DURATION * number, s: 0, ms: 0 }),
        lessonStart: inputDate.clone().set({ h: 0, m: LESSONS_START_TIME + LESSON_WITH_BRAKES_DURATION * number + LONG_BRAKE_DURATION, s: 0, ms: 0 }),
        lessonEnd: inputDate.clone().set({ h: 0, m: LESSONS_START_TIME + LESSON_WITH_BRAKES_DURATION * (number + 1), s: 0, ms: 0 }),
        isDayStart: false,
        isDayEnd: false
    }
}

export function getSemester(date, invert = false){
    return onRange(2, moment(date).month(), 7) ^ invert;
}

export function getWeek(date, invert = false){
    return moment(date).diff(WEEK_START_DATE, 'w') % 2 ^ invert;
}

export function getDay(date){
    return moment(date).weekday();
}
export function getDayIndex(date, invert = false){
    return calculateDayIndex(getWeek(date, invert), getDay(date));
}

export function getLessonNumber(date){
    let inputDate = moment(date);
    let clonedInput = inputDate.clone();
    if (inputDate.isBefore(clonedInput.set(FIRST_LESSON.BREAK_START))) return -1;
    if (inputDate.isSameOrAfter(clonedInput.set(SIXTH_LESSON.LESSON_END))) return 6;
    if (inputDate.isSameOrAfter(clonedInput.set(SIXTH_LESSON.BREAK_START))) return 5;
    return Math.floor(getElapsedMinutes(date) / LESSON_WITH_BRAKES_DURATION); 
}
export function getBreak(date){
    let inputDate = moment(date);
    if (!inputDate.isBetween(
        inputDate.clone().set(FIRST_LESSON.BREAK_START), 
        inputDate.clone().set(SIXTH_LESSON.LESSON_START), 
        'ms', '()'
    )) return false;
    if (inputDate.isSameOrAfter(inputDate.clone().set(SIXTH_LESSON.BREAK_START))) return true;
    return getElapsedMinutes(date) % LESSON_WITH_BRAKES_DURATION < LONG_BRAKE_DURATION;
}
export function getLessonAndBreak(date){
    let inputDate = moment(date);
    let clonedDate = inputDate.clone();
    if (inputDate.isBefore(clonedDate.set(FIRST_LESSON.BREAK_START))) return { number: -1, break: false };
    if (inputDate.isSameOrAfter(clonedDate.set(SIXTH_LESSON.LESSON_END))) return { number: 6, break: false };
    if (inputDate.isSameOrAfter(clonedDate.set(SIXTH_LESSON.BREAK_START))) return {
        number: 5,
        break: inputDate.isBefore(clonedDate.set(SIXTH_LESSON.LESSON_START))
    };
    let elapsedMinutes = getElapsedMinutes(date);
    return {
        number: Math.floor(elapsedMinutes / LESSON_WITH_BRAKES_DURATION),
        break: elapsedMinutes % LESSON_WITH_BRAKES_DURATION < LONG_BRAKE_DURATION,
    }
}

export function getLessonDates(date){
    return calculateLessonDates(date, getLessonNumber(date));
}
export function getLessonParams(date){
    let lessonAndBreak = getLessonAndBreak(date);
    let week = getWeek(date);
    let day = getDay(date);
    return {
        semester: getSemester(date), week, day,
        index: calculateDayIndex(week, day),
        ...lessonAndBreak,
        ...calculateLessonDates(date, lessonAndBreak.number),
    }
}