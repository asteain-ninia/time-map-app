// main.cjs

const { app, BrowserWindow, ipcMain } = require('electron');
const { createMainWindow } = require('./src/main/windowManager.cjs');
const { registerIPCHandlers } = require('./src/main/ipcHandlers.cjs');
const { registerLoggerIPC } = require('./src/main/logger.cjs');

function onReady() {
    // ウィンドウ作成
    createMainWindow();

    // IPCハンドラを登録
    registerIPCHandlers();

    // ロガーIPCハンドラを登録
    registerLoggerIPC(ipcMain);
}

// アプリが準備完了したらメインウィンドウ作成などを行う
app.whenReady().then(onReady).catch((error) => {
    console.error('アプリ初期化中にエラーが発生しました:', error);
    app.quit();
});

// 全ウィンドウが閉じられたらアプリを終了
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// （macOS向け）Dockアイコンから再起動された時の再生成処理
app.on('activate', () => {
    // ウィンドウがない場合は再作成
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});
