// src/main/ipcHandlers.cjs

const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const { getMainWindow } = require('./windowManager.cjs');

/**
 * IPC通信ハンドラを登録する関数。
 * main.cjs 側から呼び出してセットアップしておく。
 */
function registerIPCHandlers() {
    console.log('registerIPCHandlers() が呼び出されました。');

    // データ保存
    ipcMain.on('save-data', (event, data) => {
        console.log("ipcMain.on('save-data') が呼び出されました。");
        try {
            const mainWindow = getMainWindow();
            dialog.showSaveDialog(mainWindow, {
                title: 'データを保存',
                defaultPath: 'data.json',
                filters: [{ name: 'JSON Files', extensions: ['json'] }],
            }).then((result) => {
                if (!result.canceled && result.filePath) {
                    console.log(`ファイル保存先: ${result.filePath}`);
                    fs.writeFile(result.filePath, JSON.stringify(data, null, 2), (err) => {
                        if (err) {
                            console.error('データの保存中にエラー:', err);
                            event.reply('save-data-reply', false);
                        } else {
                            console.log(`データ保存成功: ${result.filePath}`);
                            event.reply('save-data-reply', true);
                        }
                    });
                } else {
                    console.log('ユーザーが保存ダイアログをキャンセル。save-data-reply を false で返す。');
                    event.reply('save-data-reply', false);
                }
            }).catch((err) => {
                console.error('データの保存中にエラー:', err);
                event.reply('save-data-reply', false);
            });
        } catch (error) {
            console.error('save-data イベント処理中にエラー:', error);
            event.reply('save-data-reply', false);
        }
    });

    // データ読み込み
    ipcMain.on('load-data', (event) => {
        console.log("ipcMain.on('load-data') が呼び出されました。");
        try {
            const mainWindow = getMainWindow();
            dialog.showOpenDialog(mainWindow, {
                title: 'データを開く',
                filters: [{ name: 'JSON Files', extensions: ['json'] }],
            }).then((result) => {
                if (!result.canceled && result.filePaths.length > 0) {
                    console.log(`ファイル読込先: ${result.filePaths[0]}`);
                    fs.readFile(result.filePaths[0], 'utf-8', (err, fileData) => {
                        if (err) {
                            console.error('データの読み込み中にエラー:', err);
                            event.reply('load-data-reply', null);
                        } else {
                            try {
                                const jsonData = JSON.parse(fileData);
                                event.reply('load-data-reply', jsonData);
                            } catch (parseError) {
                                console.error('データの解析中にエラー:', parseError);
                                event.reply('load-data-reply', null);
                            }
                        }
                    });
                } else {
                    event.reply('load-data-reply', null);
                }
            }).catch((err) => {
                console.error('データの読み込み中にエラー:', err);
                event.reply('load-data-reply', null);
            });
        } catch (error) {
            console.error('load-data イベント処理中にエラー:', error);
            event.reply('load-data-reply', null);
        }
    });

    // 確認ダイアログ呼び出し
    ipcMain.handle('show-confirm-dialog', async (event, { title, message }) => {
        console.log(`ipcMain.handle('show-confirm-dialog') が呼び出されました。title=${title}`);
        try {
            const mainWindow = getMainWindow();
            const result = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                buttons: ['はい', 'いいえ'],
                defaultId: 1,
                title: title,
                message: message,
            });
            console.log(`show-confirm-dialog の結果: response=${result.response}`);
            return (result.response === 0); // 'はい' ならtrue
        } catch (error) {
            console.error('確認ダイアログの表示中にエラー:', error);
            return false;
        }
    });
}

module.exports = { registerIPCHandlers };
