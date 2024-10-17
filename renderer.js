// renderer.js

const path = require('path');
const { ipcRenderer } = require('electron');
const DataStore = require('./dataStore');
const MapModule = require('./map');
const UI = require('./ui');
const EventHandlers = require('./eventHandlers');

(() => {
    const State = {
        isEditMode: false,
        currentTool: 'select',
        isDrawing: false,
        tempLinePoints: [],
        tempPolygonPoints: [],
    };

    function renderData() {
        MapModule.renderData();
    }

    function init() {
        UI.updateUI(State);
        EventHandlers.setupEventListeners(State, DataStore, MapModule, UI, ipcRenderer, renderData);
        MapModule.loadMap(State, DataStore, UI, renderData);
    }

    init();

    ipcRenderer.on('load-data-reply', (event, data) => {
        if (data) {
            // 既存のデータをクリア
            DataStore.getPoints().length = 0;
            DataStore.getLines().length = 0;
            DataStore.getPolygons().length = 0;

            // 新しいデータを追加
            DataStore.getPoints().push(...(data.points || []));
            DataStore.getLines().push(...(data.lines || []));
            DataStore.getPolygons().push(...(data.polygons || []));
            renderData();
        } else {
            UI.showNotification('データの読み込み中にエラーが発生しました。', 'error');
        }
    });
})();
