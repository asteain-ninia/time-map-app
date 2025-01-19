// src/utils/logger.js

import stateManager from '../state/index.js';
import uiManager from '../ui/uiManager.js';

/**
 * レンダラ専用のログ関数。
 * 1=エラー,2=警告,3=情報,4=詳細
 * ログレベルが足りない場合は何も出力しない。
 */
export function debugLog(level, message, error) {
    switch (level) {
        case 1:
            console.error(`level=${level}, ${message}`);
            break;
        case 2:
            console.warn(`level=${level}, ${message}`);
            break;
        case 3:
            console.info(`level=${level}, ${message}`);
            break;
        case 4:
            console.log(`level=${level}, ${message}`);
            break;
    }
    const st = stateManager.getState();
    if (st.debugLevel === undefined || st.debugLevel === null) {
        return;
    }
    if (st.debugLevel < level) {
        return;
    }

    try {
        // メインプロセスへ送信してファイルに記録
        window.electronAPI.send('log-message', {
            level: level,
            message: message,
            error: error ? error.toString() : undefined
        });
    } catch (ipcError) {
        console.warn('debugLog の IPC送信中にエラー:', ipcError);
    }
}

/**
 * デバッグレベルを変更
 */
export function setDebugLevel(newLevel) {
    console.log(`setDebugLevel() in renderer: newLevel=${newLevel}`);
    try {
        if (typeof newLevel !== 'number' || newLevel < 0) {
            uiManager.showNotification('デバッグレベルは0以上の数値で指定してください。', 'error');
            return;
        }
        stateManager.setState({ debugLevel: newLevel });
        uiManager.showNotification(`デバッグレベルが ${newLevel} に設定されました。`, 'info');
    } catch (error) {
        debugLog(1, 'setDebugLevel() でエラー発生', error);
        uiManager.showNotification('デバッグレベルの設定中にエラーが発生しました。', 'error');
    }
}
