import { Op } from 'sequelize';
import moment from 'moment-timezone';

import db, { Links } from '../database';

export default class LinksManager{
    constructor(client){
        this.client = client;
        setTimeout(() => {
            this.clearExpiredLinks()
        }, 1000 * 60 * 90);
    }

    clearExpiredLinks(){
        Links.destroy({
            where: {
                expiresAt: {
                    [Op.lt]: new Date()
                }
            }
        }).catch(e => null);
    }

    async getLessonLinks({ date, chatId, parentChatId, hash, inactive = false }){
        let where = {
            hash, chatId: [chatId, parentChatId].filter(Boolean),
            expiresAt: {
                [Op.gte]: moment(date).toDate()
            }
        }
        if (!inactive) where.active = true;
        return Links.findAll({ where });
    }
    async createInactiveLink({ chatId, type, hash, url, expiresAt }){
        return await Links.create({
            chatId, type, hash, url, expiresAt, active: false,
        })
    }
    async fetchLink(id){
        return Links.findOne({
            where: { id }
        })
    }
    async deleteLink(id){
        let deletedCount = await Links.destroy({
            where: { id }
        })
        return Boolean(deletedCount);
    }
    async clear(){
        Links.destroy()
    }
}