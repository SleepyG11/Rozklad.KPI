import moment from "moment-timezone";
import { AbortError } from "node-fetch";

import TelegramClient from '../bot';
import { l, localizeKeyboard } from '../utils/messages';
import {
	getCurrentLesson,
	getCurrentWeekLessons,
	getFirstWeekLessons,
	getNextDayLessons,
	getNextLesson,
	getNextWeekLessons,
	getSecondWeekLessons,
	getTodayLessons,
	getTomorrowLessons,
} from '../utils/lessons';
import {
	formatChatSettings,
	formatDateLabels,
	formatGroupName,
	formatLessonsDay,
	formatLessonsWeek,
	formatSingleLesson,
} from '../utils/format';
import { getBreak, getLessonDates, getLessonNumber, getSemester, getWeek } from '../utils/times';
import { getWeekend } from '../utils/weekends';

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
    LINK_TYPES = {
        'Zoom': /https:\/\/(?:.+)\.zoom\.us\/(?:[^ \r\n]+)(?: |$)/,
        'Meet': /https:\/\/meet\.google\.com\/(?:[^ \r\n]+)(?: |$)/,
        'MS Teams': /https:\/\/teams\.microsoft\.com\/(?:[^ \r\n]+)(?: |$)/,
    }

    /**
     * @param {TelegramClient} client 
     */
    constructor(client){
        this.client = client;
        this.currentLessonNumber = getLessonNumber();
        this.currentSemesterNumber = getSemester();
    }

    async startNotificationsSend(type){
        let chats = await this.client.rozklad.chats.getChatsForNotification(type);
        let target;
        switch(type){
            case 'beforeNotif': target = 'next'; break;
            case 'nowNotif': target = 'current'; break;
            default: return;
        }
        const iterate = async () => {
            let chatData = chats.shift();
            if (!chatData) return;
            setTimeout(iterate, 300);

            let scheduleData = await this.client.rozklad.schedules.fetchGroupSchedule(chatData.groupUUID);
            if (!scheduleData) return;
            let lessonData = getCurrentLesson(scheduleData.data);
            if (!lessonData.result) return;

            let links = await this.client.rozklad.links.getLessonLinks({
                chatId: chatData.id,
                parentChatId: chatData.parentChatId,
                hash: lessonData.result.hash,
                date: lessonData.date,
            });
            let labels = formatDateLabels(lessonData.date);

            let msgText = l(`lesson.targets.${target}.message`, {
                groupName: scheduleData.name,
                lessonText: formatSingleLesson(lessonData.result, lessonData.number, links),
                timeDiff: labels.diff,
                timeLabel: labels.label
            })
            this.client.sendMessage(chatData.id, msgText, {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            }).then(() => {
                this.client.rozklad.admin.addNotificationCount(target);
                this.client.rozklad.admin.updateLastUsageDate(chatData.id);
            }, e => null);
        }
        iterate();
    }
    startNotificationsLoop(){
        setInterval(() => {
            let newLessonNumber = getLessonNumber();
            if (this.currentLessonNumber === newLessonNumber) return;
            this.currentLessonNumber = newLessonNumber;

            let lessonDates = getLessonDates();
            if (lessonDates.isDayStart || lessonDates.isDayEnd || getWeekend()) return;
            let beforeDate = moment(lessonDates.lessonStart).add(-15, 'minutes');
            let nowDate = moment(lessonDates.lessonStart);

            setTimeout(() => this.startNotificationsSend('beforeNotif'), beforeDate.diff());
            setTimeout(() => this.startNotificationsSend('nowNotif'), nowDate.diff());
        }, 60000)
    }

    startSemesterClearLoop(){
        setInterval(() => {
            let newSemesterNumber = getSemester();
            if (this.currentSemesterNumber === newSemesterNumber) return;
            this.currentSemesterNumber = newSemesterNumber;

            this.client.rozklad.chats.clear();
            this.client.rozklad.schedules.clear();
            this.client.rozklad.links.clear();
        }, 60000)
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
        if (query.message.reply_to_message) return false;
        this.client.deleteMessage(query.message.chat.id, query.message.message_id).catch(e => null);
        this.client.sendMessage(query.message.chat.id, l('global.replyMessageDeleted'))
        return true;
    }

    async rejectIfNotButtonAuthor(query){
        if (query.from.id == query.message.reply_to_message.from.id) return false;
        this.client.answerCallbackQuery(query.id, {
            text: l('global.cantUseButton')
        })
        return true;
    }
    async rejectIfNotChatAdmin(msg){
        if (await this.canUseAdminCommands(msg.chat.id, msg.from.id)) return false;
        this.client.sendMessage(msg.chat.id,
            l('global.cantUseAdminCommand'),
            { reply_to_message_id: msg.message_id }
        )
        return true;
    }
    async rejectIfNotGroupChat(msg){
        if (msg.chat.id < 0) return false;
        this.client.sendMessage(msg.chat.id,
            l('global.groupChatOnly'),
            { reply_to_message_id: msg.message_id }
        )
        return true;
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
                                input_field_placeholder: l('bind.placeholders.stageStart.groupName'),
                                selective: true
                            }
                        }
                    )
                    let nameUserMsg = await this.client.awaitReplyToMessage(
                        chatId, responseBotMsg.message_id,
                        { 
                            signal: AbortSignal.timeout(60000 * 10),
                            filter: filterMsg => filterMsg.from.id === userId && filterMsg.text
                        }
                    ).catch(e => {
                        if (e instanceof AbortError) {
                            this.client.deleteMessage(chatId, responseBotMsg.message_id);
                            return null;
                        }
                        throw e;
                    })
                    if (!nameUserMsg) return;
                    messageId = nameUserMsg.message_id;
                    data = nameUserMsg.text.substring(0, 10);
                }
                case this.BIND_COMMAND_STAGES.NAME: {
                    let groupNames = await this.client.rozklad.schedules.fetchGroupsName(data);
                    switch(groupNames.length){
                        case 0: {
                            return this.client.sendMessage(
                                chatId, l('bind.messages.stageName.notFound'), 
                                messageOptions()
                            )
                        }
                        case 1: {
                            return this.client.sendMessage(
                                chatId, l('bind.messages.stageName.foundOne', groupNames[0]),
                                messageOptions(
                                    localizeKeyboard([[
                                        {
                                            text: 'bind.buttons.stageName.accept',
                                            callback_data: `bind?s=${this.BIND_COMMAND_STAGES.DATA}&d=${groupNames[0].name}`
                                        },
                                        {
                                            text: 'bind.buttons.stageName.cancel',
                                            callback_data: 'delete?u=' + userId
                                        }
                                    ]])
                                )
                            )
                        }
                        default: {
                            return this.client.sendMessage(
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
                                            callback_data: 'delete?u=' + userId
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
                            return this.client.sendMessage(
                                chatId, l('bind.messages.stageData.notFound'), 
                                messageOptions()
                            )
                        }
                        case 1: {
                            data = groupData[0].uuid; break;
                        }
                        default: {
                            return this.client.sendMessage(
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
                                            callback_data: 'delete?u=' + userId
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
                        return this.client.sendMessage(chatId, l('bind.messages.stageEnd.notFound'), messageOptions())
                    }
                    let chatData = await this.client.rozklad.chats.fetchChat(chatId);
                    let isFirstBind = chatData.isFirstBind;
                    await chatData.update({ groupUUID: groupSchedule.uuid, isFirstBind: false });
                    return this.client.sendMessage(
                        chatId, l(`bind.messages.stageEnd.${isFirstBind ? 'successFirst' : 'success'}`, groupSchedule), 
                        messageOptions()
                    )
                }
            }
        } catch(e){
            console.log(e);
        }
    }
    async bindGroupMessage(msg, args){
        if (await this.rejectIfNotChatAdmin(msg)) return;
        args[0] ? this.bindGroup(msg, this.BIND_COMMAND_STAGES.NAME, args[0]) : this.bindGroup(msg);
    }
    async bindGroupCallbackQuery(query, params){
        if (await this.deleteMessageIfNoReply(query)) return;
        if (await this.rejectIfNotButtonAuthor(query)) return;
        this.client.deleteMessage(query.message.chat.id, query.message.message_id).catch(e => null);
        this.bindGroup(query.message.reply_to_message, params.s, params.d);
    }

    async unbindGroup(msg){
        let chatId = msg.chat.id;
        let userId = msg.from.id;
        let messageId = msg.message_id;

        let chatData = await this.client.rozklad.chats.fetchChat(chatId);
        await chatData.update({ groupUUID: null });
        this.client.sendMessage(chatId, l('unbind.messages.success'), {
            reply_to_message_id: messageId
        })
    }
    async unbindGroupMessage(msg, args){
        if (await this.rejectIfNotChatAdmin(msg)) return;
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
                    let labels = formatDateLabels(lessonData.date);
                    if (target === 'current' && getBreak()) target = 'next';

                    msgText = l('lesson.targets.' + target + '.message', {
                        groupName: scheduleData.name,
                        lessonText: formatSingleLesson(lessonData.result, lessonData.number, links),
                        timeDiff: labels.diff,
                        timeLabel: labels.label
                    })
                } else {
                    msgText = l('lesson.targets.' + target + '.' + lessonData.reason, {
                        groupName: scheduleData.name,
                        weekendName: getWeekend()?.toLowerCase()
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
                    let labels = formatDateLabels(lessonData.date);
                    msgText = l('lesson.targets.' + target + '.message', {
                        groupName: scheduleData.name,
                        lessonText: formatLessonsDay(lessonData.result, !chatData.hideTime, !chatData.hideTeachers, false),
                        timeLabel: labels.label
                    })
                } else {
                    msgText = l('lesson.targets.' + target + '.' + lessonData.reason, {
                        groupName: scheduleData.name,
                        weekendName: getWeekend(lessonData.date)?.toLowerCase(),
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

                let title = l('lesson.templates.week.title', {
                    weekNumberText: l('utils.weeksNumber.' + resultWeek),
                    isCurrentWeekText: l('utils.currentWeek.' + isCurrentWeek).toLowerCase(),
                    groupName: scheduleData.name,
                    ...formatDateLabels(lessonData.date)
                })
                let showTeachers = options.showTeachers ?? !chatData.hideTeachers;
                let isTooLong = false;

                msgText = l('lesson.templates.week.message', {
                    title, lessonText: formatLessonsWeek(lessonData.result, showTeachers),
                })
                if (msgText.length > 4096) {
                    isTooLong = true;
                    msgText = l('lesson.templates.week.message', {
                        title, lessonText: formatLessonsWeek(lessonData.result, false),
                    })
                }
                if (msgText.length > 4096) msgText = l('lesson.messages.tooLong');
                let oppositeWeek = resultWeek ^ true;
  
                keyboard = localizeKeyboard([[
                    {
                        text: 'lesson.buttons.' + (oppositeWeek ? 'secondWeek' : 'firstWeek'),
                        callback_data: `lesson?o=${Number(showTeachers)}&t=${oppositeWeek ? 'week_second' : 'week_first'}&d=${scheduleData.uuid}`
                    },
                    isTooLong ? null : {
                        text: 'lesson.buttons.' + (!showTeachers ? 'showTeachers' : 'hideTeachers'),
                        callback_data: `lesson?o=${Number(!showTeachers)}&t=${resultWeek ? 'week_second' : 'week_first'}&d=${scheduleData.uuid}`
                    }
                ].filter(Boolean)])
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
                case 'removeParent': {
                    chatData = await chatData.update({
                        parentChatId: null
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
            chatData.parentChatId ? [{
                text: `settings.buttons.removeParent`,
                callback_data: `settings?k=removeParent`
            }] : null,
            [{
                text: 'settings.buttons.close',
                callback_data: 'delete?u=' + userId
            }]
        ].filter(Boolean))
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
        if (await this.rejectIfNotChatAdmin(msg)) return;
        this.sendSettings(msg);
    }
    async sendSettingsCallbackQuery(query, params){
        if (await this.deleteMessageIfNoReply(query)) return;
        if (await this.rejectIfNotButtonAuthor(query)) return;
        this.sendSettings(query.message.reply_to_message, query.message, query, params);
    }

    async addLessonLink(userMsg, botMsg, stage, options){
        let chatId = userMsg.chat.id;
        let userId = userMsg.from.id;
        let messageId = userMsg.message_id;

        let linkUrl = options.linkUrl;
        let linkType = options.linkType;

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
                    if (currentLinks.length > 3 || currentLinks.some(link => link.url === linkUrl)) return;

                    let lessonHash = lessonData.result.hash;
                    let linkData = await this.client.rozklad.links.createInactiveLink({
                        chatId, 
                        hash: lessonHash, url: linkUrl, type: linkType,
                        expiresAt: lessonData.date.endOf('day').toDate(),
                    })

                    // let lessonName = lessonData.result.name;
                    // if (lessonName.length > 64) lessonName = lessonName.substring(0, 61) + '...';
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
                    this.client.deleteMessage(chatId, botMsg.message_id).catch(e => null);
                    this.client.sendMessage(chatId, l('link.messages.stageTemp.added'), {
                        parse_mode: 'HTML', reply_to_message_id: messageId,
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
                            selective: true,
                            input_field_placeholder: l('link.placeholders.stageName.linkName')
                        }
                    })
                    let nameUserMsg = await this.client.awaitReplyToMessage(chatId, responseBotMsg.message_id, {
                        signal: AbortSignal.timeout(60000 * 10),
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
                    }).catch(e => {
                        if (e instanceof AbortError) {
                            this.client.deleteMessage(chatId, responseBotMsg.message_id);
                            return null;
                        }
                        throw e;
                    })
                    if (!nameUserMsg) return;

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
        if (await this.rejectIfNotButtonAuthor(query)) return;
        this.addLessonLink(query.message.reply_to_message, query.message, params.s, {
            linkId: params.d
        })
    }

    async addLessonLinkDirectly(msg){
        let chatId = msg.chat.id;
        let userId = msg.from.id;
        let messageId = msg.message_id;

        let messageOptions = {
            parse_mode: 'HTML', reply_to_message_id: messageId
        }

        let chatData = await this.getChatOrNotifyIfNotBinded(msg);
        if (!chatData) return;
        let scheduleData = await this.getScheduleOrNotifyIfNotExists(msg, chatData);
        if (!scheduleData) return;
        let lessonData = getCurrentLesson(scheduleData.data);
        if (!lessonData.result) {
            return this.client.sendMessage(
                chatId, l('link.messages.directive.noLesson'), messageOptions
            );
        };

        let currentLinks = await this.client.rozklad.links.getLessonLinks({
            chatId: chatData.id,
            hash: lessonData.result.hash,
            inactive: true,
            date: lessonData.date,
        })
        if (currentLinks.length > 3){
            return this.client.sendMessage(
                chatId, l('link.messages.directive.limitExceeded'), messageOptions
            );
        }

        let responseBotMsg = await this.client.sendMessage(
            chatId, l('link.messages.directive.message'),
            {
                parse_mode: 'HTML',
                reply_to_message_id: messageId,
                reply_markup: {
                    force_reply: true,
                    selective: true,
                    input_field_placeholder: l('link.placeholders.directive.linkUrl')
                }
            }
        )
        let linkUserMsg = await this.client.awaitReplyToMessage(
            chatId, responseBotMsg.message_id, 
            { 
                signal: AbortSignal.timeout(60000 * 10),
                filter: filterMsg => filterMsg.from.id === userId && filterMsg.text
            }
        ).catch(e => {
            if (e instanceof AbortError) {
                this.client.deleteMessage(chatId, responseBotMsg.message_id);
                return null;
            }
            throw e;
        })
        if (!linkUserMsg) return;
        messageId = linkUserMsg.message_id;
        messageOptions = {
            parse_mode: 'HTML', reply_to_message_id: messageId,
            reply_markup: {
                remove_keyboard: true,
                selective: true,
            }
        }
        let linkUrl, linkType;
        for (let type in this.LINK_TYPES){
            let match = this.LINK_TYPES[type].exec(linkUserMsg.text);
            if (!match) continue;
            linkUrl = match[0].trim().substring(0, 512);
            linkType = type;
        }
        if (!linkType){
            return this.sendMessage(
                chatId, l('link.messages.directive.invalidUrl'), messageOptions
            )
        }
        // Refresh data
        currentLinks = await this.client.rozklad.links.getLessonLinks({
            chatId: chatData.id,
            hash: lessonData.result.hash,
            inactive: true,
            date: lessonData.date,
        })
        if (currentLinks.length > 3){
            return this.client.sendMessage(
                msg.chat.id, l('link.messages.directive.limitExceeded'), messageOptions
            );
        }
        if (currentLinks.some(link => link.url === linkUrl)) {
            this.client.sendMessage(
                msg.chat.id, l('link.messages.directive.alreadyExists'), messageOptions
            );
        };

        let lessonHash = lessonData.result.hash;
        let linkData = await this.client.rozklad.links.createInactiveLink({
            chatId, 
            hash: lessonHash,
            url: linkUrl,
            type: linkType,
            expiresAt: lessonData.date.endOf('day').toDate(),
        })

        this.client.sendMessage(chatId, l('link.messages.directive.chooseType'), {
            parse_mode: 'HTML',
            reply_to_message_id: messageId,
            reply_markup: {
                remove_keyboard: true,
                selective: true,
                inline_keyboard: localizeKeyboard([[
                    {
                        text: 'link.buttons.directive.addPerm',
                        callback_data: `link?s=${this.LINK_COMMAND_STAGES.NAME}&d=${linkData.id}`
                    },
                    {
                        text: 'link.buttons.directive.addTemp',
                        callback_data: `link?s=${this.LINK_COMMAND_STAGES.TEMP}&d=${linkData.id}`
                    },
                    {
                        text: 'link.buttons.directive.cancel',
                        callback_data: `link?s=${this.LINK_COMMAND_STAGES.CANCEL}&d=${linkData.id}`
                    }
                ]])
            }
        })
    }
    async addLessonLinkDirectlyMessage(msg, args){
        this.addLessonLinkDirectly(msg);
    }

    async deleteLessonLink(msg, options = {}){
        let chatId = msg.chat.id;
        let userId = msg.from.id;
        let messageId = msg.message_id;
        let lessonHash;

        const messageOptions = keyboard => {
            if (options.edit) return {
                parse_mode: 'HTML',
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: keyboard ?? []
                }
            }
            return {
                parse_mode: 'HTML',
                reply_to_message_id: messageId,
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
                return this.client.sendMessage(chatId, l('linksDelete.messages.noLesson'), messageOptions());
            };
            lessonHash = lessonData.result.hash;
        } else {
            lessonHash = options.hash;
        }

        if (options.deleteId) await this.client.rozklad.links.deleteLink(options.deleteId);
        let currentLinks = await this.client.rozklad.links.getLessonLinks({
            chatId, hash: lessonHash,
        })

        if (!currentLinks.length){
            if (options.edit){
                this.client.editMessageText(l('linksDelete.messages.allDeleted'), messageOptions());
            } else {
                this.client.sendMessage(chatId, l('linksDelete.messages.noLinks'), messageOptions());
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
                callback_data: 'delete?u=' + userId
            }])
        ]
        if (options.edit){
            this.client.editMessageText(l('linksDelete.messages.message'), messageOptions(keyboard)).catch(e => null);
        } else {
            this.client.sendMessage(chatId, l('linksDelete.messages.message'), messageOptions(keyboard))
        }
    }
    async deleteLessonLinkMessage(msg){
        this.deleteLessonLink(msg);
    }
    async deleteLessonLinkCallbackQuery(query, params){
        if (await this.deleteMessageIfNoReply(query)) return;
        if (await this.rejectIfNotButtonAuthor(query)) return;
        this.deleteLessonLink(query.message, {
            edit: true, deleteId: params.d, hash: params.h
        })
    }

    async shareLinks(msg){
        this.client.sendMessage(msg.chat.id, l('linksShare.messages.message'), {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: localizeKeyboard([[{
                    text: 'linksShare.buttons.add',
                    url: `https://t.me/${this.client.me.username}?start=${msg.chat.id}`
                }]])
            }
        })
    }
    async shareLinksMessage(msg, args){
        if (await this.rejectIfNotGroupChat(msg)) return;
        if (await this.rejectIfNotChatAdmin(msg)) return;
        this.shareLinks(msg);
    }

    async sendStart(msg, parentId){
        let chatId = msg.chat.id;
        let userId = msg.from.id;

        const fallback = () => {
            this.client.sendMessage(
                chatId, l('start.messages.message'), 
                { parse_mode: 'HTML', disable_web_page_preview: true }
            );
        }
        if (!parentId) return fallback();

        let member = await this.client.getChatMember(parentId, userId);
        if (!['creator', 'member', 'administrator'].includes(member.status)) return fallback()

        let [msgChatData, targetChatData] = await Promise.all([
            this.client.rozklad.chats.fetchChat(chatId),
            this.client.rozklad.chats.fetchChat(parentId),
        ])
        let isFirstBind = msgChatData.isFirstBind;

        msgChatData.update({
            groupUUID: targetChatData.groupUUID,
            parentChatId: targetChatData.id,
            isFirstBind: false
        })
        this.client.sendMessage(
            chatId, l(`start.messages.${isFirstBind ? 'parentAddedFirst' : 'parentAdded'}`),
            { parse_mode: 'HTML', disable_web_page_preview: true }
        )
    }
    async sendStartMessage(msg, args){
        this.sendStart(msg, args[0]);
    }

    async sendAbout(msg){
        let buttons = ['privacy'];
        this.client.sendMessage(msg.chat.id, l('about.messages.message', {
            botUsername: this.client.me.username,
            botName: this.client.me.first_name,
            scheduleHost: process.env.ROZKLAD_HOST
        }), {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: localizeKeyboard(buttons.map(button => {
                    return [{
                        text: `help.buttons.${button}`,
                        callback_data: `help?s=${button}`
                    }]
                }))
            }
        })
    }
    async sendAboutMessage(msg){
        this.sendAbout(msg);
    }

    async sendHelp(msg, section){
        if (section){
            return this.client.sendMessage(msg.chat.id, l(`help.messages.${section}`), {
                parse_mode: 'HTML', disable_web_page_preview: true,
            })
        }
        let buttons = ['notifs', 'links', 'privacy'];
        this.client.sendMessage(msg.chat.id, l('help.messages.message'), {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: localizeKeyboard(buttons.map(button => {
                    return [{
                        text: `help.buttons.${button}`,
                        callback_data: `help?s=${button}`
                    }]
                }))
            }
        })
    }
    async sendHelpMessage(msg){
        this.sendHelp(msg);
    }
    async sendHelpCallbackQuery(query, params){
        this.client.answerCallbackQuery(query.id);
        this.sendHelp(query.message, params.s);
    }

    async delete(msg){
        this.client.deleteMessage(msg.chat.id, msg.message_id).catch(e => null);
    }
    async deleteMessage(msg, args){
        this.delete(msg);
    }
    async deleteCallbackQuery(query, params){
        if (params.u && params.u != query.from.id) {
            return void this.client.answerCallbackQuery(query.id, {
                text: l('global.cantUseButton')
            })
        };
        this.delete(query.message);
    }
}