import parser, { NodeType } from 'node-html-parser';
import { Op } from 'sequelize';
import { createHash } from 'crypto';
import fetch from 'node-fetch';
import _ from 'lodash';

import db, { Names, Schedules } from '../database/index.js';

import CacheMap from '../utils/cache.js';
import { getSemester } from '../utils/times.js';
import { formatGroupName } from '../utils/format.js';

const LESSON_TYPE_REGEXP = /(?:Лек|Прак|Лаб)(?: on-line)?/;
const PARSER_OPTIONS = {
    lowerCaseTagName: true,
    blockTextElements: {
        script: true,
        noscript: true,
        style: true,
        pre: true
    }
}

export default class SchedulesManager{
    constructor(client){
        this.client = client;

        this.scheduleCache = new CacheMap(7200);
        this.dataCache = new CacheMap(7200);

        this.scheduleQueues = new Map();
        this.nameQueues = new Map();
        this.dataQueues = new Map();
    }

    getSearchGroupsNameRequest(name = ''){
        return fetch(process.env.ROZKLAD_HOST + '/Schedules/ScheduleGroupSelection.aspx/GetGroups', {
            signal: AbortSignal.timeout(2000),
            method: 'POST',
            headers: {
                "accept": "*/*",
                "accept-language": "ru,uk;q=0.9,en;q=0.8,de;q=0.7,cy;q=0.6",
                "content-type": "application/json; charset=UTF-8",
                "x-requested-with": "XMLHttpRequest"
            },
            referrer: process.env.ROZKLAD_HOST + "/Schedules/ScheduleGroupSelection.aspx",
            body: JSON.stringify({
                count: 10,
                prefixText: name
            }),
        })
    }
    getSearchGroupsDataRequest(name = ''){
        return fetch(process.env.ROZKLAD_HOST + '/Schedules/ScheduleGroupSelection.aspx', {
            signal: AbortSignal.timeout(2000),
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            redirect: 'manual',
            body: "__EVENTTARGET=&__EVENTARGUMENT=&ctl00%24MainContent%24ctl00%24txtboxGroup="
                + encodeURIComponent(name) + "&ctl00%24MainContent%24ctl00%24btnShowSchedule="
                + "%D0%A0%D0%BE%D0%B7%D0%BA%D0%BB%D0%B0%D0%B4+%D0%B7%D0%B0%D0%BD%D1%8F%D1%82%D1%8C"
                + "&__EVENTVALIDATION="
                + "%2FwEdAAEAAAD%2F%2F%2F%2F%2FAQAAAAAAAAAPAQAAAAUAAAAIfnh9f5bbIy4PQ8Jq1niwJHcI6P4LAAAAAAAAAAAAAAAAAAAA"
                + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
                + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
                + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB3Hmp78W6cbqrRkJx89ZeA1yxRReRoCDoAthW3PC2yi"
        }) 
    }
    getSearchGroupScheduleRequest(uuid = ''){
        return fetch(process.env.ROZKLAD_HOST + '/Schedules/ViewSchedule.aspx?g=' + uuid, {
            signal: AbortSignal.timeout(4000),
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: "__EVENTTARGET=ctl00%24MainContent%24ddlSemesterType&"
                + "__EVENTARGUMENT=&ctl00%24MainContent%24ddlSemesterType="
                + (getSemester() + 1)
                + "&__EVENTVALIDATION="
                + "%2FwEdAAEAAAD%2F%2F%2F%2F%2FAQAAAAAAAAAPAQAAAAYAAAAIfnh9f5bbIy4PQ8JqW3xrSoDyNXd7VaUNCwAAAAAAAAAAAAAA"
                + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
                + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
                + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjqJnmeNOOGAtuCs8%2BcZ4hH6A73j3FZ4n3IVRLHK7qr"

        })
    }

    /**
     * @param {string} name 
     * @param {'api' | 'database'} mode 
     * @returns {Promise<import('../database/models/name').Name[]>}
     */
    async searchGroupsName(name, mode = 'api'){
        name = formatGroupName(name);
        switch(mode){
            case 'database': {
                return await Names.findAll({
                    where: { name: { [Op.iLike]: name + '%' } },
                    order: [['name', 'ASC']]
                })
            }
            case 'api': {
                let body;
                try {
                    body = await this.getSearchGroupsNameRequest(name).then(r => r.json());
                } catch(e){
                    return await this.searchGroupsName(name, 'database');
                }
                if (!body || !body.d) return [];
                let result = await Names.bulkCreate(body.d.map(name => ({ name })), {
                    returning: true,
                    fields: ['name'],
                    updateOnDuplicate: ['name'],
                })
                return result.sort((a, b) => a.name.localeCompare(b, 'ua', { sensitivity: 'base' }));
            }
            default: return [];
        }
    }
    /**
     * @param {string} name 
     * @param {'api' | 'database' | 'cache'} mode 
     * @returns {Promise<import('../database/models/schedule').Schedule[]>}
     */
    async searchGroupsData(name, mode = 'api'){
        name = formatGroupName(name);
        switch(mode){
            case 'database': {
                return await Schedules.findAll({
                    where: { [Op.or]: { parent: name, name } },
                    order: [['name', 'ASC']],
                    attributes: {
                        exclude: ['data'],
                        include: ['uuid', 'name', 'parent', 'createdAt', 'updatedAt']
                    }
                })
            }
            case 'cache': {
                return this.dataCache.get(name) || null;
            }
            case 'api': {
                let res;
                try {
                    res = await this.getSearchGroupsDataRequest(name)
                } catch(e){
                    return await this.searchGroupsData(name, 'database');
                }
                switch(res.status){
                    case 302: {
                        let location = res.headers.get('location')
                        let uuid = location.substring(location.indexOf('?g=') + 3)
                        return await db.transaction(async transaction => {
                            await Schedules.destroy({
                                transaction,
                                where: { parent: name }
                            })
                            let [result] = await Schedules.upsert({
                                name, uuid, parent: null,
                            }, {
                                transaction,
                                returning: ['uuid', 'name', 'parent', 'createdAt', 'updatedAt'],
                            })
                            return [result];
                        }) 
                    }
                    case 200: {
                        let html = await res.text();
                        let document = parser.parse(html, PARSER_OPTIONS);
                        let links = document.querySelectorAll('#ctl00_MainContent_ctl00_GroupListPanel a');
                        let rows = links.map(link => {
                            let href = link.getAttribute('href');
                            return {
                                name: link.textContent.trim(),
                                uuid: href.substring(href.indexOf('?g=') + 3),
                                parent: name,
                            }
                        });
                        let result = await db.transaction(async transaction => {
                            await Schedules.destroy({
                                transaction,
                                where: {
                                    uuid: { [Op.notIn]: rows.map(row => row.uuid) },
                                    parent: name
                                }
                            })
                            return Schedules.bulkCreate(rows, {
                                transaction,
                                returning: ['uuid', 'name', 'parent', 'createdAt', 'updatedAt'],
                                fields: ['name', 'uuid', 'parent'],
                                updateOnDuplicate: ['name']
                            })
                        })
                        return result.sort((a, b) => a.name.localeCompare(b, 'ua', { sensitivity: 'base' }));
                    }
                    default: {
                        return await this.searchGroupsData(name, 'database');
                    }
                }
            }
            default: return []
        }
    }
    /**
     * @param {string} uuid 
     * @param {'api' | 'database' | 'cache'} mode 
     * @returns {Promise<import('../database/models/schedule').Schedule | null>}
     */
    async searchGroupSchedule(uuid, mode = 'api'){
        switch(mode){
            case 'database': {
                return await Schedules.findByPk(uuid)
            }
            case 'cache': {
                return this.scheduleCache.get(uuid) || null;
            }
            case 'api': {
                let html;
                try {
                    html = await this.getSearchGroupScheduleRequest(uuid).then(r => r.text())
                } catch(e){
                    return await this.searchGroupSchedule(uuid, 'database');
                }
                let document = parser.parse(html, PARSER_OPTIONS)
                let cells = document.querySelectorAll('.table.table-bordered td');

                let lessonsInTable
                switch(cells.length){
                    case 98: lessonsInTable = 6; break;
                    case 112: lessonsInTable = 7; break;
                    default: return await this.searchGroupSchedule(uuid, 'database'); 
                }

                let data = Array(14).fill().map(() => {
                    return { count: 0, min: -1, max: -1, lessons: [] }
                });

                for (let week = 0; week < 2; week++){
                    for (let day = 0; day < 6; day++){
                        for (let number = 0; number < lessonsInTable; number++){
                            let dayIndex = week * 7 + day;
                            let tableIndex = (cells.length / 2) * week + 7 * (number + 1) + (day + 1);

                            let cell = cells[tableIndex];
                            let links = cell.querySelectorAll('.plainLink');
                            if (!links.length) continue;

                            let groupedLinks = _(links).groupBy(link => {
                                switch(link.getAttribute('href').substring(0, 11)){
                                    case 'http://wiki': return 'names';
                                    case '/Schedules/': return 'teachers';
                                    case 'http://maps': return 'rooms';
                                }
                            }).value();

                            let name = new Set(), types = new Set(), rooms = new Set(), teachers = new Set();

                            ;(groupedLinks.names || []).forEach(link => {
                                name.add(link.textContent.trim())
                            })
                            if (!name.size) continue;

                            ;(groupedLinks.rooms || []).forEach(link => {
                                let text = link.textContent;
                                let match = LESSON_TYPE_REGEXP.exec(text);
                                if (match){
                                    types.add(match[0]);
                                    text = text.substring(0, match.index) + text.substring(match.index + match[0].length)
                                }
                                rooms.add(text.trim());
                            });
                            ;(groupedLinks.teachers || []).forEach(link => {
                                let splittedFio = (link.getAttribute('title') || '').trimEnd().split(' ');
                                if (splittedFio.length >= 3) teachers.add(splittedFio.slice(-3).join(' '));
                            });

                            let textNodes = cell.childNodes;
                            textNodes.forEach(node => {
                                if (node.nodeType !== NodeType.TEXT_NODE) return;
                                let match = LESSON_TYPE_REGEXP.exec(node.textContent);
                                if (match) types.add(match[0]);
                            })

                            let dayContainer = data[dayIndex];
                            dayContainer.count++;
                            if (dayContainer.min === -1) dayContainer.min = number;
                            dayContainer.max = number;

                            let resultName = Array.from(name).join('. ');
                            let resultTypes =  Array.from(types);
                            let resultRooms = Array.from(rooms);
                            let resultTeachers = Array.from(teachers);

                            let resultHash = createHash('md5').update(
                                `${resultName},${resultTypes.join(',')}${resultRooms.join(',')},${resultTeachers.join(',')}`
                            ).digest('hex');

                            dayContainer.lessons[number] = {
                                hash: resultHash,
                                name: resultName, types: resultTypes,
                                rooms: resultRooms, teachers: resultTeachers,
                            }
                        }
                    }
                }
                let [result] = await Schedules.bulkCreate([{
                    uuid, data,
                    name: document.getElementById('ctl00_MainContent_lblHeader').textContent.trim().substring(19),
                }], {
                    updateOnDuplicate: ['data'],
                    returning: true,
                })
                return result;
            }
            default: return null
        }
    }

    /**
     * @param {string} name 
     * @returns {Promise<Name[]>}
     */
    async fetchGroupsName(name){
        let queue = this.nameQueues.get(name);
        if (queue) return await queue;

        let newQueue = this.searchGroupsName(name, 'api');
        this.nameQueues.set(name, newQueue.finally(() => this.nameQueues.delete(name)));
        return await newQueue;
    }
    /**
     * @param {string} name 
     * @returns {Promise<Schedule[]>}
     */
    async fetchGroupsData(name){
        let cached = await this.searchGroupsData(name, 'cache');
        if (cached) return cached;

        let queue = this.dataQueues.get(name);
        if (queue) return await queue;
        let newQueue = this.searchGroupsData(name, 'api');
        this.dataQueues.set(name, newQueue.finally(() => this.dataQueues.delete(name)));

        let fetched = await newQueue;
        this.dataCache.set(name, fetched);
        return fetched;
    }
    /**
     * @param {string} uuid 
     * @returns {Promise<Schedule | null>}
     */
    async fetchGroupSchedule(uuid){
        let cached = await this.searchGroupSchedule(uuid, 'cache');
        if (cached) return cached;

        let queue = this.scheduleQueues.get(uuid);
        if (queue) return await queue;
        let newQueue = this.searchGroupSchedule(uuid, 'api');
        this.scheduleQueues.set(uuid, newQueue.finally(() => this.scheduleQueues.delete(uuid)));

        let fetched = await newQueue;
        this.scheduleCache.set(uuid, fetched);
        return fetched;
    }

    async clear(){
        Schedules.destroy({ truncate: true }).finally(() => {
            this.scheduleCache.clear();
            this.dataCache.clear();

            this.scheduleQueues.clear();
            this.nameQueues.clear();
            this.dataQueues.clear();
        });
    }
}

export class SchedulesV2Manager extends SchedulesManager{
    constructor(client){
        super(client)

        this.groupsQueue = null
    }

    async getGroupsList(){
        if (!this.groupsQueue){
            this.groupsQueue = fetch(process.env.SCHEDULE_HOST + "/schedule/groups", {
                signal: AbortSignal.timeout(2000)
            }).then(r => r.json()).then(body => {
                setTimeout(() => {
                    this.groupsQueue = null
                }, 1000 * 60 * 60)
                return body.map(item => {
                    return {
                        id: item.id,
                        name: item.name || ""
                    }
                })
            })
        }
        let groups = await this.groupsQueue
        if (!groups) {
            throw new Error("No groups list data found")
        }
        return groups
    }

    async getSearchGroupsName(name = ''){
        const groups = await this.getGroupsList()
        if (!name || name.length < 5) return []
        return groups.filter(item => item.name.toLowerCase().startsWith(name.toLowerCase())).slice(0, 10)
    }
    async getSearchGroupSchedule(uuid = ''){
        if (!uuid) return null
        return fetch(process.env.SCHEDULE_HOST + "/schedule/lessons?groupId=" + uuid, {
            signal: AbortSignal.timeout(4000),
        }).then(r => r.json())
    }
    async getSearchGroupScheduleStatus(uuid = ''){
        if (!uuid) return null
        return fetch(process.env.SCHEDULE_HOST + "/schedule/status?groupId=" + uuid, {
            signal: AbortSignal.timeout(2000),
        }).then(r => r.json())
    }

    /**
     * @param {string} name 
     * @param {'api' | 'database'} mode 
     * @returns {Promise<import('../database/models/name').Name[]>}
     */
    async searchGroupsName(name, mode = 'api'){
        name = formatGroupName(name);
        switch(mode){
            case 'database': {
                return await Names.findAll({
                    where: { name: { [Op.iLike]: name + '%' } },
                    order: [['name', 'ASC']]
                })
            }
            case 'api': {
                let body;
                try {
                    body = await this.getSearchGroupsName(name);
                } catch(e){
                    return await this.searchGroupsName(name, 'database');
                }
                if (!body) return [];
                let result = await Names.bulkCreate(body.map(item => ({ name: item.name })), {
                    returning: true,
                    fields: ['name'],
                    updateOnDuplicate: ['name'],
                })
                return result.sort((a, b) => a.name.localeCompare(b, 'ua', { sensitivity: 'base' }));
            }
            default: return [];
        }
    }

    /**
     * @param {string} name 
     * @param {'api' | 'database' | 'cache'} mode 
     * @returns {Promise<import('../database/models/schedule').Schedule[]>}
     */
    async searchGroupsData(name, mode = 'api'){
        name = formatGroupName(name);
        switch(mode){
            case 'database': {
                return await Schedules.findAll({
                    where: { [Op.or]: { parent: name, name } },
                    order: [['name', 'ASC']],
                    attributes: {
                        exclude: ['data'],
                        include: ['uuid', 'name', 'parent', 'createdAt', 'updatedAt']
                    }
                })
            }
            case 'cache': {
                return this.dataCache.get(name) || null;
            }
            case 'api': {
                let res;
                try {
                    res = await this.getSearchGroupsName(name)
                } catch(e) {
                    return await this.searchGroupsData(name, 'database');
                }
                if (!res?.length) return this.searchGroupsData(name, 'database')
                let result = await Schedules.bulkCreate(res.map(item => {
                    return {
                        name: item.name,
                        uuid: item.id,
                        parent: null,
                    }
                }), {
                    returning: ['uuid', 'name', 'parent', 'createdAt', 'updatedAt'],
                    fields: ['name', 'uuid', 'parent'],
                    updateOnDuplicate: ['name']
                })
                return result.sort((a, b) => a.name.localeCompare(b, 'ua', { sensitivity: 'base' }));

            }
            default: return []
        }
    }

    /**
     * @param {string} uuid 
     * @param {'api' | 'database' | 'cache'} mode 
     * @returns {Promise<import('../database/models/schedule').Schedule | null>}
     */
    async searchGroupSchedule(uuid, mode = 'api'){
        switch(mode){
            case 'database': {
                return await Schedules.findByPk(uuid)
            }
            case 'cache': {
                return this.scheduleCache.get(uuid) || null;
            }
            case 'api': {
                let jsonData;
                let statusData;
                try {
                    [jsonData, statusData] = await Promise.all([this.getSearchGroupSchedule(uuid), this.getSearchGroupScheduleStatus(uuid)])
                    if (!jsonData || !jsonData.scheduleFirstWeek || !jsonData.scheduleFirstWeek) throw new Error("Schedule data not found")
                    if (!statusData) throw new Error("Schedule status not found")
                } catch(e){
                    return await this.searchGroupSchedule(uuid, 'database');
                }

                let data = Array(14).fill().map(() => {
                    return { count: 0, min: -1, max: -1, lessons: [] }
                });

                let rawSchedule = new Array(14).fill(() => null)
                rawSchedule.splice(0, jsonData.scheduleFirstWeek.length, ...jsonData.scheduleFirstWeek)
                rawSchedule.splice(7, 7 + jsonData.scheduleSecondWeek.length, ...jsonData.scheduleSecondWeek)

                const lessonNumberTable = {
                    "08:30:00": 0,
                    "10:25:00": 1,
                    "12:20:00": 2,
                    "14:15:00": 3,
                    "16:10:00": 4,
                    "18:30:00": 5,
                    "20:20:00": 6,
                }

                // Напоминание для себя: на один и тот же lesson number может быть несколько пар, и они идут отдельно друг от друга
                // Потому их надо хранить во временном виде до конца, чтобы их полностью заполнить

                for (let week = 0; week < 2; week++){
                    for (let day = 0; day < 6; day++){
                        let dayIndex = week * 7 + day;
                        let rawDay = rawSchedule[dayIndex]
                        if (!rawDay) continue
                        let dayContainer = data[dayIndex];
                        for (let rawLesson of rawDay.pairs){
                            let number = lessonNumberTable[rawLesson.time]
                            if (!rawLesson.name) return

                            dayContainer.count++;
                            if (dayContainer.min === -1) dayContainer.min = number;
                            dayContainer.max = number;

                            let lessonContainer = dayContainer.lessons[number]
                            if (!lessonContainer) {
                                dayContainer.lessons[number] = lessonContainer = {
                                    hash: '',
                                    name: new Set(),
                                    types: new Set(),
                                    rooms: new Set(),
                                    teachers: new Set(),
                                }
                            }

                            lessonContainer.name.add(rawLesson.name)
                            if (rawLesson.place) lessonContainer.rooms.add(rawLesson.place)
                            if (rawLesson.teacherName) lessonContainer.teachers.add(rawLesson.teacherName)
                            if (rawLesson.type) lessonContainer.types.add(rawLesson.type)
                        }
                    }
                }

                for (let dayContainer of data){
                    dayContainer.lessons.forEach(lessonContainer => {
                        lessonContainer.name = Array.from(lessonContainer.name).join('. ');
                        lessonContainer.types =  Array.from(lessonContainer.types);
                        lessonContainer.rooms = Array.from(lessonContainer.rooms);
                        lessonContainer.teachers = Array.from(lessonContainer.teachers);

                        lessonContainer.hash = createHash('md5').update(
                            `${lessonContainer.name},${lessonContainer.types.join(',')}${lessonContainer.rooms.join(',')},${lessonContainer.teachers.join(',')}`
                        ).digest('hex');
                    })
                }

                let [result] = await Schedules.bulkCreate([{
                    uuid, data,
                    name: statusData[0].groupName
                }], {
                    updateOnDuplicate: ['data'],
                    returning: true,
                })
                return result;
            }
            default: return null
        }
    }
}