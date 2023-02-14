const fetch = require('node-fetch');
const moment = require('moment-timezone');
const pg = require('./database');
const fs = require('fs');
const crypto = require('crypto');

class SchedulesManager{
    constructor(){
        this.rawList = null;
        this.rawListDictionary = new Map();
        this.rawListUpdate = moment(0);
        setImmediate(() => {
            this.getRawListFromDatabase();
        })

        this.rawSchedule = new Map();
        this.rawScheduleClearTimers = {};

        this.lessonTimeNumbers = {
            '8.30': 0,
            '10.25': 1,
            '12.20': 2,
            '14.15': 3,
            '16.10': 4,
            '18.30': 5,
        }
    }

    processSiteScheduleDayLessons(lessons){
        let dayLessons = {
            meta: {
                min: -1, max: -1, count: 0
            }
        };
        let itemsToProcess = [];
        lessons.forEach(lesson => {
            if (lesson.place){
                lesson.place = lesson.place.split('-').reverse().join('-') || '';
            }
            let lessonNumber = this.lessonTimeNumbers[lesson.time];
            let groupedLesson = dayLessons[lessonNumber];
            if (!groupedLesson) {
                dayLessons.meta.count++;
                if (dayLessons.meta.min === -1){
                    dayLessons.meta.min = lessonNumber;
                } else {
                    dayLessons.meta.min = Math.min(dayLessons.meta.min, lessonNumber);
                }
                dayLessons.meta.max = Math.max(dayLessons.meta.max, lessonNumber);
                let newItem = {
                    name: new Set(),
                    teachers: new Set(),
                    type: new Set(),
                    cabinets: new Set()
                }
                itemsToProcess.push(newItem);
                groupedLesson = dayLessons[lessonNumber] = newItem;
            }
            if (lesson.name) groupedLesson.name.add(lesson.name)
            if (lesson.teacherName) groupedLesson.teachers.add(lesson.teacherName)
            if (lesson.type) groupedLesson.type.add(lesson.type)
            if (lesson.place) groupedLesson.cabinets.add(lesson.place)
        })
        itemsToProcess.forEach(i => {
            i.name = Array.from(i.name);
            i.cabinets = Array.from(i.cabinets);
            i.type = Array.from(i.type);
            i.teachers = Array.from(i.teachers);
            i.hash = crypto.createHash('md5').update(i.name.concat(i.cabinets, i.type, i.teachers).sort().join(':')).digest('hex');
        })
        return dayLessons;
    }
    processSiteSchedule(first, second){
        let scheduleArray = new Array(14).fill().map(() => {
            return { meta: { min: -1, max: -1, count: 0 } }
        });
        for (let i = 0; i < first.length; i++){
            scheduleArray[i] = this.processSiteScheduleDayLessons(first[i].pairs);
        }
        for (let j = 0; j < second.length; j++){
            scheduleArray[j + 7] = this.processSiteScheduleDayLessons(second[j].pairs);
        }
        fs.writeFileSync('./schedule-response.json', JSON.stringify(scheduleArray, null, '\t'), 'utf-8');
        return scheduleArray;
    }

    async getRawListFromDatabase(){
        let result = await pg.query('SELECT * FROM groups');
        this.rawList = result.rows;
        this.rawListDictionary.clear();
        this.rawList.forEach(item => {
            this.rawListDictionary.set(item.uuid, item);
        })
        return this.rawList;
    }
    async getRawList(){
        if (this.rawList && this.rawListUpdate.isAfter(moment().add(-6, 'hour'))) return this.rawList;
        try {
            let response = await fetch('https://schedule.kpi.ua/api/schedule/groups');
            let body = await response.json();
            this.rawListDictionary.clear();
            this.rawList = body.data.map(listItem => {
                listItem.uuid = listItem.id;
                delete listItem.id;
                this.rawListDictionary.set(listItem.uuid, listItem);
                return listItem;
            });
        } catch(e) {
            if (this.rawList) return this.rawList;
            throw e;
        }
        let insertStatement = Object.values(this.rawList).map(listItem => {
            return '(' + [pg.escapeLiteral(listItem.uuid), pg.escapeLiteral(listItem.name), pg.escapeLiteral(listItem.faculty || '')].join(',') + ')';
        }).join(',');
        pg.query(`
            TRUNCATE groups;
            INSERT INTO groups VALUES ${insertStatement};
        `).catch(() => {})
        return this.rawList;
    }

    async searchGroups(groupName){
        let targetGroupName = String(groupName).toLowerCase();
        let list = await this.getRawList();
        return list.filter(groupData => groupData.name.toLowerCase().indexOf(targetGroupName) > -1);
    }
    async getGroup(uuid){
        await this.getRawList();
        return this.rawListDictionary.get(uuid) || null;
    }

    async getSchedule(uuid){
        let scheduleData = this.rawSchedule.get(uuid);
        if (scheduleData) return scheduleData;
        try {
            let siteResponse = await fetch('https://schedule.kpi.ua/api/schedule/lessons?groupId=' + uuid);
            if (siteResponse.status === 500) {
                // Такого расписания нет, а значит его можно удалять
                pg.query('DELETE FROM schedules * WHERE uuid = $1', [uuid]).catch(() => {});
                clearTimeout(this.rawScheduleClearTimers[uuid]);
                this.rawSchedule.delete(uuid);
                return null;
            }
            let siteData = await siteResponse.json();
            let listData = this.rawListDictionary.get(uuid);
            scheduleData = {
                name: listData.name, faculty: listData.faculty,
                uuid: siteData.data.groupCode,
                schedule: this.processSiteSchedule(siteData.data.scheduleFirstWeek, siteData.data.scheduleSecondWeek),
                last_update_timestamp: new Date()
            }
            pg.query(`
                INSERT INTO schedules (uuid, schedule, name, faculty, last_update_timestamp) VALUES ($1, $2, $3, $4, now())
                ON CONFLICT (uuid) DO UPDATE SET (schedule, name, faculty, last_update_timestamp) = ($2, $3, $4, now())`,
            [scheduleData.uuid, scheduleData.schedule, scheduleData.name, scheduleData.faculty]).catch(() => {});
        } catch (e){
            let databaseResult = await pg.query('SELECT * FROM schedules WHERE uuid = $1 LIMIT 1', [uuid]);
            if (!databaseResult.rowCount) return null;
            scheduleData = databaseResult.rows.shift();
        }
        clearTimeout(this.rawScheduleClearTimers[uuid]);
        this.rawSchedule.set(uuid, scheduleData);
        this.rawScheduleClearTimers[uuid] = setTimeout(() => {
            this.rawSchedule.delete(uuid);
        }, 1000 * 60 * 60 * 24);
        return scheduleData;
    }
}

module.exports = new SchedulesManager();