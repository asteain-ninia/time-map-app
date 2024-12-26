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
 * 指定のレベルに対してログを出力するかどうかを判定し、必要なら console.log を行います。
 * @param {number} level - ログレベル(1=エラー,2=警告,3=情報,4=詳細)
 * @param {string} message - ログに出すメッセージ
 * @param {Error} [error] - エラーオブジェクト(必要な場合)
 */
export function debugLog(level, message, error) {
    const st = stateManager.getState();
    if (st.debugLevel === undefined || st.debugLevel === null) {
        return;
    }

    // st.debugLevel が出力対象レベル以上であればログを表示
    if (st.debugLevel >= level) {
        if (error) {
            console.error(`${message} - ${error}`);
        } else {
            console.log(message);
        }
    }
}

/**
 * デバッグレベルを変更します。
 * 0=出力なし, 1=エラーのみ, 2=警告＋エラー, 3=情報＋警告＋エラー, 4=詳細ログすべて
 * @param {number} newLevel - 新しいデバッグレベル
 */
export function setDebugLevel(newLevel) {
    try {
        if (typeof newLevel !== 'number' || newLevel < 0) {
            uiManager.showNotification('デバッグレベルは0以上の数値で指定してください。', 'error');
            return;
        }
        stateManager.setState({ debugLevel: newLevel });
        uiManager.showNotification(`デバッグレベルが ${newLevel} に設定されました。`, 'info');
    } catch (error) {
        uiManager.showNotification('デバッグレベルの設定中にエラーが発生しました。', 'error');
        console.error('setDebugLevel エラー:', error);
    }
}
