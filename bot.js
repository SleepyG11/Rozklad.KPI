let botSpawnDate = new Date();
let botLoadDate;

const LOG_CHAT_ID = -522962876;

const moment = require('moment-timezone');
function now(...args){ return moment(...args).tz('Europe/Kiev') };
function onRange(min, value, max){ return value >= min && value <= max };

const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.BOT_TOKEN, {
    onlyFirstMatch: true
});

const pg = require('./base-modules/database');
const ChatsManager = require('./base-modules/chats-manager');
const SchedulesManager = require('./base-modules/schedules-manager');
const LessonsManager = require('./base-modules/lessons-manager');

const ejs = require('ejs');

const SCHEDULE_GETTERS = require('./enums/schedule-getters');

//--------------------------------

let botMe = null;
bot.getMe().then(me => {
    botMe = me;
    bot.startPolling({ polling: { interval: 1250 } }).then(() => {
        console.log('Bot started polling.')
    });
})
function isMyCommand(msg){
    if (!msg.text.startsWith('/')) return false;
    return msg.chat.type === 'private' || (new RegExp('^\/[^@]*@' + botMe.username)).test(msg.text)
}
let lessonCommands = [
    {
        command: 'current',
        description: 'Поточна пара'
    },
    {
        command: 'next',
        description: 'Наступна пара'
    },
    {
        command: 'today',
        description: 'Пари на сьогодні'
    },
    {
        command: 'tomorrow',
        description: 'Пари на завтра'
    },
    {
        command: 'nextday',
        description: 'Пари на наступний робочий день'
    },
    {
        command: 'week_current',
        description: 'Пари на поточний тиждень'
    },
    {
        command: 'week_next',
        description: 'Пари на наступний тиждень'
    },
]
let defaultCommands = [
    {
        command: 'start',
        description: 'Почати роботу з ботом'
    },
    {
        command: 'help',
        description: 'Повний список команд боту'
    },
    {
        command: 'feedback',
        description: 'Знайшли помилку або є що сказати?'
    }
]
let adminCommands = [
    {
        command: 'settings',
        description: 'Налаштування боту у цьому чаті'
    },
    {
        command: 'bind',
        description: 'Обрати групу у цьому чаті'
    },
]
let privateCommands = [
    // {
    //     command: 'keyboard',
    //     description: 'Відобразити клавіатуру'
    // },
    // {
    //     command: 'hide_keyboard',
    //     description: 'Сховати клавіатуру'
    // },
]
let groupLinkCommands = [
    {
        command: 'links_delete',
        description: 'Видалити посилання на поточну пару'
    },
    {
        command: 'links_share',
        description: 'Поділитися посиланнями на пари у чаті'
    },
]
bot.setMyCommands(
    [...lessonCommands, ...defaultCommands, ...adminCommands, ...privateCommands, ...groupLinkCommands],
    {
        type: 'default'
    }
)

//--------------------------------

function createCommandRegExp(command){
    return new RegExp("\\/" + command + "(?:@[A-z0-9-_]+)?(?: (.+?))? ?$");
}
function getParamsFromHiddenLink(msg){
    if (msg.from.id !== botMe.id) return null;
    if (!msg.entities || !msg.entities.length) return null;
    let firstEntity = msg.entities.shift();
    if (firstEntity.type !== 'text_link' || firstEntity.offset !== 0 || firstEntity.length !== 1) return;
    let linkMatch = /^http\:\/\/t\.me\/(?:.+?)\?(.*?)$/.exec(firstEntity.url);
    if (!linkMatch) return null;
    return Object.fromEntries(new URLSearchParams(linkMatch[1])) || null;
}

// -----------------------

async function processScheduleCommand(command, msg, name, edit = false, params = {}){
    let chatData = await ChatsManager.getData(msg.chat.id);
    if (name){
        let groups = await SchedulesManager.searchGroups(name);
        switch(groups.length){
            case 0: {
                let text = await ejs.renderFile('./views/lessons/args/group-not-found.ejs');
                bot.sendMessage(msg.chat.id, text, {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.chat.id > 0 ? null : msg.message_id,
                    reply_markup: { remove_keyboard: true, selective: true }
                })
                break;
            }
            case 1: {
                let schedule = await SchedulesManager.getSchedule(groups.shift().uuid);
                let buildData = await LessonsManager.buildMessage(command, schedule, chatData, chatData.hide_teachers, chatData.hide_time);
                bot.sendMessage(msg.chat.id, buildData.text, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                    reply_markup: {
                        inline_keyboard: buildData.inline_keyboard || undefined
                    }
                })
                break;
            }
            case 2: {
                let text = await ejs.renderFile('./views/lessons/args/group-list.ejs');
                let buttons = groups.slice(0, 5).map(listItem => {
                    return [{
                        text: `${listItem.name} (${listItem.faculty})`,
                        callback_data: command + '?' + new URLSearchParams({ user: msg.from.id, uuid: listItem.uuid }).toString()
                    }]
                }).concat([[{ text: 'Відмінити', callback_data: 'deleteMessage?user=' + msg.from.id }]]);
                bot.sendMessage(msg.chat.id, text, {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg.chat.id > 0 ? null : msg.message_id,
                    reply_markup: { remove_keyboard: true, selective: true, inline_keyboard: buttons }
                })
                break;
            }
        }
        
    } else if (!chatData.group_uuid && !params.uuid){
        let text = await ejs.renderFile('./views/group-not-selected.ejs', {
            command: command
        })
        if (edit){
            bot.editMessageText(text, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            })
        } else {
            bot.sendMessage(msg.chat.id, text, {
                parse_mode: 'HTML',
                reply_to_message_id: msg.chat.id < 0 ? msg.message_id : null,
                disable_web_page_preview: true,
            })
        }
    } else {
        let schedule = await SchedulesManager.getSchedule(params.uuid || chatData.group_uuid);
        let hideTeachers = params ? params.hTch == 'true' : chatData.hide_teachers;
        let hideTime = params ? params.hTime == 'true' : chatData.hide_time
        let buildData = await LessonsManager.buildMessage(command, schedule, chatData, hideTeachers, hideTime);
        let reply_markup = { inline_keyboard: buildData.inline_keyboard || undefined };
        if (edit){
            bot.editMessageText(buildData.text, {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup
            })
        } else {
            bot.sendMessage(msg.chat.id, buildData.text, {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup
            })
        }
    }
}
SCHEDULE_GETTERS.forEach(command => {
    bot.onText(createCommandRegExp(command), async (msg, match) => {
        if (!isMyCommand(msg)) return;
        if (msg.reply_to_message) return;
        processScheduleCommand(command, msg, match[1]);
    })
})

// -----------------------

bot.onText(createCommandRegExp('bind'), async (msg, match) => {
    if (!isMyCommand(msg)) return;
    let member = await bot.getChatMember(msg.chat.id, msg.from.id);
    if (msg.chat.id < 0 && !['creator', 'administrator'].includes(member.status)){
        let text = await ejs.renderFile('./views/admin-only.ejs', { name: msg.from.first_name });
        return void bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    }
    let isPrivateChat = msg.chat.id > 0;
    let commandText = await ejs.renderFile('./views/bind/start.ejs');
    let msg1 = await bot.sendMessage(msg.chat.id, commandText, {
        parse_mode: 'HTML',
        reply_to_message_id: isPrivateChat ? null : msg.message_id,
        reply_markup: {
            force_reply: true,
            selective: true,
            input_field_placeholder: 'Назва групи'
        }
    })
    let listenerId = bot.onReplyToMessage(msg1.chat.id, msg1.message_id, async function listener(msg2){
        if (msg.from.id !== msg2.from.id) return;
        bot.removeReplyListener(listenerId);
        if (!/^[А-яіІїЇєЄ]{2}-[0-9]{2}[А-яіІїЇєЄ]{0,}$/i.test(msg2.text.trim())){
            let text = await ejs.renderFile('./views/bind/invalid.ejs');
            let msg3 = await bot.sendMessage(msg2.chat.id, text, {
                parse_mode: 'HTML',
                reply_to_message_id: isPrivateChat ? null : msg2.message_id,
                reply_markup: { remove_keyboard: true, selective: true }
            })
            listenerId = bot.onReplyToMessage(msg1.chat.id, msg3.message_id, listener);
            return;
        }
        let groups = await SchedulesManager.searchGroups(msg2.text);
        switch(groups.length){
            case 0: {
                let text = await ejs.renderFile('./views/bind/not-found-again.ejs');
                let msg3 = await bot.sendMessage(msg2.chat.id, text, {
                    parse_mode: 'HTML',
                    reply_to_message_id: isPrivateChat ? null : msg2.message_id,
                    reply_markup: { remove_keyboard: true, selective: true }
                })
                listenerId = bot.onReplyToMessage(msg1.chat.id, msg3.message_id, listener);
                break;
            }
            case 1: {
                let group = groups.shift();
                await ChatsManager.setGroup(msg.chat.id, group.uuid)
                let text = await ejs.renderFile('./views/bind/binded.ejs', { group });
                bot.sendMessage(msg2.chat.id, text, {
                    parse_mode: 'HTML',
                    reply_to_message_id: isPrivateChat ? null : msg2.message_id,
                    reply_markup: { remove_keyboard: true, selective: true }
                })
                break;
            }
            default: {
                let text = await ejs.renderFile('./views/bind/list.ejs');
                let buttons = groups.slice(0, 5).map(listItem => {
                    return [{
                        text: `${listItem.name} (${listItem.faculty})`,
                        callback_data: 'bind?' + new URLSearchParams({ user: msg2.from.id, uuid: listItem.uuid }).toString()
                    }]
                }).concat([[{ text: 'Відмінити', callback_data: 'deleteMessage?user=' + msg.from.id }]]);
                bot.sendMessage(msg2.chat.id, text, {
                    parse_mode: 'HTML',
                    reply_to_message_id: msg2.message_id,
                    reply_markup: { remove_keyboard: true, selective: true, inline_keyboard: buttons }
                })
                break;
            }
        }
    })
})
bot.onText(createCommandRegExp('unbind'), async (msg, match) => {
    if (!isMyCommand(msg)) return;
    if (msg.reply_to_message) return;
    let isPrivateChat = msg.chat.id > 0;
    let chatData = await ChatsManager.getData(msg.chat.id);
    if (chatData.group_uuid){
        await ChatsManager.setGroup(msg.chat.id, null);
        let text = await ejs.renderFile('./views/unbind/unbinded.ejs');
        bot.sendMessage(msg.chat.id, text, {
            parse_mode: 'HTML',
            reply_to_message_id: isPrivateChat ? null : msg.message_id,
            reply_markup: { remove_keyboard: true, selective: true }
        })
    } else {
        let text = await ejs.renderFile('./views/unbind/already-unbinded.ejs');
        bot.sendMessage(msg.chat.id, text, {
            parse_mode: 'HTML',
            reply_to_message_id: isPrivateChat ? null : msg.message_id,
            reply_markup: { remove_keyboard: true, selective: true }
        })
    }
})

// -----------------------

async function processLinksDelete(msg, edit = false, params = {}){
    const send = async (file, button) => {
        let text = await ejs.renderFile(file);
        if (edit){
            bot.editMessageText(text, {
                parse_mode: 'HTML',
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: button || undefined
                }
            })
        } else {
            bot.sendMessage(msg.chat.id, text, {
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: button || undefined
                }
            })
        }
    }
    let currentFromId = edit ? msg.reply_to_message.from.id : msg.from.id;
    let chatData = await ChatsManager.getData(msg.chat.id);
    if (!chatData.group_uuid) return send('./views/link-delete/no-group.ejs');
    let scheduleData = await SchedulesManager.getSchedule(chatData.group_uuid);
    if (!scheduleData) return send('./views/link-delete/no-schedule.ejs');
    let lessonId = params.l;
    if (!lessonId){
        let currentLessonData = LessonsManager.getCurrentLesson(scheduleData);
        if (!currentLessonData.lesson) return send('./views/link-delete/no-lesson.ejs');
        lessonId = currentLessonData.lesson.hash;
    }
    let linksData = await ChatsManager.getLessonLinksFrom(chatData, lessonId);
    if (!linksData.chatLinks.length) return send(edit ? './views/link-delete/all-links-removed.ejs' : './views/link-delete/no-links.ejs');
    let buttons = linksData.chatLinks.map((linkData, i) => {
        return [{
            text: linkData.name,
            callback_data: 'deleteLink?' + new URLSearchParams({ l: lessonId, i, user: currentFromId })
        }]
    })
    send('./views/link-delete/list.ejs', buttons.concat([[{ text: 'Відмінити', callback_data: 'deleteMessage?user=' + currentFromId }]]));
}
bot.onText(/meet\.google\.com\/|zoom\.[A-z]{2}\//, async (msg, match) => {
    let chatData = await ChatsManager.getData(msg.chat.id);
    if (chatData.ignore_links) return; // Отключено
    let linkEntity = msg.entities.find(entity => {
        return entity.type === 'url' && onRange(entity.offset, match.index, entity.offset + entity.length);
    })
    if (!linkEntity) return; // Нет ссылки нужной
    let link = msg.text.substring(linkEntity.offset, linkEntity.offset + linkEntity.length);
    let scheduleData = await SchedulesManager.getSchedule(chatData.group_uuid);
    if (!scheduleData) return; // Нет расписания
    let currentLessonData = LessonsManager.getCurrentLesson(scheduleData);
    if (!currentLessonData.lesson) return; // Нет текущей пары
    let linksData = await ChatsManager.getLessonLinksFrom(chatData, currentLessonData.lesson.hash);
    if (linksData.chatLinks.length > 3) return; // Ссылок больше чем 3
    if (linksData.chatLinks.some(i => i.link === link)) return; // Такая ссылка уже есть
    let type;
    if (/meet\.google\.com\//.test(link)) type = "Meet"
    else if (/zoom\.[A-z]{2}\//.test(link)) type = "Zoom";
    else return; // Неопознанный тип ссылки
    let lessonName = currentLessonData.lesson.name.join('. ');
    if (lessonName.length > 48) lessonName = lessonName.substring(0, 45) + '...';
    let text = await ejs.renderFile('./views/link-add/start.ejs', {
        hiddenLink: 't.me/btn?' + new URLSearchParams({ lessonId: currentLessonData.lesson.hash, link, type }).toString(),
        author: msg.from.first_name,
        lessonName
    })
    bot.sendMessage(msg.chat.id, text, {
        parse_mode: 'HTML',
        reply_to_message_id: msg.message_id,
        reply_markup: {
            inline_keyboard: [[
                {
                    text: 'Так',
                    callback_data: 'addPermLink?user=' + msg.from.id
                },
                {
                    text: 'Так, тимчасова',
                    callback_data: 'addTempLink?user=' + msg.from.id
                },
                {
                    text: 'Ні',
                    callback_data: 'deleteMessage?user=' + msg.from.id
                }
            ]]
        }
    })
})
bot.onText(createCommandRegExp('links_delete'), async (msg, match) => {
    if (!isMyCommand(msg)) return;
    processLinksDelete(msg)
})
bot.onText(createCommandRegExp('links_share'), async msg => {
    if (msg.chat.id > 0){
        let text = await ejs.renderFile('./views/links-share/only-public.ejs');
        bot.sendMessage(msg.chat.id, text, {
            parse_mode: 'HTML'
        })
    } else {
        let member = await bot.getChatMember(msg.chat.id, msg.from.id);
        if (!['creator', 'administrator'].includes(member.status)){
            let text = await ejs.renderFile('./views/admin-only.ejs', { name: msg.from.first_name });
            return void bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
        }
        let chatData = await ChatsManager.getData(msg.chat.id);
        if (!chatData.group_uuid){
            let text = await ejs.renderFile('./views/links-share/no-group.ejs');
            bot.sendMessage(msg.chat.id, text, {
                parse_mode: 'HTML'
            })
        } else {
            let text = await ejs.renderFile('./views/links-share/start.ejs');
            bot.sendMessage(msg.chat.id, text, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{
                        text: 'Додати посилання',
                        url: 'https://t.me/' + botMe.username + '?start=' + msg.chat.id + '_' + chatData.group_uuid
                    }]]
                }
            })
        }
    }
})

// -----------------------

async function processSettings(msg, edit){
    let chatData = await ChatsManager.getData(msg.chat.id);
    let groupData = chatData.group_uuid ? await SchedulesManager.getGroup(chatData.group_uuid) : null;
    let text = await ejs.renderFile('./views/settings/start.ejs', { chat: chatData, group: groupData });
    let currentFromId = edit ? msg.reply_to_message.from.id : msg.from.id;
    let inline_keyboard = [
        [{ text: chatData.hide_teachers ? 'Відображати вчителів' :  'Приховувати вчителів', callback_data: 'toggle?key=hide_teachers&user=' + currentFromId }],
        [{ text: chatData.hide_time ? 'Відображати час пар' :  'Приховувати час пар', callback_data: 'toggle?key=hide_time&user=' + currentFromId }],
        [{ text: chatData.ignore_links ? 'Помічати посилання на пари' : 'Ігнорувати посилання на пари', callback_data: 'toggle?key=ignore_links&user=' + currentFromId }],
        [{ text: chatData.before_notif ? 'Не надсилати оповіщення за 15 хв. до пари' : 'Надсилати оповіщення за 15 хв. до пари', callback_data: 'toggle?key=before_notif&user=' + currentFromId }],
        [{ text: chatData.now_notif ? 'Не надсилати оповіщення про початок пари' : 'Надсилати оповіщення про початок пари', callback_data: 'toggle?key=now_notif&user=' + currentFromId }],
    ]
    if (chatData.links_parent_chat_id) inline_keyboard.push([{
        text: 'Видалити посилання іншого чату', callback_data: 'linksParentRemove?user=' + currentFromId
    }])
    inline_keyboard.push([{
        text: 'Закрити меню', callback_data: 'deleteMessage?user=' + currentFromId
    }])
    if (edit){
        bot.editMessageText(text, {
            chat_id: msg.chat.id,
            message_id: msg.message_id,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard }
        })
    } else {
        bot.sendMessage(msg.chat.id, text, {
            parse_mode: 'HTML',
            reply_to_message_id: msg.message_id,
            reply_markup: { inline_keyboard }
        })
    }
}
bot.onText(createCommandRegExp('settings'), async msg => {
    if (!isMyCommand(msg)) return;
    let member = await bot.getChatMember(msg.chat.id, msg.from.id);
    if (msg.chat.id < 0 && !['creator', 'administrator'].includes(member.status)){
        let text = await ejs.renderFile('./views/admin-only.ejs', { name: msg.from.first_name });
        return void bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    }
    processSettings(msg)
})

// -----------------------

bot.onText(createCommandRegExp('start'), async (msg, match) => {
    if (!isMyCommand(msg)) return;
    let [chatId, groupUUID] = (match[1] || '').split('_');
    if (msg.chat.id > 0 && match[1]){
        if (!isNaN(chatId) && +chatId < 0 && groupUUID){
            try {
                let member = await bot.getChatMember(chatId, msg.from.id);
                if (['creator', 'member', 'administrator'].includes(member.status)){
                    let groupData = await SchedulesManager.getGroup(groupUUID);
                    if (groupData){
                        let chatData = await ChatsManager.getData(msg.chat.id);
                        await ChatsManager.setLessonLinksParent(msg.chat.id, chatId, groupUUID || chatData.group_uuid);
                        let text = await ejs.renderFile('./views/start/parent-added.ejs', { chat: chatData, group: groupData });
                        return void bot.sendMessage(msg.chat.id, text, {
                            parse_mode: 'HTML',
                            disable_web_page_preview: true,
                        })
                    }
                }
            } catch(e){}
        }
    }
    let text = await ejs.renderFile('./views/start/start.ejs');
    bot.sendMessage(msg.chat.id, text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    })
})
bot.onText(createCommandRegExp('help'), async msg => {
    if (!isMyCommand(msg)) return;
    let text = await ejs.renderFile('./views/help/start.ejs');
    bot.sendMessage(msg.chat.id, text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    })
})
bot.onText(createCommandRegExp('feedback'), async msg => {
    if (!isMyCommand(msg)) return;
    let text = await ejs.renderFile('./views/feedback/start.ejs');
    bot.sendMessage(msg.chat.id, text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    })
})

// -----------------------

bot.on('callback_query', async query => {
    let [command, rawParams] = query.data.split('?');
    let params = Object.fromEntries(new URLSearchParams(rawParams));
    if (SCHEDULE_GETTERS.includes(command)){
        return void processScheduleCommand(command, query.message, null, true, params);
    }
    if (params.user && query.from.id != params.user) return bot.answerCallbackQuery(query.id, {
        text: '❌ Ви не можете використовувати кнопки, що не адресовані до вас.'
    })
    switch(command){
        case 'deleteMessage': {
            bot.deleteMessage(query.message.chat.id, query.message.message_id).catch(() => {});
            break;
        }
        case 'bind': {
            let group = await SchedulesManager.getGroup(params.uuid);
            if (!group){
                let text = await ejs.renderFile('./views/bind/not-found-error.ejs');
                bot.editMessageText(text, {
                    chat_id: query.message.chat.id,
                    message_id: query.message.message_id,
                    parse_mode: 'HTML',
                })
            } else {
                await ChatsManager.setGroup(query.message.chat.id, group.uuid);
                let text = await ejs.renderFile('./views/bind/binded.ejs', { group });
                bot.editMessageText(text, {
                    chat_id: query.message.chat.id,
                    message_id: query.message.message_id,
                    parse_mode: 'HTML',
                })
            }
            break;
        }
        case 'addTempLink': {
            let { lessonId, type, link } = getParamsFromHiddenLink(query.message);
            await ChatsManager.addLessonLink(query.message.chat.id, lessonId, type + ' (одн.)', type, link, true);
            let text = await ejs.renderFile('./views/link-add/success.ejs');
            bot.editMessageText(text, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
            })
            break;
        }
        case 'addPermLink': {
            let { lessonId, type, link } = getParamsFromHiddenLink(query.message);
            bot.deleteMessage(query.message.chat.id, query.message.message_id);
            let text = await ejs.renderFile('./views/link-add/set-name.ejs');
            let msg1 = await bot.sendMessage(query.message.chat.id, text, {
                parse_mode: 'HTML',
                reply_to_message_id: query.message.reply_to_message.message_id,
                reply_markup: {
                    force_reply: true,
                    selective: true,
                    input_field_placeholder: 'Назва посилання (від 2 до 24 символів)'
                }
            })
            let listenerId = bot.onReplyToMessage(msg1.chat.id, msg1.message_id, async function listener(msg2){
                if (query.message.reply_to_message.from.id !== msg2.from.id) return;
                bot.removeReplyListener(listenerId);
                if (onRange(2, msg2.text.length, 24)){
                    await ChatsManager.addLessonLink(msg2.chat.id, lessonId, msg2.text, type, link, false);
                    let successText = await ejs.renderFile('./views/link-add/success.ejs');
                    bot.sendMessage(msg2.chat.id, successText, {
                        parse_mode: 'HTML',
                        reply_to_message_id: msg2.message_id,
                        reply_markup: {
                            remove_keyboard: true,
                            selective: true
                        }
                    })
                } else {
                    let errorText = await ejs.renderFile('./views/link-add/invalid-name.ejs');
                    let msg3 = await bot.sendMessage(msg2.chat.id, errorText, {
                        parse_mode: 'HTML',
                        reply_to_message_id: msg2.message_id,
                        reply_markup: {
                            remove_keyboard: true,
                            selective: true
                        }
                    })
                    listenerId = bot.onReplyToMessage(msg3.chat.id, msg3.message_id, listener)
                }
            })
            break;
        }
        case 'deleteLink': {
            await ChatsManager.deleteLessonLink(query.message.chat.id, params.l, params.i);
            processLinksDelete(query.message, true, params);
            break;
        }
        case 'toggle': {
            await ChatsManager.toggleParam(query.message.chat.id, params.key);
            processSettings(query.message, true);
            break;
        }
        case 'linksParentRemove': {
            await ChatsManager.deleteLessonLinksParent(query.message.chat.id);
            processSettings(query.message, true);
            break;
        }
    }
})

//--------------------------------

function sendLog(e){
    console.error(e);
    bot.sendMessage(
        LOG_CHAT_ID,
        `<code>${e.stack.replace(/\</, '&lt;').replace(/\>/, '&gt;')}</code>`,
        { parse_mode: 'HTML', disable_notification: true, disable_web_page_preview: true }
    )
}
process.on('unhandledRejection', sendLog);
process.on('uncaughtException', sendLog);

//--------------------------------

async function sendNotifications(type){
    let result = await pg.query(`SELECT id, group_uuid FROM chats WHERE ${type} = true AND group_uuid IS NOT NULL`);
    const iterate = async () => {
        let row = result.rows.shift();
        if (!row) return;
        setTimeout(iterate, 250);
        let scheduleData = await SchedulesManager.getSchedule(row.group_uuid);
        if (!scheduleData) return;
        let currentLessonParams = LessonsManager.getCurrentLesson(scheduleData);
        if (!currentLessonParams.lesson) return;
        let chatData = await ChatsManager.getData(row.id);
        let buildData = await LessonsManager.buildMessage('next', scheduleData, chatData, chatData.hide_teachers, chatData.hide_time);
        bot.sendMessage(row.id, buildData.text, { parse_mode: 'HTML', disable_web_page_preview: true });
    }
    iterate();
}
let initialParams = LessonsManager.getLessonParams();
setInterval(() => {
    let currentParams = LessonsManager.getLessonParams();
    if (initialParams.lesson === currentParams.lesson){
        initialParams = currentParams;
        return;
    }
    initialParams = currentParams;
    if (currentParams.isDayStart || currentParams.isDayEnd || currentParams.resultIsWeekend) return;
    let nowDiff = now().diff(currentParams.lessonStart, 'milliseconds');
    setTimeout(() => sendNotifications('now_notif'), Math.abs(nowDiff));
    let beforeDiff = now().diff(currentParams.lessonStart.clone().add(-15, 'minutes'), 'milliseconds');
    setTimeout(() => sendNotifications('before_notif'), Math.abs(beforeDiff));
}, 60000)

//--------------------------------

botLoadDate = new Date();