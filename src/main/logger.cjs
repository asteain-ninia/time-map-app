// src/main/logger.cjs

const fs = require('fs');
const path = require('path');

/**
 * ログファイルパスを保管する変数。
 * アプリ起動(再読み込み)毎に新しいファイルを作り、以降はそこに追記する。
 */
let logFilePath = '';

/**
 * デバッグレベルを保持。
 * 例: 0=none, 1=error, 2=warn, 3=info, 4=debug
 */
let debugLevel = 4;

/**
 * アプリ起動時に一度だけ呼ばれ、logフォルダを作り、新規ログファイルを作る。
 */
function initLogFile() {
    try {
        const logDir = path.resolve('./log');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);
        }

        const now = new Date();
        // Windowsで使えない文字(:など)をハイフンへ置換
        const dateStamp = now.toISOString().replace(/[:.]/g, '-');
        const fileName = `log-${dateStamp}.log`;

        logFilePath = path.join(logDir, fileName);

        const initMsg = `[INIT] ${new Date().toISOString()} ログファイルを作成: ${logFilePath}\n`;
        fs.writeFileSync(logFilePath, initMsg, { encoding: 'utf-8' });

        console.log(`ログファイルを作成しました: ${logFilePath}`);
    } catch (err) {
        console.error('initLogFile() でエラーが発生:', err);
    }
}

/**
 * メインプロセスで実際にログを書き込む関数。
 * @param {number} level ログレベル(1=エラー, 2=警告, 3=情報, 4=詳細)
 * @param {string} message ログメッセージ
 * @param {any} error エラーオブジェクトまたは追加情報
 */
function internalDetailedLog(level, message, error) {
    if (level > debugLevel) {
        return; // 現在のデバッグレベルより詳細すぎるものは出さない
    }

    const timeString = new Date().toISOString();
    let logStr = '';
    let consoleOutput = '';

    switch (level) {
        case 1: // error
            consoleOutput = `[ERROR] ${message} - ${error || ''}`;
            logStr = `[ERROR] ${timeString} ${message} - ${error || ''}\n`;
            console.error(consoleOutput);
            break;
        case 2: // warn
            consoleOutput = `[WARN] ${message}`;
            logStr = `[WARN] ${timeString} ${message}\n`;
            if (error) {
                logStr += ` --> ${error}\n`;
            }
            console.warn(consoleOutput);
            break;
        case 3: // info
            consoleOutput = `[INFO] ${message}`;
            logStr = `[INFO] ${timeString} ${message}\n`;
            if (error) {
                logStr += ` --> ${error}\n`;
            }
            console.info(consoleOutput);
            break;
        case 4: // debug
        default:
            consoleOutput = `[DEBUG] ${message}`;
            logStr = `[DEBUG] ${timeString} ${message}\n`;
            if (error) {
                logStr += ` --> ${error}\n`;
            }
            console.log(consoleOutput);
            break;
    }

    if (logFilePath) {
        try {
            fs.appendFileSync(logFilePath, logStr, { encoding: 'utf-8' });
        } catch (err) {
            console.error('ログファイル書き込み中にエラー:', err);
        }
    }
}

/**
 * 外部からデバッグレベルを変更できるようにする。
 * 例: setLoggerLevel(2) で警告以上のみ表示
 */
function setLoggerLevel(newLevel) {
    debugLevel = newLevel;
    internalDetailedLog(3, `Logger level changed to ${newLevel}`);
}

/**
 * main.cjs などから呼び出して、IPCハンドラを登録する関数。
 * - アプリ起動時に一度だけ呼び出す想定。
 */
function registerLoggerIPC(ipcMain) {
    initLogFile(); // まずログファイルを初期化

    // レンダラープロセス → 「logger:log」メッセージを受け取ってログを記録
    ipcMain.on('logger:log', (event, payload) => {
        if (!payload) return;
        const { level, message, error } = payload;
        internalDetailedLog(level, message, error);
    });

    // デバッグレベルの更新
    ipcMain.on('logger:setLevel', (event, newLevel) => {
        setLoggerLevel(newLevel);
    });
}

module.exports = {
    registerLoggerIPC,
    setLoggerLevel,
};
