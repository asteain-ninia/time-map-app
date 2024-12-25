// src/main/windowManager.cjs

const { BrowserWindow } = require('electron');
const path = require('path');

/**
 * メインウィンドウの参照を外部から取得できるように保持する変数
 */
let mainWindow = null;

/**
 * メインウィンドウを作成し、index.html をロードする関数
 */
function createMainWindow() {
    try {
        mainWindow = new BrowserWindow({
            width: 1280,
            height: 800,
            webPreferences: {
                preload: path.join(__dirname, '../../preload.cjs'),
                nodeIntegration: false,
                contextIsolation: true,
            },
        });

        mainWindow.loadFile('index.html');
    } catch (error) {
        console.error('ウィンドウの作成中にエラーが発生しました:', error);
        // エラー発生時にはアプリを終了するなどの処理を検討
    }
}

/**
 * 現在のメインウィンドウを返す
 */
function getMainWindow() {
    return mainWindow;
}

module.exports = {
    createMainWindow,
    getMainWindow,
};
