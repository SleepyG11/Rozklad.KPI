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

client.commands.on('#command', (msg, params, target) => {
    if (![
        'current', 'next', 'today', 'tomorrow', 'nextday', 'week_current', 'week_next'
    ].includes(target)) return;
    client.rozklad.commands.sendLessonMessage(msg, params, target);
})
client.queries.on('lesson', (query, params) => {
    client.rozklad.commands.sendLessonCallbackQuery(query, params);
})

// ------------------------

const LINK_TYPES = {
    'Zoom': /https:\/\/(?:.+)\.zoom\.us\/(?:.+)(?: |$)/,
    'Meet': /https:\/\/meet\.google\.com\/(?:.+)(?: |$)/
}

for (let linkType in LINK_TYPES){
    client.onText(LINK_TYPES[linkType], (msg, match) => {
        client.rozklad.commands.addLessonLinkMessage(msg, match[0], linkType);
    })
}
client.queries.on('link', (query, params) => {
    client.rozklad.commands.addLessonLinkCallbackQuery(query, params);
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

// ------------------------

client.queries.on('delete', (query, params) => {
    client.rozklad.commands.deleteCallbackQuery(query, params);
})

db.sync({ alter: true }).then(() => {
    client.rozklad.commands.startNotificationsLoop();
    client.rozklad.commands.startSemesterClearLoop();
    client.startPolling({ 
        polling: { 
            interval: 1250, params: { 
                allowed_updates: ['callback_query', 'message']
            } 
        } 
    });
    console.log('Bot started.')
})
