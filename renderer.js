// renderer.js

import DataStore from './dataStore.js';
import uiManager from './src/ui/uiManager.js';
import stateManager from './stateManager.js';

import {
    loadMap,
    renderData,
    getMapWidth,
    getMapHeight,
    disableMapZoom,
    enableMapZoom
} from './src/map/mapRenderer.js';

import { setupEventHandlers } from './src/eventHandlers/index.js';
import { initInteraction } from './src/map/mapInteraction.js';

(() => {
    let renderTimeout;
    const RENDER_DELAY = 50;

    function delayedRenderData() {
        if (renderTimeout) {
            clearTimeout(renderTimeout);
        }
        renderTimeout = setTimeout(() => {
            try {
                renderData();
                uiManager.updateEventList(DataStore);
                uiManager.updateUI();
            } catch (error) {
                console.error('データのレンダリング中にエラーが発生しました:', error);
                uiManager.showNotification('データの表示中にエラーが発生しました。', 'error');
            }
        }, RENDER_DELAY);
    }

    function init() {
        try {
            uiManager.updateUI();
            uiManager.populateSettings();

            loadMap(DataStore, null, delayedRenderData)
                .then(() => {
                    initInteraction({
                        renderData: delayedRenderData,
                        disableMapZoom,
                        enableMapZoom
                    });

                    // ipcを取得
                    const ipc = window.electronAPI;

                    // ★ 分割後のイベントハンドラ設定を呼び出し
                    setupEventHandlers(
                        DataStore,
                        { renderData: delayedRenderData, getMapWidth },
                        ipc,
                        delayedRenderData
                    );
                })
                .catch((error) => {
                    console.error('Map のロード中にエラーが発生しました:', error);
                    uiManager.showNotification('地図の読み込み中にエラーが発生しました。', 'error');
                });
        } catch (error) {
            console.error('アプリケーションの初期化中にエラーが発生しました:', error);
            uiManager.showNotification('アプリケーションの起動中にエラーが発生しました。', 'error');
        }
    }

    window.onload = () => {
        init();
    };
})();
