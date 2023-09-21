import TelegramClient from "../bot";
import { l, localizeKeyboard } from "../utils/messages";
import { getCurrentLesson, getCurrentWeekLessons, getFirstWeekLessons, getNextDayLessons, getNextLesson, getNextWeekLessons, getSecondWeekLessons, getTodayLessons, getTomorrowLessons } from '../utils/lessons';
import { formatCapitalize, formatChatSettings, formatGroupName, formatLessonsDay, formatLessonsWeek, formatSingleLesson, formatTimeDefinition } from "../utils/format";
import { getBreak, getLessonDates, getSemester, getWeek } from "../utils/times";
import moment from "moment-timezone";

export default class CommandsInterface{
    BIND_COMMAND_STAGES = {
        START: '0',
        NAME: '1',
        DATA: '2',
        END: '3'
    }
    LESSON_COMMAND_STAGES = {
        CHAT: '0',
        DATA: '1',
        SCHEDULE: '2',
    }
    LINK_COMMAND_STAGES = {
        START: '0',
        TEMP: '1',
        NAME: '2',
        CANCEL: '3',
    }
    LESSONS_GETTERS = {
        current: getCurrentLesson,
        next: getNextLesson,
        today: getTodayLessons,
        tomorrow: getTomorrowLessons,
        nextday: getNextDayLessons,
        week_current: getCurrentWeekLessons,
        week_next: getNextWeekLessons,
        week_first: getFirstWeekLessons,
        week_second: getSecondWeekLessons,
    }

    /**
     * @param {TelegramClient} client 
     */
    constructor(client){
        this.client = client;
    }

    async canUseAdminCommands(chatId, memberId){
        if (chatId > 0) return true;
        let member = await this.client.getChatMember(chatId, memberId);
        return ['creator', 'administrator'].includes(member.status);
    }
    async getChatOrNotifyIfNotBinded(msg){
        let chatData = await this.client.rozklad.chats.fetchChat(msg.chat.id);
        if (chatData.groupUUID) return chatData;
        if (await this.canUseAdminCommands(msg.chat.id, msg.from.id)){
            this.client.sendMessage(msg.chat.id, 
                l('lesson.messages.notBinded.asAdmin'), 
                { parse_mode: 'HTML', reply_to_message_id: msg.message_id, }
            )
        } else {
            this.client.sendMessage(msg.chat.id, 
                l('lesson.messages.notBinded.asUser'),
                { parse_mode: 'HTML', reply_to_message_id: msg.message_id, }
            )
        }
        return null;
    }
    async getScheduleOrNotifyIfNotExists(msg, chat){
        let scheduleData = await this.client.rozklad.schedules.fetchGroupSchedule(chat.groupUUID);
        if (scheduleData && scheduleData.data) return scheduleData;
        
        return null;
    }
    async deleteMessageIfNoReply(query){
        if (!query.message.reply_to_message) {
            this.client.deleteMessage(query.message.chat.id, query.message.message_id).catch(e => null);
            this.client.sendMessage(query.message.chat.id, 'Цільове повідомлення було видалено.')
            return true;
        }
        if (query.from.id !== query.message.reply_to_message.from.id) return true;
        return false;
    }

    async bindGroup(msg, stage = this.BIND_COMMAND_STAGES.START, data){
        let chatId = msg.chat.id;
        let userId = msg.from.id;
        let messageId = msg.message_id;

        const messageOptions = (keyboard) => {
            return {
                parse_mode: 'HTML',
                reply_to_message_id: messageId,
                reply_markup: {
                    remove_keyboard: true,
                    selective: true,
                    inline_keyboard: keyboard
                }
            }
        }

        if (!await this.canUseAdminCommands(chatId, userId)){
            return void this.client.sendMessage(chatId,
                'Цю команду можуть використовувати лише адміністратори чату.',
                messageOptions()
            )
        }

        try {
            switch(stage){
                case this.BIND_COMMAND_STAGES.START: {
                    let responseBotMsg = await this.client.sendMessage(
                        chatId, 
                        l('bind.messages.stageStart.enterGroupName'), 
                        {
                            parse_mode: 'HTML',
                            reply_to_message_id: messageId,
                            reply_markup: {
                                force_reply: true,
                                input_field_placeholder: l('bind.placeholders.stageStart.groupName')
                            }
                        }
                    )
                    let nameUserMsg = await this.client.awaitReplyToMessage(
                        chatId, responseBotMsg.message_id, 
                        { filter: filterMsg => filterMsg.from.id === userId && filterMsg.text }
                    )
                    messageId = nameUserMsg.message_id;
                    data = nameUserMsg.text.substring(0, 10);
                }
                case this.BIND_COMMAND_STAGES.NAME: {
                    let groupNames = await this.client.rozklad.schedules.fetchGroupsName(data);
                    switch(groupNames.length){
                        case 0: {
                            return void this.client.sendMessage(
                                chatId, l('bind.messages.stageName.notFound'), 
                                messageOptions()
                            )
                        }
                        case 1: {
                            return void this.client.sendMessage(
                                chatId, l('bind.messages.stageName.foundOne', groupNames[0]),
                                messageOptions(
                                    localizeKeyboard([[
                                        {
                                            text: 'bind.buttons.stageName.accept',
                                            callback_data: `bind?s=${this.BIND_COMMAND_STAGES.DATA}&d=${groupNames[0].name}`
                                        },
                                        {
                                            text: 'bind.buttons.stageName.cancel',
                                            callback_data: 'delete'
                                        }
                                    ]])
                                )
                            )
                        }
                        default: {
                            return void this.client.sendMessage(
                                chatId, l('bind.messages.stageName.foundMultiple'),
                                messageOptions([
                                    ...groupNames.map(groupName => {
                                        return [{
                                            text: groupName.name,
                                            callback_data: `bind?s=${this.BIND_COMMAND_STAGES.DATA}&d=${groupName.name}`
                                        }]
                                    }),
                                    localizeKeyboard([
                                        {
                                            text: 'bind.buttons.stageName.hide',
                                            callback_data: 'delete'
                                        }
                                    ])
                                ])
                            )
                        }
                    }
                }
                case this.BIND_COMMAND_STAGES.DATA: {
                    let groupData = await this.client.rozklad.schedules.fetchGroupsData(data);
                    switch(groupData.length){
                        case 0: {
                            return void this.client.sendMessage(
                                chatId, l('bind.messages.stageData.notFound'), 
                                messageOptions()
                            )
                        }
                        case 1: {
                            data = groupData[0].uuid; break;
                        }
                        default: {
                            return void this.client.sendMessage(
                                chatId, l('bind.messages.stageData.foundMultiple', { name: data }),
                                messageOptions([
                                    ...groupData.map(group => {
                                        return [{
                                            text: group.name,
                                            callback_data: `bind?s=${this.BIND_COMMAND_STAGES.END}&d=${group.uuid}`
                                        }]
                                    }),
                                    [
                                        {
                                            text: l('bind.buttons.stageData.hide'),
                                            callback_data: 'delete'
                                        }
                                    ]
                                ])
                            )
                        }
                    }
                }
                case this.BIND_COMMAND_STAGES.END: {
                    let groupSchedule = await this.client.rozklad.schedules.fetchGroupSchedule(data);
                    if (!groupSchedule) {
                        return void this.client.sendMessage(chatId, l('bind.messages.stageEnd.notFound'), messageOptions())
                    }
                    let chatData = await this.client.rozklad.chats.fetchChat(chatId);
                    await chatData.update({ groupUUID: groupSchedule.uuid });
                    return void this.client.sendMessage(chatId, l('bind.messages.stageEnd.success', groupSchedule), messageOptions())
                }
            }
        } catch(e){
            console.log(e);
        }
    }
    async bindGroupMessage(msg, args){
        args[0] ? this.bindGroup(msg, this.BIND_COMMAND_STAGES.NAME, args[0]) : this.bindGroup(msg);
    }
    async bindGroupCallbackQuery(query, params){
        if (await this.deleteMessageIfNoReply(query)) return;
        this.client.deleteMessage(query.message.chat.id, query.message.message_id).catch(e => null);
        this.bindGroup(query.message.reply_to_message, params.s, params.d);
    }

    async unbindGroup(msg){
        let chatId = msg.chat.id;
        let userId = msg.from.id;
        let messageId = msg.message_id;

        if (!await this.canUseAdminCommands(chatId, userId)){
            return void this.client.sendMessage(chatId,
                'Цю команду можуть використовувати лише адміністратори чату.',
                { reply_to_message_id: messageId }
            )
        }

        let chatData = await this.client.rozklad.chats.fetchChat(chatId);
        await chatData.update({ groupUUID: null });
        this.client.sendMessage(chatId, 'Група успішно видалена.', {
            reply_to_message_id: messageId
        })
    }
    async unbindGroupMessage(msg, args){
        this.unbindGroup(msg);
    }

    async sendLesson(msg, target, stage = this.LESSON_COMMAND_STAGES.CHAT, options = {}){
        let chatId = msg.chat.id;
        let userId = msg.from.id;
        let messageId = msg.message_id;

        const messageOptions = (keyboard) => {
            if (options.edit) return {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: { 
                    inline_keyboard: keyboard
                }
            }
            return {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: {
                    inline_keyboard: keyboard
                }
            }
        }
        const dateLabels = (date) => {
            let inputDate = moment(date);
            return {
                diff: formatTimeDefinition(getLessonDates(inputDate).lessonStart).toLowerCase(),
                label: formatCapitalize(inputDate.format('dddd, DD MMMM')),
                dayOfWeek: inputDate.format('dddd'),
                dayOfMonth: inputDate.format('DD MMMM'),
            }
        }

        let groupUUID, chatData;
        switch(stage){
            case this.LESSON_COMMAND_STAGES.CHAT: {
                chatData = await this.getChatOrNotifyIfNotBinded(msg);
                if (!chatData) return;
                groupUUID = chatData.groupUUID;
                break;
            }
            case this.LESSON_COMMAND_STAGES.DATA: {
                let groupName = formatGroupName(options.groupName);
                let groupData = await this.client.rozklad.schedules.fetchGroupsData(groupName);
                switch(groupData.length){
                    case 0: {
                        return this.client.sendMessage(
                            chatId, l('lesson.messages.stageData.notFound'), 
                            messageOptions()
                        )
                    }
                    case 1: {
                        groupUUID = groupData[0].uuid;
                        break;
                    }
                    default: {
                        return this.client.sendMessage(
                            chatId, l('lesson.messages.stageData.foundMultiple', { name: groupName }),
                            messageOptions([
                                ...groupData.map(group => {
                                    return [{
                                        text: group.name,
                                        callback_data: `lesson?t=${target}&d=${group.uuid}`
                                    }]
                                }),
                                localizeKeyboard([
                                    {
                                        text: 'lesson.buttons.stageData.hide',
                                        callback_data: 'delete'
                                    }
                                ])
                            ])
                        )
                    }
                }
                break;
            }
            case this.LESSON_COMMAND_STAGES.SCHEDULE: {
                groupUUID = options.groupUUID;
                break;
            }
            default: return;
        }
        let scheduleData = await this.client.rozklad.schedules.fetchGroupSchedule(groupUUID);
        if (!scheduleData?.data) return this.client.sendMessage(chatId, 
            l('lesson.messages.noSchedule'), 
            { parse_mode: 'HTML', reply_to_message_id: msg.message_id, }
        )
        chatData ??= await this.client.rozklad.chats.fetchChat(chatId);
        let lessonData = this.LESSONS_GETTERS[target](scheduleData.data);

        let msgText;
        let keyboard;
        switch(target) {
            case 'current':
            case 'next': {
                if (lessonData.result) {
                    let links = await this.client.rozklad.links.getLessonLinks({
                        chatId: chatData.id,
                        parentChatId: chatData.parentChatId,
                        hash: lessonData.result.hash,
                        date: lessonData.date,
                    });
                    let labels = dateLabels(lessonData.date);
                    if (target === 'current' && getBreak()) target = 'next';
                    msgText = l('lesson.targets.' + target + '.format', {
                        groupName: scheduleData.name,
                        lessonText: formatSingleLesson(lessonData.result, lessonData.number, links),
                        timeDiff: labels.diff,
                        timeLabel: labels.label
                    })
                } else {
                    msgText = l('lesson.targets.' + target + '.' + lessonData.reason, {
                        groupName: scheduleData.name,
                    })
                    if (target !== 'next') keyboard = localizeKeyboard([[{
                        text: 'lesson.buttons.nextLesson',
                        callback_data: `lesson?t=next&d=${scheduleData.uuid}`
                    }]])
                }
                break;
            }
            case 'today':
            case 'tomorrow':
            case 'nextday': {
                if (lessonData.result && lessonData.result.count) {
                    let labels = dateLabels(lessonData.date);
                    msgText = l('lesson..targets.' + target + '.format', {
                        groupName: scheduleData.name,
                        lessonText: formatLessonsDay(lessonData.result, !chatData.hideTime, !chatData.hideTeachers, false),
                        timeLabel: labels.label
                    })
                } else {
                    msgText = l('lesson.targets.' + target + '.' + lessonData.reason, {
                        groupName: scheduleData.name,
                    })
                    if (target !== 'nextday') keyboard = localizeKeyboard([[{
                        text: 'lesson.buttons.nextday',
                        callback_data: `lesson?t=nextday&d=${scheduleData.uuid}`
                    }]])
                }
                break;
            }
            case 'week_current':
            case 'week_next':
            case 'week_first':
            case 'week_second': {
                let currentWeek = getWeek();
                let resultWeek = getWeek(lessonData.date);
                let isCurrentWeek = currentWeek === resultWeek;
                let title = l('lesson.templates.week.titleFormat', {
                    weekNumberText: l('utils.weeksNumber.' + resultWeek),
                    isCurrentWeekText: l('utils.currentWeek.' + isCurrentWeek).toLowerCase(),
                    groupName: scheduleData.name,
                    ...dateLabels(lessonData.date)
                })
                let showTeachers = options.showTeachers ?? !chatData.hideTeachers;
                msgText = l('lesson.templates.week.message', {
                    title,
                    lessonText: formatLessonsWeek(lessonData.result, !chatData.hideTime, showTeachers),
                })
                let oppositeWeek = resultWeek ^ true;
  
                keyboard = localizeKeyboard([[
                    {
                        text: 'lesson.buttons.' + (oppositeWeek ? 'secondWeek' : 'firstWeek'),
                        callback_data: `lesson?o=${Number(showTeachers)}&t=${oppositeWeek ? 'week_second' : 'week_first'}&d=${scheduleData.uuid}`
                    },
                    {
                        text: 'lesson.buttons.' + (!showTeachers ? 'showTeachers' : 'hideTeachers'),
                        callback_data: `lesson?o=${Number(!showTeachers)}&t=${resultWeek ? 'week_second' : 'week_first'}&d=${scheduleData.uuid}`
                    }
                ]])
            }
        }
        if (options.edit) this.client.editMessageText(msgText, messageOptions(keyboard)).catch(e => console.error(String(e)));
        else this.client.sendMessage(chatId, msgText, messageOptions(keyboard));
    }
    async sendLessonMessage(msg, args, target){
        this.sendLesson(msg, target, args[0] ? this.LESSON_COMMAND_STAGES.DATA : this.LESSON_COMMAND_STAGES.CHAT, { 
            edit: false, groupName: args[0],
        });
    }
    async sendLessonCallbackQuery(query, params){
        let msg = query.message;
        let target = params.t;
        let showTeachers = params.o ? params.o == 1 : undefined;
        this.sendLesson(msg, target, params.d ? this.LESSON_COMMAND_STAGES.SCHEDULE : this.LESSON_COMMAND_STAGES.CHAT, {
            edit: true, showTeachers, groupUUID: params.d,
        });
    }

    async sendSettings(userMsg, botMsg, query, params){
        let chatId = userMsg.chat.id;
        let userId = userMsg.from.id;
        let messageId = userMsg.message_id;

        if (query){
            if (userMsg.from.id != query.from.id){
                return void this.client.answerCallbackQuery(query.id, {
                    text: 'Ви не можете використовувати ці кнопки.'
                })
            }
        } else {
            if (!await this.canUseAdminCommands(chatId, userId)){
                return void this.client.sendMessage(chatId,
                    'Цю команду можуть використовувати лише адміністратори чату.',
                    { reply_to_message_id: messageId }
                )
            }
        }

        let chatData = await this.client.rozklad.chats.fetchChat(chatId);
        if (query){
            switch(params.k){
                case 'hideTeachers':
                case 'hideTime':
                case 'beforeNotif':
                case 'nowNotif':
                case 'ignoreLinks': {
                    chatData = await chatData.update({
                        [params.k]: params.b == '1'
                    })
                    break;
                }
                default: break;
            }
        }
        let scheduleData = await this.client.rozklad.schedules.fetchGroupSchedule(chatData.groupUUID);
        let msgText = formatChatSettings(chatData, scheduleData);
        let keyboard = localizeKeyboard([
            [{ 
                text: `settings.buttons.toggleTeachers.${chatData.hideTeachers}`,
                callback_data: `settings?k=hideTeachers&b=${Number(!chatData.hideTeachers)}`
            }],
            [{ 
                text: `settings.buttons.toggleTime.${chatData.hideTime}`,
                callback_data: `settings?k=hideTime&b=${Number(!chatData.hideTime)}`
            }],
            [{ 
                text: `settings.buttons.toggleBeforeNotif.${!chatData.beforeNotif}`,
                callback_data: `settings?k=beforeNotif&b=${Number(!chatData.beforeNotif)}`
            }],
            [{ 
                text: `settings.buttons.toggleNowNotif.${!chatData.nowNotif}`,
                callback_data: `settings?k=nowNotif&b=${Number(!chatData.nowNotif)}`
            }],
            [{ 
                text: `settings.buttons.toggleLinks.${chatData.ignoreLinks}`,
                callback_data: `settings?k=ignoreLinks&b=${Number(!chatData.ignoreLinks)}`
            }],
            [{
                text: 'settings.buttons.close',
                callback_data: 'delete?u=' + userId
            }]
        ])
        if (query){
            this.client.editMessageText(msgText, {
                chat_id: chatId,
                message_id: botMsg.message_id,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: keyboard }
            })
        } else {
            this.client.sendMessage(chatId, msgText, { 
                parse_mode: 'HTML', reply_to_message_id: messageId,
                reply_markup: { inline_keyboard: keyboard }
            });
        }
    }
    async sendSettingsMessage(msg, args){
        this.sendSettings(msg);
    }
    async sendSettingsCallbackQuery(query, params){
        if (await this.deleteMessageIfNoReply(query)) return;
        this.sendSettings(query.message.reply_to_message, query.message, query, params);
    }

    async addLessonLink(userMsg, botMsg, stage, options){
        let chatId = userMsg.chat.id;
        let userId = userMsg.from.id;
        let messageId = userMsg.message_id;

        try {
            switch(stage){
                case this.LINK_COMMAND_STAGES.START: {
                    let chatData = await this.client.rozklad.chats.fetchChat(chatId);
                    if (chatData.ignoreLinks || !chatData.groupUUID) return;
                    let scheduleData = await this.client.rozklad.schedules.fetchGroupSchedule(chatData.groupUUID);
                    if (!scheduleData) return;
                    let lessonData = getCurrentLesson(scheduleData.data);
                    if (!lessonData.result) return;
                    let currentLinks = await this.client.rozklad.links.getLessonLinks({
                        chatId: chatData.id,
                        hash: lessonData.result.hash,
                        inactive: true,
                        date: lessonData.date,
                    })
                    if (currentLinks.length > 3 || currentLinks.some(link => link.url === options.linkUrl)) return;
                    let lessonHash = lessonData.result.hash;
                    let linkData = await this.client.rozklad.links.createInactiveLink({
                        chatId, 
                        hash: lessonHash,
                        url: options.linkUrl,
                        type: options.linkType,
                        expiresAt: lessonData.date.endOf('day').toDate(),
                    })
                    let lessonName = lessonData.result.name;
                    if (lessonName.length > 64) lessonName = lessonName.substring(0, 61) + '...';
                    this.client.sendMessage(chatId, l('link.messages.stageStart.message'), {
                        parse_mode: 'HTML',
                        reply_to_message_id: messageId,
                        reply_markup: {
                            inline_keyboard: localizeKeyboard([[
                                {
                                    text: 'link.buttons.stageStart.addPerm',
                                    callback_data: `link?s=${this.LINK_COMMAND_STAGES.NAME}&d=${linkData.id}`
                                },
                                {
                                    text: 'link.buttons.stageStart.addTemp',
                                    callback_data: `link?s=${this.LINK_COMMAND_STAGES.TEMP}&d=${linkData.id}`
                                },
                                {
                                    text: 'link.buttons.stageStart.cancel',
                                    callback_data: `link?s=${this.LINK_COMMAND_STAGES.CANCEL}&d=${linkData.id}`
                                }
                            ]])
                        }
                    })
                    return
                }
                case this.LINK_COMMAND_STAGES.CANCEL: {
                    if (botMsg) this.client.deleteMessage(chatId, botMsg.message_id).catch(e => null);
                    this.client.rozklad.links.deleteLink(options.linkId);
                    return;
                }
                case this.LINK_COMMAND_STAGES.TEMP: {
                    let linkData = await this.client.rozklad.links.fetchLink(options.linkId);
                    if (!linkData) return this.addLessonLink(msg, this.LINK_COMMAND_STAGES.CANCEL, options);
                    linkData.update({
                        name: `${linkData.type} (тимч.)`,
                        active: true,
                    })
                    this.client.editMessageText(l('link.messages.stageTemp.added'), {
                        chat_id: chatId,
                        message_id: botMsg.message_id,
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: [] }
                    })
                    return;
                }
                case this.LINK_COMMAND_STAGES.NAME: {
                    let linkData = await this.client.rozklad.links.fetchLink(options.linkId);
                    if (!linkData) return this.addLessonLink(userMsg, botMsg, this.LINK_COMMAND_STAGES.CANCEL, options);
                    this.client.deleteMessage(chatId, botMsg.message_id).catch(e => null);
                    let responseBotMsg = await this.client.sendMessage(chatId, l('link.messages.stageName.message'), {
                        parse_mode: 'HTML',
                        reply_to_message_id: messageId,
                        reply_markup: {
                            force_reply: true,
                            input_field_placeholder: l('link.placeholders.stageName.linkName')
                        }
                    })
                    let nameUserMsg = await this.client.awaitReplyToMessage(chatId, responseBotMsg.message_id, {
                        filter: filterMsg => {
                            if (filterMsg.from.id !== userId || !filterMsg.text) return false;
                            if (filterMsg.text.length > 32){
                                this.client.sendMessage(chatId, l('link.messages.stageName.tooLong'), {
                                    parse_mode: 'HTML',
                                    reply_to_message_id: filterMsg.message_id,
                                })
                                return false;
                            }
                            return true;
                        }
                    })
                    let semester = getSemester(linkData.createdAt);
                    linkData.update({
                        name: nameUserMsg.text,
                        active: true,
                        expiresAt: moment({ month: 0 }).add(semester ? 5 : 12, 'month').endOf('month').toDate()
                    })
                    this.client.sendMessage(chatId, l('link.messages.stageName.added'), {
                        parse_mode: 'HTML',
                        reply_to_message_id: nameUserMsg.message_id,
                        reply_markup: {
                            remove_keyboard: true,
                            selective: true
                        }
                    })
                    return;
                }
            }
        } catch(e){
            console.error(e);
        }
    }
    async addLessonLinkMessage(msg, linkUrl, linkType){
        this.addLessonLink(msg, null, this.LINK_COMMAND_STAGES.START, {
            linkUrl, linkType 
        })
    }
    async addLessonLinkCallbackQuery(query, params){
        if (await this.deleteMessageIfNoReply(query)) return;
        this.addLessonLink(query.message.reply_to_message, query.message, params.s, {
            linkId: params.d
        })
    }

    async deleteLessonLink(msg, options = {}){
        let lessonHash;

        const messageOptions = keyboard => {
            if (options.edit) return {
                parse_mode: 'HTML',
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: keyboard ?? []
                }
            }
            return {
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: keyboard ?? []
                }
            }
        }

        if (!options.hash){
            let chatData = await this.getChatOrNotifyIfNotBinded(msg);
            if (!chatData) return;
            let scheduleData = await this.getScheduleOrNotifyIfNotExists(msg, chatData);
            if (!scheduleData) return;
            let lessonData = getCurrentLesson(scheduleData.data);
            if (!lessonData.result) {
                return this.client.sendMessage(msg.chat.id, l('linksDelete.messages.noLesson'), messageOptions());
            };
            lessonHash = lessonData.result.hash;
        } else {
            lessonHash = options.hash;
        }
        if (options.deleteId) await this.client.rozklad.links.deleteLink(options.deleteId);
        let currentLinks = await this.client.rozklad.links.getLessonLinks({
            chatId: msg.chat.id,
            hash: lessonHash,
        })
        if (!currentLinks.length){
            if (options.edit){
                this.client.editMessageText(l('linksDelete.messages.allDeleted'), messageOptions());
            } else {
                this.client.sendMessage(msg.chat.id, l('linksDelete.messages.noLinks'), messageOptions());
            }
            return
        }
        let keyboard = [
            ...currentLinks.map(link => {
                return [{
                    text: link.name,
                    callback_data: `linkdel?d=${link.id}`
                }]
            }),
            localizeKeyboard([{
                text: 'linksDelete.buttons.close',
                callback_data: 'delete'
            }])
        ]
        if (options.edit){
            this.client.editMessageText(l('linksDelete.messages.message'), messageOptions(keyboard)).catch(e => null);
        } else {
            this.client.sendMessage(msg.chat.id, l('linksDelete.messages.message'), messageOptions(keyboard))
        }
    }
    async deleteLessonLinkMessage(msg){
        this.deleteLessonLink(msg);
    }
    async deleteLessonLinkCallbackQuery(query, params){
        this.deleteLessonLink(query.message, {
            edit: true,
            deleteId: params.d,
            hash: params.h
        })
    }
}