// src/ui/uiManager.js

import stateManager from '../state/index.js';
import { showNotification, showDetailWindow } from './forms.js';
import { debugLog } from '../utils/logger.js';

/**
 * UI全体を管理するメインモジュール
 * - トップレベルのUI更新処理や、イベント一覧、スライダー、世界情報の表示などをまとめる
 */

/**
 * UI全体を更新する
 */
function updateUI() {
    debugLog(4, 'updateUI() が呼び出されました。');
    try {
        const state = stateManager.getState();

        document.getElementById('addModeButton').textContent =
            `追加モード: ${state.isAddMode ? 'ON' : 'OFF'}`;

        document.getElementById('editModeButton').textContent =
            `編集モード: ${state.isEditMode ? 'ON' : 'OFF'}`;

        document.getElementById('addModeButton').classList.toggle('active', state.isAddMode);
        document.getElementById('editModeButton').classList.toggle('active', state.isEditMode);

        document.getElementById('tools').style.display = (state.isAddMode || state.isEditMode) ? 'block' : 'none';

        const toolButtons = document.querySelectorAll('#tools button');
        toolButtons.forEach(button => {
            const toolName = button.id.replace('Tool', '');
            button.classList.toggle('active', toolName === state.currentTool);

            if (state.isAddMode) {
                if (['point', 'line', 'polygon'].includes(toolName)) {
                    button.style.display = 'inline-block';
                } else {
                    button.style.display = 'none';
                }
            } else if (state.isEditMode) {
                if ([
                    'pointMove',
                    'pointAttributeEdit',
                    'lineAttributeEdit',
                    'lineVertexEdit',
                    'polygonAttributeEdit',
                    'polygonVertexEdit',
                ].includes(toolName)) {
                    button.style.display = 'inline-block';
                } else {
                    button.style.display = 'none';
                }
            } else {
                button.style.display = 'none';
            }
        });

        let showConfirmButton = false;
        if (state.isAddMode && state.isDrawing) {
            if (state.currentTool === 'line' && state.tempLinePoints.length >= 2) {
                showConfirmButton = true;
            } else if (state.currentTool === 'polygon' && state.tempPolygonPoints.length >= 3) {
                showConfirmButton = true;
            }
        }

        document.getElementById('drawControls').style.display = showConfirmButton ? 'block' : 'none';

        if (!state.isAddMode && !state.isEditMode) {
            hideAllForms();
        }

        updateSlider();
        updateWorldInfo();
    } catch (error) {
        debugLog(1, `updateUI() でエラー発生: ${error}`);
        showNotification('UIの更新中にエラーが発生しました。', 'error');
    }
}

/**
 * 全フォームを非表示にする
 */
function hideAllForms() {
    debugLog(4, 'hideAllForms() が呼び出されました。');
    try {
        document.getElementById('editForm').style.display = 'none';
        document.getElementById('lineEditForm').style.display = 'none';
        document.getElementById('polygonEditForm').style.display = 'none';
        document.getElementById('detailWindow').style.display = 'none';
    } catch (error) {
        debugLog(1, `hideAllForms() でエラー発生: ${error}`);
    }
}

/**
 * イベント一覧（左サイドバー）の更新
 * @param {Object} DataStore - データストア
 */
function updateEventList(DataStore) {
    debugLog(4, 'updateEventList() が呼び出されました。');
    try {
        const eventList = document.getElementById('eventList');
        eventList.innerHTML = '';

        const state = stateManager.getState();
        const currentYear = state.currentYear || 0;

        const points = DataStore.getPoints(currentYear);
        const lines = DataStore.getLines(currentYear);
        const polygons = DataStore.getPolygons(currentYear);

        const events = [];

        points.forEach(point => {
            events.push({ type: '点情報', data: point });
        });
        lines.forEach(line => {
            events.push({ type: '線情報', data: line });
        });
        polygons.forEach(polygon => {
            events.push({ type: '面情報', data: polygon });
        });

        events.sort((a, b) => a.data.year - b.data.year);

        events.forEach(event => {
            const li = document.createElement('li');
            li.textContent = `${event.data.year}: ${event.data.name} (${event.type})`;
            li.addEventListener('click', () => {
                showDetailWindow(event.data);
            });
            eventList.appendChild(li);
        });
    } catch (error) {
        debugLog(1, `updateEventList() でエラー発生: ${error}`);
    }
}

/**
 * スライダーと現在年の表示を更新
 */
function updateSlider() {
    debugLog(4, 'updateSlider() が呼び出されました。');
    try {
        const state = stateManager.getState();
        const timeSlider = document.getElementById('timeSlider');

        timeSlider.min = state.sliderMin;
        timeSlider.max = state.sliderMax;
        timeSlider.value = state.currentYear;

        document.getElementById('currentYear').textContent = `年: ${state.currentYear}`;
    } catch (error) {
        debugLog(1, `updateSlider() でエラー発生: ${error}`);
    }
}

/**
 * 世界情報（世界名、概要）を更新
 */
function updateWorldInfo() {
    debugLog(4, 'updateWorldInfo() が呼び出されました。');
    try {
        const state = stateManager.getState();

        document.getElementById('worldNameDisplay').textContent = state.worldName || '無名の世界';
        document.getElementById('worldDescriptionDisplay').textContent = state.worldDescription || '説明がありません。';
    } catch (error) {
        debugLog(1, `updateWorldInfo() でエラー発生: ${error}`);
    }
}

/**
 * 設定ダイアログ入力欄などを既存のstateで初期化する
 */
function populateSettings() {
    debugLog(4, 'populateSettings() が呼び出されました。');
    try {
        const state = stateManager.getState();

        document.getElementById('sliderMin').value = state.sliderMin;
        document.getElementById('sliderMax').value = state.sliderMax;
        document.getElementById('worldName').value = state.worldName;
        document.getElementById('worldDescription').value = state.worldDescription;
    } catch (error) {
        debugLog(1, `populateSettings() でエラー発生: ${error}`);
    }
}

export default {
    updateUI,
    hideAllForms,
    updateEventList,
    updateSlider,
    updateWorldInfo,
    populateSettings,
    showNotification,
};
