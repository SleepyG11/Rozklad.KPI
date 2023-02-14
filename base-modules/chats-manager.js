const pg = require('./database');
const moment = require('moment-timezone');
function now(...args){ return moment(...args).tz('Europe/Kiev') };

class ChatsManager{
    constructor(){
        this.buffer = new Map();
        this.bufferClearTimers = {};

        this.defaultData = {
            group_uuid: null,

            links_data: null,
            links_parent_chat_id: null,

            hide_teasers: false,
            hide_time: false,

            ignore_links: false,
            before_notif: false,
            now_notif: false,

            group_uuid: null,
        }
    }
    async getData(chatId){
        let bufferData = this.buffer.get(chatId);
        if (!bufferData){
            let result = await pg.query('SELECT * FROM chats WHERE id = $1', [chatId]);
            let data = result.rows.shift() || {...this.defaultData, id: chatId};
            clearTimeout(this.bufferClearTimers[data.id])
            this.bufferClearTimers[data.id] = setTimeout(() => {
                this.buffer.delete(data.id)
            })
            this.buffer.set(data.id, data);
            bufferData = data;
        }
        return bufferData;
    }

    async toggleParam(chatId, key){
        let chatData = await this.getData(chatId);
        if (chatData) {
            chatData[key] = !chatData[key];
            await pg.query('INSERT INTO chats (id, ' +key+ ') VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET ' +key + ' = $2 RETURNING *', [chatId, chatData[key]]);
        }
    }

    async setGroup(chatId, groupUUID){
        let chatData = await this.getData(chatId);
        if (chatData) chatData.group_uuid = groupUUID;
        await pg.query('INSERT INTO chats (id, group_uuid) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET group_uuid = $2 RETURNING *', [chatId, groupUUID]);
    }

    async setLessonLinksParent(chatId, parentId, groupUUID){
        let chatData = await this.getData(chatId);
        if (chatData) {
            chatData.links_parent_chat_id = parentId;
            chatData.group_uuid = groupUUID;
        }
        await pg.query('INSERT INTO chats (id, group_uuid, links_parent_chat_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET (group_uuid, links_parent_chat_id) = ($2, $3) RETURNING *', [chatId, groupUUID, parentId]);
    }
    async deleteLessonLinksParent(chatId){
        let chatData = await this.getData(chatId);
        if (chatData) chatData.links_parent_chat_id = null;
        await pg.query('INSERT INTO chats (id, links_parent_chat_id) VALUES ($1, null) ON CONFLICT (id) DO UPDATE SET links_parent_chat_id = null RETURNING *', [chatId]);
    }

    async addLessonLink(chatId, lessonId, name, type, link, temp = false){
        let chatData = await this.getData(chatId);
        if (!chatData.links_data) chatData.links_data = {};
        let unix = now().unix();
        let targetArray = (chatData.links_data[lessonId] || []).filter(i => i.until > unix);
        if (temp) {
            targetArray.push({
                name, link, type, until: now().add(8, 'h').unix()
            })
        } else {
            let quarter = now().quarter();
            if (quarter % 2) quarter++;
            targetArray.push({
                name, link, type, until: now().set({ quarter }).endOf('quarter').unix()
            })
        }
        chatData.links_data[lessonId] = targetArray;
        await pg.query('INSERT INTO chats (id, links_data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET links_data = $2 RETURNING *', [chatId, chatData.links_data]);
    }
    async deleteLessonLink(chatId, lessonId, index){
        let chatData = await this.getData(chatId);
        if (!chatData.links_data) chatData.links_data = {};
        let unix = now().unix();
        let targetArray = (chatData.links_data[lessonId] || []).filter(i => i.until > unix);
        targetArray.splice(index, 1);
        if (!targetArray.length) {
            delete chatData.links_data[lessonId];
        } else {
            chatData.links_data[lessonId] = targetArray;
        }
        await pg.query('INSERT INTO chats (id, links_data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET links_data = $2 RETURNING *', [chatId, chatData.links_data]);
    }

    async getLessonLinks(chatId, lessonId){
        let chatData = await this.getData(chatId);
        return await this.getLessonLinksFrom(chatData, lessonId);
    }
    async getLessonLinksFrom(chatData, lessonId){
        let unix = now().unix();
        let chatLinks = (chatData.links_data?.[lessonId] || []).filter(i => i.until > unix);
        let parentLinks = [];
        if (chatData.links_parent_chat_id){
            let parentChatData = await this.getData(chatData.links_parent_chat_id);
            parentLinks = (parentChatData.links_data?.[lessonId] || []).filter(i => i.until > unix);;
        }
        let totalLinks = chatLinks.concat(parentLinks.filter(l1 => chatLinks.every(l2 => l1.link !== l2.link)))
        return {
            chatLinks,
            parentLinks, totalLinks
        }
    }
}

module.exports = new ChatsManager();