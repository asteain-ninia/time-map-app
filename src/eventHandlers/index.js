// src/eventHandlers/index.js

import { setupUIEventListeners } from './uiEventHandlers.js';
import { setupIPCEventListeners } from './ipcEventHandlers.js';
import { debugLog } from '../utils/logger.js';

/**
 * eventHandlers の一括設定メソッド
 * 
 * @param {Object} DataStore - データストア
 * @param {Object} MapModuleInstance - 地図モジュール (renderData など)
 * @param {Object} ipc - window.electronAPI
 * @param {Function} renderData - 再描画関数
 */
export function setupEventHandlers(DataStore, MapModuleInstance, ipc, renderData) {
    debugLog(4, 'setupEventHandlers() が呼び出されました。');
    try {
        // UIイベント（DOM操作系）
        setupUIEventListeners(DataStore, MapModuleInstance, renderData);

        // IPC関連イベント
        setupIPCEventListeners(ipc, renderData);

    } catch (error) {
        debugLog(1, `setupEventHandlers() でエラーが発生しました: ${error}`);
        console.error('setupEventHandlers エラー:', error);
    }
}
