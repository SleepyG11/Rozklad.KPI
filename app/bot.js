import { AbortError } from 'node-fetch';
import TelegramBot from 'node-telegram-bot-api';
import { EventEmitter } from 'node:events';

import ChatsManager from './rozklad/chats';
import SchedulesManager from './rozklad/schedules';
import CommandsInterface from './rozklad/commands';
import LinksManager from './rozklad/links';
import AdminInterface from './rozklad/admin';

const COMMAND_PREFIX_REGEXP = /^\/[^\s]/

export default class TelegramClient extends TelegramBot{
    constructor(...args){
        super(...args)

        this.commands = new EventEmitter();
        this.messages = new EventEmitter();
        this.queries = new EventEmitter();

        this.rozklad = {
            chats: new ChatsManager(this),
            schedules: new SchedulesManager(this),
            commands: new CommandsInterface(this),
            links: new LinksManager(this),
            admin: new AdminInterface(this),
        }

        this.getMe().then(me => {
            this.me = me;
            this.on('message', msg => {
                let text = msg.text ?? msg.caption;
                if (!text) return;
                if (COMMAND_PREFIX_REGEXP.test(text)) {
                    let separatorMatch = /\s|\n/.exec(text);
                    let separatorIndex = separatorMatch ? separatorMatch.index : text.length;
                    let commandName = text.substring(1, separatorIndex).replace('@' + me.username, '');
                    if (commandName.charAt(0) === '#') return;
                    let commandArgs = msg.text.substring(separatorIndex + 1).split(' ');
                    this.commands.emit('#command', msg, commandArgs, commandName);
                    this.commands.emit(commandName, msg, commandArgs, commandName);
                } 
                this.messages.emit(text, msg);
            })
        })
        this.on('callback_query', query => {
            if (!query.data) return;
            let [command, ...rawParams] = query.data.split('?');
            this.queries.emit(command, query, Object.fromEntries(new URLSearchParams(rawParams.join('?'))))
        })

        this.on('polling_error', e => console.error(e.message));
    }

    awaitReplyToMessage(chatId, messageId, options = {}){
        return new Promise((resolve, reject) => {
            let isSettled = false;
            let listenerId = this.onReplyToMessage(chatId, messageId, msg => {
                if (isSettled) return;
                if (typeof options.filter === 'function' && !options.filter(msg)) return;
                isSettled = true;
                this.removeReplyListener(listenerId);
                resolve(msg);
            })
            const onAbort = () => {
                options.signal.removeEventListener('abort', onAbort);
                isSettled = true;
                this.removeReplyListener(listenerId);
                reject(new AbortError('awaitReplyToMessage was aborted'));
            }
            if (options.signal){
                options.signal.addEventListener('abort', onAbort)
            }
        })
    }
}