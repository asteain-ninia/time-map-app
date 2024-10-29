// renderer.js

const { on } = window.electronAPI;

import DataStore from './dataStore.js';
import MapModule from './map.js';
import UI from './ui.js';
import EventHandlers from './eventHandlers.js';

(() => {
    const State = {
        isEditMode: false,
        currentTool: 'select',
        isDrawing: false,
        tempLinePoints: [],
        tempPolygonPoints: [],
        currentYear: 0,
    };

    function renderData() {
        MapModule.renderData();
        UI.updateEventList(DataStore, State);
    }

    function init() {
        UI.updateUI(State);
        MapModule.loadMap(State, DataStore, UI, renderData)
            .then(() => {
                // Map のロードが完了した後にイベントリスナーを設定
                const ipc = window.electronAPI;
                EventHandlers.setupEventListeners(State, DataStore, MapModule, UI, ipc, renderData);
            })
            .catch((error) => {
                console.error('Map のロード中にエラーが発生しました:', error);
            });
    }

    // window.onload  イベント内で init 関数を呼び出す
    window.onload = () => {
        init();
    };

})();
