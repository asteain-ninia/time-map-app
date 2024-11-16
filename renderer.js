// renderer.js

import DataStore from './dataStore.js';
import MapModule from './map.js';
import UI from './ui.js';
import EventHandlers from './eventHandlers.js';
import stateManager from './stateManager.js';

(() => {
    let renderTimeout;
    const RENDER_DELAY = 50; // デバウンス時間をミリ秒で設定

    function renderData() {
        if (renderTimeout) {
            clearTimeout(renderTimeout);
        }
        renderTimeout = setTimeout(() => {
            try {
                MapModule.renderData();
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
            UI.populateSettings(); // 設定ウィンドウのフィールドを初期化

            MapModule.loadMap(DataStore, UI, renderData)
                .then(() => {
                    const ipc = window.electronAPI;
                    EventHandlers.setupEventListeners(DataStore, MapModule, UI, ipc, renderData);
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
