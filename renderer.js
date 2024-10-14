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
})();
