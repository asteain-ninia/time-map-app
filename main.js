// main.js

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);

ipcMain.on('save-data', (event, data) => {
    dialog.showSaveDialog({
        title: 'データを保存',
        defaultPath: 'data.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
    }).then((result) => {
        if (!result.canceled) {
            fs.writeFile(result.filePath, JSON.stringify(data, null, 2), (err) => {
                if (err) {
                    console.error('データの保存中にエラーが発生しました:', err);
                    event.reply('save-data-reply', false);
                } else {
                    event.reply('save-data-reply', true);
                }
            });
        } else {
            event.reply('save-data-reply', false);
        }
    });
});

ipcMain.on('load-data', (event) => {
    dialog.showOpenDialog({
        title: 'データを開く',
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
    }).then((result) => {
        if (!result.canceled && result.filePaths.length > 0) {
            fs.readFile(result.filePaths[0], 'utf-8', (err, data) => {
                if (err) {
                    console.error('データの読み込み中にエラーが発生しました:', err);
                    event.reply('load-data-reply', null);
                } else {
                    event.reply('load-data-reply', JSON.parse(data));
                }
            });
        } else {
            event.reply('load-data-reply', null);
        }
    });
});