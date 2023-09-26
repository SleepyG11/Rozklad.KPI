import moment from 'moment-timezone';
moment.locale('uk');
moment.tz.setDefault("Europe/Kyiv");

import TelegramClient from './app/bot.js';
import db from './app/database';

const client = new TelegramClient(process.env.TELEGRAM_BOT_TOKEN);

// ------------------------

client.commands.on('bind', async (msg, args) => {
    client.rozklad.commands.bindGroupMessage(msg, args);
})
client.queries.on('bind', async (query, params) => {
    client.rozklad.commands.bindGroupCallbackQuery(query, params);
})
client.commands.on('unbind', (msg, args) => {
    client.rozklad.commands.unbindGroupMessage(msg, args);
})

// ------------------------

client.commands.on('settings', msg => {
    client.rozklad.commands.sendSettingsMessage(msg);
})
client.queries.on('settings', (query, params) => {
    client.rozklad.commands.sendSettingsCallbackQuery(query, params);
})

// ------------------------

;[
    'current', 'next', 'today', 'tomorrow', 'nextday', 'week_current', 'week_next'
].forEach(target => {
    client.commands.on(target, (msg, params) => {
        client.rozklad.admin.addCommandUse();
        client.rozklad.commands.sendLessonMessage(msg, params, target);
    })
})

client.queries.on('lesson', (query, params) => {
    client.rozklad.commands.sendLessonCallbackQuery(query, params);
})

// ------------------------

const LINK_TYPES = client.rozklad.commands.LINK_TYPES;
for (let linkType in LINK_TYPES){
    client.onText(LINK_TYPES[linkType], (msg, match) => {
        if (msg.reply_to_message && msg.reply_to_message.from.id == client.me.id) return;
        client.rozklad.commands.addLessonLinkMessage(msg, match[0].trim(), linkType);
    })
}
client.queries.on('link', (query, params) => {
    client.rozklad.commands.addLessonLinkCallbackQuery(query, params);
})
client.commands.on('links_add', (msg, args) => {
    client.rozklad.commands.addLessonLinkDirectlyMessage(msg);
})
client.commands.on('links_share', (msg, args) => {
    client.rozklad.commands.shareLinksMessage(msg, args);
})
client.commands.on('links_delete', (msg, args) => {
    client.rozklad.commands.deleteLessonLinkMessage(msg, args);
})
client.queries.on('linkdel', (query, params) => {
    client.rozklad.commands.deleteLessonLinkCallbackQuery(query, params);
})

// ------------------------

client.commands.on('start', (msg, args) => {
    client.rozklad.commands.sendStartMessage(msg, args);
})
client.commands.on('about', msg => {
    client.rozklad.commands.sendAboutMessage(msg);
})
client.commands.on('help', msg => {
    client.rozklad.commands.sendHelpMessage(msg);
})
client.queries.on('help', (query, params) => {
    client.rozklad.commands.sendHelpCallbackQuery(query, params);
})

// ------------------------

client.commands.on('eval', (msg, args) => {
    client.rozklad.admin.eval(msg, args);
})
client.commands.on('admin_stats', (msg, args) => {
    client.rozklad.admin.globalStats(msg, args);
})
client.commands.on('admin_groups_stats', (msg, args) => {
    client.rozklad.admin.globalGroupsStats(msg, args);
})

// ------------------------

client.queries.on('delete', (query, params) => {
    client.rozklad.commands.deleteCallbackQuery(query, params);
})

// ------------------------

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// ------------------------

db.sync({ alter: true }).then(async () => {
    client.rozklad.commands.startNotificationsLoop();
    client.rozklad.commands.startSemesterClearLoop();
    await client.rozklad.admin.init();
    client.startPolling({ 
        polling: { 
            interval: 1250, params: { 
                timeout: 1,
                allowed_updates: ['callback_query', 'message']
            } 
        } 
    });
    console.log('Bot started.')
})