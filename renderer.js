// renderer.js

import DataStore from './dataStore.js';
import UI from './ui.js';
import EventHandlers from './eventHandlers.js';
import stateManager from './stateManager.js';

import {
    loadMap,
    renderData,
    getMapWidth,
    getMapHeight,
    disableMapZoom,
    enableMapZoom
} from './src/map/mapRenderer.js';
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
                UI.updateEventList(DataStore);
                UI.updateUI();
            } catch (error) {
                console.error('データのレンダリング中にエラーが発生しました:', error);
                UI.showNotification('データの表示中にエラーが発生しました。', 'error');
            }
        }, RENDER_DELAY);
    }

    function init() {
        try {
            UI.updateUI();
            UI.populateSettings();

            loadMap(DataStore, UI, delayedRenderData)
                .then(() => {
                    initInteraction({
                        renderData: delayedRenderData,
                        disableMapZoom,
                        enableMapZoom
                    });

                    const ipc = window.electronAPI;
                    EventHandlers.setupEventListeners(
                        DataStore,
                        { renderData: delayedRenderData, getMapWidth },
                        UI,
                        ipc,
                        delayedRenderData
                    );
                })
                .catch((error) => {
                    console.error('Map のロード中にエラーが発生しました:', error);
                    UI.showNotification('地図の読み込み中にエラーが発生しました。', 'error');
                });
        } catch (error) {
            console.error('アプリケーションの初期化中にエラーが発生しました:', error);
            UI.showNotification('アプリケーションの起動中にエラーが発生しました。', 'error');
        }
    }

    window.onload = () => {
        init();
    };
})();
