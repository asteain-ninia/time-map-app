// src/utils/logger.js

import stateManager from '../state/index.js';
import uiManager from '../ui/uiManager.js';

/**
* このファイルはデバッグログの出力レベルや、ログ出力に統一的なインターフェースを提供します。
* - レベル0: ログ出力なし
* - レベル1: エラーのみ
* - レベル2: 警告＋エラー
* - レベル3: 情報＋警告＋エラー
* - レベル4: 詳細（すべてのログ）
*/

/**
 * 内部で実際にコンソールへの出力を行うユーティリティ関数。
 * ここではスタックトレース付きで出すなど、細かい実装を集中管理する想定。
 * @param {number} level 
 * @param {string} message 
 * @param {Error} [error]
 */
function internalDetailedLog(level, message, error) {
    const st = stateManager.getState();
    if (st.debugLevel === undefined || st.debugLevel === null) {
        return;
    }

    // debugLevel が指定された level 以上であれば出力
    // 1=エラー,2=警告,3=情報,4=詳細
    if (st.debugLevel >= level) {
        if (level == 1) {
            console.error(`[level=${level}] ${message} - ${error}`);
        } else {
            console.log(`[level=${level}] ${message}`);
        }
    }
}

/**
 * debugLog関数本体。
 * - 関数冒頭で呼び出しログを出してから try-catch で内部を呼び出す。
 * @param {number} level 
 * @param {string} message 
 * @param {Error} [error]
 */
export function debugLog(level, message, error) {
    //console.log(` debugLog() が呼び出されました。level=${level}, message=${message}`);
    //debugLog自体の呼び出しログを実装すると、ログの量が二倍になってしまうので、無効化
    try {
        internalDetailedLog(level, message, error);
    } catch (err) {
        // ここでの例外は logger 自体の不具合
        // フォールバックとして、最低限の情報をコンソールに出す
        console.error('debugLog 内部で例外が発生:', err);
        uiManager.showNotification(`ロガー内部でエラーが発生しました: ${err}`, 'error');
    }
}

/**
 * デバッグレベルを変更します。
 * 0=出力なし, 1=エラーのみ, 2=警告＋エラー, 3=情報＋警告＋エラー, 4=詳細ログすべて
 * @param {number} newLevel - 新しいデバッグレベル
 */
export function setDebugLevel(newLevel) {
    console.log(`setDebugLevel() が呼び出されました。newLevel=${newLevel}`);
    try {
        if (typeof newLevel !== 'number' || newLevel < 0) {
            uiManager.showNotification('デバッグレベルは0以上の数値で指定してください。', 'error');
            return;
        }
        stateManager.setState({ debugLevel: newLevel });
        uiManager.showNotification(`デバッグレベルが ${newLevel} に設定されました。`, 'info');
    } catch (error) {
        debugLog(1, `setDebugLevel() でエラー発生: ${error}`);
        uiManager.showNotification('デバッグレベルの設定中にエラーが発生しました。', 'error');
    }
}
