import moment from "moment-timezone";

export function getWeekend(date){
    let inputDate = moment(date);
    switch(inputDate.month() + 1){
        case 1: return 'Зимова сессія';
        case 6: return 'Літня сессія';
        case 7:
        case 8: return 'Літні канікули';
        default: break;
    }
    return null;
}
