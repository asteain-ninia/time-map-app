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
    debugLog(4, 'renderer.js の即時実行関数が呼び出されました。');
    try {
        let renderTimeout;
        const RENDER_DELAY = 50;

        function delayedRenderData() {
            debugLog(4, 'delayedRenderData() が呼び出されました。');
            try {
                if (renderTimeout) {
                    clearTimeout(renderTimeout);
                }
                renderTimeout = setTimeout(() => {
                    try {
                        renderData();
                        uiManager.updateEventList(DataStore);
                        uiManager.updateUI();
                    } catch (error) {
                        debugLog(1, `delayedRenderData() 内でエラー発生: ${error}`);
                        uiManager.showNotification('データの表示中にエラーが発生しました。', 'error');
                    }
                }, RENDER_DELAY);
            } catch (error) {
                debugLog(1, `delayedRenderData() でエラー発生: ${error}`);
            }
        }

        function init() {
            debugLog(4, 'init() が呼び出されました。');
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

                        const ipc = window.electronAPI;
                        setupEventHandlers(
                            DataStore,
                            { renderData: delayedRenderData, getMapWidth },
                            ipc,
                            delayedRenderData
                        );
                    })
                    .catch((error) => {
                        debugLog(1, `Map のロード中にエラー: ${error}`);
                        uiManager.showNotification('地図の読み込み中にエラーが発生しました。', 'error');
                    });
            } catch (error) {
                debugLog(1, `init() でエラー発生: ${error}`);
                uiManager.showNotification('アプリケーションの起動中にエラーが発生しました。', 'error');
            }
        }

        window.onload = () => {
            debugLog(4, 'window.onload イベントが発生しました。init() を呼び出します。');
            try {
                init();
            } catch (error) {
                debugLog(1, `window.onload 内でエラー発生: ${error}`);
            }
        };

    } catch (error) {
        debugLog(1, `renderer.js 即時実行関数 全体でエラー発生: ${error}`);
    }
})();
