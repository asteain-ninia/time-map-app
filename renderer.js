// renderer.js

const { on } = window.electronAPI;

import DataStore from './dataStore.js';
import MapModule from './map.js';
import UI from './ui.js';
import EventHandlers from './eventHandlers.js';
import stateManager from './stateManager.js';

(() => {
    function renderData() {
        MapModule.renderData();
        UI.updateEventList(DataStore);
        UI.updateUI();
    }

    function init() {
        UI.updateUI();
        MapModule.loadMap(DataStore, UI, renderData)
            .then(() => {
                // Map のロードが完了した後にイベントリスナーを設定
                const ipc = window.electronAPI;
                EventHandlers.setupEventListeners(DataStore, MapModule, UI, ipc, renderData);
            })
            .catch((error) => {
                console.error('Map のロード中にエラーが発生しました:', error);
            });
    }

    window.onload = () => {
        init();
    };

})();
