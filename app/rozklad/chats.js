import db, { Chats } from '../database';

import CacheMap from '../utils/cache';

export default class ChatsManager{
    constructor(client){
        this.client = client;

        this.chatsCache = new CacheMap(600);
        this.chatQueues = new Map();
    }

    async searchChat(id, mode = 'database'){
        id = +id;
        switch(mode){
            case 'cache': {
                return this.chatsCache.get(id) || null;
            }
            case 'database': {
                let [result] = await Chats.findOrCreate({
                    where: { id }
                })
                return result;
            }
        }
    }
    async fetchChat(id){
        let cached = await this.searchChat(id, 'cache');
        if (cached) return cached;
        let queue = this.chatQueues.get(id);
        if (queue) return await queue;
        let newQueue = this.searchChat(id, 'database');
        this.chatQueues.set(id, newQueue.finally(() => this.chatQueues.delete(id)));
        let fetched = await newQueue;
        this.chatsCache.set(id, fetched);
        return fetched;
    }
}