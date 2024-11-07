// main.cjs

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
    try {
        mainWindow = new BrowserWindow({
            width: 1280,
            height: 800,
            webPreferences: {
                preload: path.join(__dirname, 'preload.cjs'),
                nodeIntegration: false, // セキュリティのために無効化
                contextIsolation: true, // セキュリティのために有効化
            },
        });

        mainWindow.loadFile('index.html');
    } catch (error) {
        console.error('ウィンドウの作成中にエラーが発生しました:', error);
        app.quit();
    }
}

app.whenReady().then(createWindow).catch((error) => {
    console.error('アプリケーションの初期化中にエラーが発生しました:', error);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 他のイベントハンドラーやIPC通信もtry-catchで囲む
ipcMain.on('save-data', (event, data) => {
    try {
        dialog.showSaveDialog(mainWindow, {
            title: 'データを保存',
            defaultPath: 'data.json',
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
        }).then((result) => {
            if (!result.canceled && result.filePath) {
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
        }).catch((err) => {
            console.error('データの保存中にエラーが発生しました:', err);
            event.reply('save-data-reply', false);
        });
    } catch (error) {
        console.error('save-data イベント処理中にエラーが発生しました:', error);
        event.reply('save-data-reply', false);
    }
});

ipcMain.on('load-data', (event) => {
    try {
        dialog.showOpenDialog(mainWindow, {
            title: 'データを開く',
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
        }).then((result) => {
            if (!result.canceled && result.filePaths.length > 0) {
                fs.readFile(result.filePaths[0], 'utf-8', (err, data) => {
                    if (err) {
                        console.error('データの読み込み中にエラーが発生しました:', err);
                        event.reply('load-data-reply', null);
                    } else {
                        try {
                            const jsonData = JSON.parse(data);
                            event.reply('load-data-reply', jsonData);
                        } catch (parseError) {
                            console.error('データの解析中にエラーが発生しました:', parseError);
                            event.reply('load-data-reply', null);
                        }
                    }
                });
            } else {
                event.reply('load-data-reply', null);
            }
        }).catch((err) => {
            console.error('データの読み込み中にエラーが発生しました:', err);
            event.reply('load-data-reply', null);
        });
    } catch (error) {
        console.error('load-data イベント処理中にエラーが発生しました:', error);
        event.reply('load-data-reply', null);
    }
});

ipcMain.handle('show-confirm-dialog', async (event, { title, message }) => {
    try {
        const result = await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            buttons: ['はい', 'いいえ'],
            defaultId: 1,
            title: title,
            message: message,
        });
        return result.response === 0; // 'はい' が押されたら true を返す
    } catch (error) {
        console.error('確認ダイアログの表示中にエラーが発生しました:', error);
        return false;
    }
});
