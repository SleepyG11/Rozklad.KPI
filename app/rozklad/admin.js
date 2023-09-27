import { Op } from "sequelize";
import moment from "moment-timezone";
import _ from 'lodash';

import TelegramClient from "../bot";
import db, { Chats, Schedules, Variables } from "../database";

export default class AdminInterface{
    /**
     * @param {TelegramClient} client 
     */
    constructor(client){
        this.client = client;
        this.launchTime = moment();
    }

    isOwner(msg){
        return msg.from.id == process.env.TELEGRAM_OWNER_ID;
    }

    async eval(msg, args){
        if (!this.isOwner(msg)) return;
        let code = args.join(' ').replace(/^\`\`\`(js)?/, '').replace(/\`\`\`$/, '');
        let rawResult, isError = false;
        try {
            rawResult = await eval(code);
        } catch(e){
            rawResult = e.name + ': ' + e.message;
            isError = true;
        }
        let result = String(rawResult);
        if (typeof rawResult === 'object' && rawResult !== null){
            try {
                result = JSON.stringify(rawResult, null, ' ')
            } catch(e){
                result = String(rawResult) + ' (with circulars)'
            }
        }
        if (result === '') result = '*empty string*'
        this.client.sendMessage(+process.env.TELEGRAM_OWNER_ID, `<code>${result.substring(0, 4000).replace(/>/g, '&gt;').replace(/</g, '&lt;')}</code>`, { 
            parse_mode: 'HTML',
            disable_notification: true,
            disable_web_page_preview: true
        })
    }
    async globalStats(msg, args){
        if (!this.isOwner(msg)) return;
        let lastUsageDateCondition = {
            [Op.gt]: moment().add(-1, 'month').toDate()
        }
        let [
            beforeNotifs, nowNotifs, commandsUsed,
            privatesCount, groupsCount, schedulesCount
        ] = await db.transaction(transaction => {
            return Promise.all([
                Variables.findByPk('beforeNotifsCount', { transaction }),
                Variables.findByPk('nowNotifsCount', { transaction }),
                Variables.findByPk('commandsUsedCount', { transaction }),
                Chats.count({ transaction, where: { 
                    id: { [Op.gt]: 0 },
                    lastUsageDate: lastUsageDateCondition
                }}),
                Chats.count({ transaction, where: 
                    { id: { [Op.lt]: 0 },
                    lastUsageDate: lastUsageDateCondition
                }}),
                Schedules.count({ transaction, where: { data: { [Op.not]: null } }}),
            ])
        })
        let chatsCount = privatesCount + groupsCount;
        this.client.sendMessage(
            +process.env.TELEGRAM_OWNER_ID,
            [
                `Bot launch time: <b>${this.launchTime.format('DD.MM HH:mm:ss')}</b>`,
                ``,
                `Private chats count: <b>${privatesCount}</b>`,
                `Group chats count: <b>${groupsCount}</b>`,
                `Total chats count: <b>${chatsCount}</b>`,
                ``,
                `Before notifs count: <b>${beforeNotifs.intValue}</b>`,
                `Now notifs count: <b>${nowNotifs.intValue}</b>`,
                `Commands used count: <b>${commandsUsed.intValue}</b>`,
                ``,
                `Schedules count: <b>${schedulesCount}</b>`,
            ].join('\n'),
            { parse_mode: 'HTML', disable_web_page_preview: true, disable_notification: true }
        ).catch(console.error)
    }
    async globalGroupsStats(msg){
        if (!this.isOwner(msg)) return;
        let [schedules, chats] = await db.transaction(transaction => {
            return Promise.all([
                Schedules.findAll({
                    transaction,
                    attributes: ['uuid', 'name']
                }),
                Chats.findAll({
                    transaction,
                    where: { groupUUID: { [Op.not]: null } },
                })
            ])
        })
        let schedulesDictionary = Object.fromEntries(schedules.map(schedule => {
            return [schedule.uuid, schedule.name];
        }));
        let countedResult = _.countBy(chats, 'groupUUID');
        let groupedResult = {};
        for (let uuid in countedResult){
            let count = countedResult[uuid];
            if (!groupedResult[count]) groupedResult[count] = [];
            groupedResult[count].push(schedulesDictionary[uuid]);
        }
        let resultMessage = ['<b>Groups stats:</b>'];
        for (let count in groupedResult){
            resultMessage.push(`<b>${count}</b>:\n${groupedResult[count].sort().join(', ')}`)
        }
        this.client.sendMessage(
            +process.env.TELEGRAM_OWNER_ID,
            resultMessage.join('\n\n'),
            { parse_mode: 'HTML', disable_web_page_preview: true, disable_notification: true }
        ).catch(console.error)
    }

    addNotificationCount(type, count = 1){
        let key;
        switch(type){
            case 'beforeNotif': key = 'beforeNotifsCount'; break;
            case 'nowNotif': key = 'nowNotifsCount'; break;
            default: return;
        }
        Variables.increment('intValue', {
            by: count,
            where: { key }
        })
    }
    addCommandUse(){
        Variables.increment('intValue', {
            where: { key: 'commandsUsedCount' }
        })
    }
    updateLastUsageDate(id){
        Chats.update({
            lastUsageDate: new Date()
        }, {
            where: { id }
        })
    }

    async init(){
        await Variables.bulkCreate([
            {
                key: 'commandsUsedCount',
                intValue: 0
            },
            {
                key: 'beforeNotifsCount',
                intValue: 0
            },
            {
                key: 'nowNotifsCount',
                intValue: 0
            }
        ], {
            updateOnDuplicate: ['key']
        })
    }
}