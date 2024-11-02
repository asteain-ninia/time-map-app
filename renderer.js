// renderer.js

import DataStore from './dataStore.js';
import MapModule from './map.js';
import UI from './ui.js';
import EventHandlers from './eventHandlers.js';
import stateManager from './stateManager.js';

(() => {
    function renderData() {
        try {
            MapModule.renderData();
            UI.updateEventList(DataStore);
            UI.updateUI();
        } catch (error) {
            console.error('データのレンダリング中にエラーが発生しました:', error);
            UI.showNotification('データの表示中にエラーが発生しました。', 'error');
        }
    }

    function init() {
        try {
            UI.updateUI();
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
