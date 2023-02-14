require('dotenv').config();
const { spawn } = require('node:child_process');

let botProcess;
function onCloseBotProcess(code, start){
    botProcess = spawn('node bot.js', {
        shell: true,
        stdio: 'inherit',
        env: process.env
    })
    botProcess.on('close', onCloseBotProcess);
}
onCloseBotProcess(0, true);