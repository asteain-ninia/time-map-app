// src/ui/uiManager.js

import stateManager from '../../stateManager.js';
import { showNotification } from './forms.js'; // どこからでもshowNotificationを使えるように
import { showDetailWindow } from './forms.js';

/**
 * UI全体を管理するメインモジュール
 * - トップレベルのUI更新処理や、イベント一覧、スライダー、世界情報の表示などをまとめる
 */

/**
 * UI全体を更新する
 */
function updateUI() {
    try {
        const state = stateManager.getState();

        if (state.debugMode) {
            console.info('updateUI() が呼び出されました。');
        }

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
        console.error('updateUI 関数内でエラーが発生しました:', error);
        showNotification('UIの更新中にエラーが発生しました。', 'error');
    }
}

/**
 * 全フォームを非表示にする
 */
function hideAllForms() {
    try {
        if (stateManager.getState().debugMode) {
            console.info('hideAllForms() が呼び出されました。');
        }

        document.getElementById('editForm').style.display = 'none';
        document.getElementById('lineEditForm').style.display = 'none';
        document.getElementById('polygonEditForm').style.display = 'none';
        document.getElementById('detailWindow').style.display = 'none';
    } catch (error) {
        console.error('hideAllForms 関数内でエラーが発生しました:', error);
    }
}

/**
 * イベント一覧（左サイドバー）の更新
 * @param {Object} DataStore - データストア
 */
function updateEventList(DataStore) {
    try {
        if (stateManager.getState().debugMode) {
            console.info('updateEventList() が呼び出されました。');
        }

        const eventList = document.getElementById('eventList');
        eventList.innerHTML = '';

        const state = stateManager.getState();
        const currentYear = state.currentYear || 0;

        const points = DataStore.getPoints(currentYear);
        const lines = DataStore.getLines(currentYear);
        const polygons = DataStore.getPolygons(currentYear);

        const events = [];

        points.forEach(point => {
            events.push({ type: 'ポイント', data: point });
        });

        lines.forEach(line => {
            events.push({ type: 'ライン', data: line });
        });

        polygons.forEach(polygon => {
            events.push({ type: 'ポリゴン', data: polygon });
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
        console.error('updateEventList 関数内でエラーが発生しました:', error);
    }
}

/**
 * スライダーと現在年の表示を更新
 */
function updateSlider() {
    try {
        const state = stateManager.getState();
        const timeSlider = document.getElementById('timeSlider');

        timeSlider.min = state.sliderMin;
        timeSlider.max = state.sliderMax;
        timeSlider.value = state.currentYear;

        document.getElementById('currentYear').textContent = `年: ${state.currentYear}`;
    } catch (error) {
        console.error('updateSlider 関数内でエラーが発生しました:', error);
    }
}

/**
 * 世界情報（世界名、概要）を更新
 */
function updateWorldInfo() {
    try {
        const state = stateManager.getState();

        document.getElementById('worldNameDisplay').textContent = state.worldName || '無名の世界';
        document.getElementById('worldDescriptionDisplay').textContent = state.worldDescription || '説明がありません。';
    } catch (error) {
        console.error('updateWorldInfo 関数内でエラーが発生しました:', error);
    }
}

/**
 * 設定ダイアログ入力欄などを既存のstateで初期化する
 */
function populateSettings() {
    try {
        const state = stateManager.getState();

        document.getElementById('sliderMin').value = state.sliderMin;
        document.getElementById('sliderMax').value = state.sliderMax;
        document.getElementById('worldName').value = state.worldName;
        document.getElementById('worldDescription').value = state.worldDescription;
    } catch (error) {
        console.error('populateSettings 関数内でエラーが発生しました:', error);
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
}
