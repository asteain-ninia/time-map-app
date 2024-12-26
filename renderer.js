// renderer.js

import DataStore from './src/dataStore/index.js';
import uiManager from './src/ui/uiManager.js';
import {
    loadMap,
    renderData,
    getMapWidth,
    disableMapZoom,
    enableMapZoom
} from './src/map/mapRenderer.js';
import { setupEventHandlers } from './src/eventHandlers/index.js';
import { initInteraction } from './src/map/mapInteraction.js';
import { debugLog } from './src/utils/logger.js';

(() => {
    let renderTimeout;
    const RENDER_DELAY = 50;

    function delayedRenderData() {
        if (renderTimeout) {
            clearTimeout(renderTimeout);
        }
        renderTimeout = setTimeout(() => {
            try {
                debugLog(4, 'delayedRenderData で再描画を実行します。');
                renderData();
                uiManager.updateEventList(DataStore);
                uiManager.updateUI();
            } catch (error) {
                console.error('データのレンダリング中にエラー:', error);
                uiManager.showNotification('データの表示中にエラーが発生しました。', 'error');
            }
        }, RENDER_DELAY);
    }

    function init() {
        try {
            debugLog(2, 'アプリケーションを初期化します。');
            uiManager.updateUI();
            uiManager.populateSettings();

            loadMap(DataStore, null, delayedRenderData)
                .then(() => {
                    initInteraction({
                        renderData: delayedRenderData,
                        disableMapZoom,
                        enableMapZoom
                    });

                    const ipc = window.electronAPI;
                    setupEventHandlers(
                        DataStore,
                        { renderData: delayedRenderData, getMapWidth },
                        ipc,
                        delayedRenderData
                    );
                })
                .catch((error) => {
                    console.error('Map のロード中にエラー:', error);
                    uiManager.showNotification('地図の読み込み中にエラーが発生しました。', 'error');
                });
        } catch (error) {
            console.error('アプリケーションの初期化中にエラー:', error);
            uiManager.showNotification('アプリケーションの起動中にエラーが発生しました。', 'error');
        }
    }

    window.onload = () => {
        init();
    };
})();
