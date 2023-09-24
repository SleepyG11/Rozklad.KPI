import { Op } from "sequelize";
import moment from "moment-timezone";

import TelegramClient from "../bot";
import db, { Chats, Schedules } from "../database";

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
        let updatedAtCondition = {
            [Op.gt]: moment().add(-1, 'month').toDate()
        }
        let [privatesCount, groupsCount, schedulesCount] = await db.transaction(transaction => {
            return Promise.all([
                Chats.count({ transaction, where: { 
                    id: { [Op.gt]: 0 },
                    updatedAt: updatedAtCondition
                }}),
                Chats.count({ transaction, where: 
                    { id: { [Op.lt]: 0 },
                    updatedAt: updatedAtCondition
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
                `Schedules count: <b>${schedulesCount}</b>`,
            ].join('\n'),
            { parse_mode: 'HTML', disable_web_page_preview: true, disable_notification: true }
        ).catch(console.error)
    }
}