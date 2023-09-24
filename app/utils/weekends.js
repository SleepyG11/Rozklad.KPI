import moment from "moment-timezone";

export function getWeekend(date){
    let inputDate = moment(date);
    switch(inputDate.month()){
        case 0: return 'Зимова сессія';
        case 5: return 'Літня сессія';
        case 6:
        case 7: return 'Літні канікули';
        default: break;
    }
    return null;
}
