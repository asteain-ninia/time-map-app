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
                EventHandlers.setupEventListeners(State, DataStore, MapModule, UI, ipcRenderer, renderData);
            })
            .catch((error) => {
                console.error('Map のロード中にエラーが発生しました:', error);
            });
    }

    // window.onload  イベント内で init 関数を呼び出す
    window.onload = () => {
        init();
    };

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
