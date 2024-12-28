// src/main/ipcHandlers.cjs

const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const { getMainWindow } = require('./windowManager.cjs');
let currentLogFilePath = null;

function registerIPCHandlers() {

    // データ保存
    ipcMain.on('save-data', (event, data) => {
        try {
            const mainWindow = getMainWindow();
            dialog.showSaveDialog(mainWindow, {
                title: 'データを保存',
                defaultPath: 'data.json',
                filters: [{ name: 'JSON Files', extensions: ['json'] }],
            }).then((result) => {
                if (!result.canceled && result.filePath) {
                    fs.writeFile(result.filePath, JSON.stringify(data, null, 2), (err) => {
                        if (err) {
                            event.reply('save-data-reply', false);
                        } else {
                            event.reply('save-data-reply', true);
                        }
                    });
                } else {
                    event.reply('save-data-reply', false);
                }
            }).catch((err) => {
                event.reply('save-data-reply', false);
            });
        } catch (error) {
            event.reply('save-data-reply', false);
        }
    });

    // データ読み込み
    ipcMain.on('load-data', (event) => {
        try {
            const mainWindow = getMainWindow();
            dialog.showOpenDialog(mainWindow, {
                title: 'データを開く',
                filters: [{ name: 'JSON Files', extensions: ['json'] }],
            }).then((result) => {
                if (!result.canceled && result.filePaths.length > 0) {
                    fs.readFile(result.filePaths[0], 'utf-8', (err, fileData) => {
                        if (err) {
                            event.reply('load-data-reply', null);
                        } else {
                            try {
                                const jsonData = JSON.parse(fileData);
                                event.reply('load-data-reply', jsonData);
                            } catch (parseError) {
                                event.reply('load-data-reply', null);
                            }
                        }
                    });
                } else {
                    event.reply('load-data-reply', null);
                }
            }).catch((err) => {
                event.reply('load-data-reply', null);
            });
        } catch (error) {
            event.reply('load-data-reply', null);
        }
    });

    // 確認ダイアログ呼び出し
    ipcMain.handle('show-confirm-dialog', async (event, { title, message }) => {
        try {
            const mainWindow = getMainWindow();
            const result = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                buttons: ['はい', 'いいえ'],
                defaultId: 1,
                title: title,
                message: message,
            });
            return (result.response === 0);
        } catch (error) {
            return false;
        }
    });

    // レンダラからのログ開始要求
    ipcMain.on('start-logging', (event) => {
        try {
            const logDir = path.join(__dirname, '../../log');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir);
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            currentLogFilePath = path.join(logDir, `app_${timestamp}.log`);
            fs.writeFileSync(
                currentLogFilePath,
                `Log started at ${new Date().toLocaleString()}\n`,
                { flag: 'w' }
            );
        } catch (error) {
            console.error('start-logging エラー:', error);
        }
    });

    // レンダラからのログ追記要求
    ipcMain.on('log-message', (event, { level, message, error }) => {
        try {
            if (!currentLogFilePath) {
                return;
            }
            let line = `[level=${level}] ${message}`;
            if (error) {
                line += ` - ${error}`;
            }
            line += '\n';
            fs.appendFileSync(currentLogFilePath, line, { encoding: 'utf8' });
        } catch (err) {
            console.error('log-message エラー:', err);
        }
    });
}

module.exports = { registerIPCHandlers };
