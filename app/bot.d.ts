import TelegramBot, { Message, CallbackQuery, ConstructorOptions, User } from 'node-telegram-bot-api';
import { EventEmitter } from 'node:events';

import ChatsManager from './rozklad/chats';
import SchedulesManager from './rozklad/schedules';
import CommandsInterface from './rozklad/commands';
import LinksManager from './rozklad/links';
import AdminInterface from './rozklad/admin';

const COMMAND_PREFIX_REGEXP = /^\/[^\s]/

export interface CommandsEmitter extends EventEmitter{
    on(event: string, listener: (msg: Message, params: string[], name: string) => void): this
    once(event: string, listener: (msg: Message, params: string[], name: string) => void): this
    addListener(event: string, listener: (msg: Message, params: string[], name: string) => void): this
}
export interface MessagesEmitter extends EventEmitter{
    on(event: string, listener: (msg: Message) => void): this
    once(event: string, listener: (msg: Message) => void): this
    addListener(event: string, listener: (msg: Message) => void): this
}
export interface QueriesEmitter extends EventEmitter{
    on(event: string, listener: (query: CallbackQuery, params: Record<string, string>) => void): this
    once(event: string, listener: (query: CallbackQuery, params: Record<string, string>) => void): this
    addListener(event: string, listener: (query: CallbackQuery, params: Record<string, string>) => void): this
}

export default class TelegramClient extends TelegramBot{
    commands: CommandsEmitter
    messages: MessagesEmitter
    queries: QueriesEmitter

    rozklad: {
        chats: ChatsManager,
        schedules: SchedulesManager,
        commands: CommandsInterface,
        links: LinksManager,
        admin: AdminInterface,
    }

    me?: User

    constructor(token: string, options: ConstructorOptions)

    on(event: 'command', listener: (command: string, msg: Message, params: string[]) => void): this

    awaitReplyToMessage(chatId: number, messageId: number, options: {
        filter: (msg: Message) => boolean,
        signal: AbortSignal
    }): Promise<Message>
}