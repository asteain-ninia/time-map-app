// src/eventHandlers/index.js

import { setupUIEventListeners } from './uiEventHandlers.js';
import { setupIPCEventListeners } from './ipcEventHandlers.js';

/**
 * eventHandlers の一括設定メソッド
 * 
 * @param {Object} DataStore - データストア
 * @param {Object} MapModuleInstance - 地図モジュール (renderData など)
 * @param {Object} ipc - window.electronAPI
 * @param {Function} renderData - 再描画関数
 */
export function setupEventHandlers(DataStore, MapModuleInstance, ipc, renderData) {
    // UIイベント（DOM操作系）
    setupUIEventListeners(DataStore, MapModuleInstance, renderData);

    // IPC関連イベント
    setupIPCEventListeners(ipc, renderData);
}
