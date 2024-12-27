// src/eventHandlers/uiEventHandlers.js

import stateManager from '../state/index.js';
import uiManager from '../ui/uiManager.js';
import { showEditForm, showLineEditForm, showPolygonEditForm } from '../ui/forms.js';
import { removeSelectedVertices } from '../map/mapInteraction.js';
import { getMapWidth } from '../map/mapRenderer.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';

/**
 * UIイベント系のリスナーを設定する
 * (IPCを含まない、純粋にUIやDOM操作に関連するイベント)
 * @param {Object} DataStore - データストア
 * @param {Object} MapModuleInstance - 地図モジュール
 * @param {Function} renderData - 再描画関数
 */
export function setupUIEventListeners(DataStore, MapModuleInstance, renderData) {
    debugLog(4, 'setupUIEventListeners() が呼び出されました。');
    try {
        let state = stateManager.getState();
        stateManager.subscribe((newState) => {
            state = newState;
        });

        debugLog(3, 'UIイベントリスナーをセットアップします。');

        document.getElementById('addModeButton').addEventListener('click', () => {
            debugLog(4, 'addModeButton クリックイベントが発生しました。');
            try {
                confirmObjectValidityBeforeModeChange(() => {
                    const isAddMode = !state.isAddMode;
                    stateManager.setState({
                        isAddMode,
                        isEditMode: false,
                        currentTool: 'select',
                        isDrawing: false,
                        tempPoint: null,
                        tempLinePoints: [],
                        tempPolygonPoints: [],
                        selectedFeature: null,
                        isDragging: false,
                        selectedVertices: []
                    });
                    uiManager.updateUI();
                    renderData();
                });
            } catch (error) {
                debugLog(1, `addModeButton のクリックイベントでエラー: ${error}`);
                showNotification('追加モード切り替え中にエラーが発生しました。', 'error');
            }
        });

        document.getElementById('editModeButton').addEventListener('click', () => {
            debugLog(4, 'editModeButton クリックイベントが発生しました。');
            try {
                confirmObjectValidityBeforeModeChange(() => {
                    const isEditMode = !state.isEditMode;
                    stateManager.setState({
                        isEditMode,
                        isAddMode: false,
                        currentTool: 'select',
                        isDrawing: false,
                        tempPoint: null,
                        tempLinePoints: [],
                        tempPolygonPoints: [],
                        selectedFeature: null,
                        isDragging: false,
                        selectedVertices: []
                    });
                    uiManager.updateUI();
                    renderData();
                });
            } catch (error) {
                debugLog(1, `editModeButton のクリックイベントでエラー: ${error}`);
                showNotification('編集モード切り替え中にエラーが発生しました。', 'error');
            }
        });

        [
            'selectTool',
            'pointTool',
            'lineTool',
            'polygonTool',
            'pointMoveTool',
            'pointAttributeEditTool',
            'lineAttributeEditTool',
            'lineVertexEditTool',
            'polygonAttributeEditTool',
            'polygonVertexEditTool',
        ].forEach(toolId => {
            document.getElementById(toolId).addEventListener('click', () => {
                debugLog(4, `${toolId} クリックイベントが発生しました。`);
                try {
                    confirmObjectValidityBeforeModeChange(() => {
                        const toolName = toolId.replace('Tool', '');
                        stateManager.setState({
                            currentTool: toolName,
                            isDrawing: false,
                            tempPoint: null,
                            tempLinePoints: [],
                            tempPolygonPoints: [],
                            selectedFeature: null,
                            isDragging: false,
                            selectedVertices: []
                        });
                        uiManager.updateUI();
                        renderData();
                    });
                } catch (error) {
                    debugLog(1, `${toolId} クリック時にエラー: ${error}`);
                    showNotification('ツールの切り替え中にエラーが発生しました。', 'error');
                }
            });
        });

        const svg = d3.select('#map svg');
        if (!svg.empty()) {
            svg.on('click', (event) => {
                debugLog(4, '地図の svg.click イベントが発生しました。');
                try {
                    const currentState = stateManager.getState();
                    const [x, y] = d3.pointer(event);
                    const transform = d3.zoomTransform(svg.node());
                    const scaledX = (x - transform.x) / transform.k;
                    const scaledY = (y - transform.y) / transform.k;

                    const mapWidthVal = getMapWidth();
                    const offsetXValue = Math.floor(scaledX / mapWidthVal) * mapWidthVal;
                    const adjustedX = scaledX % mapWidthVal;
                    const correctedX = adjustedX < 0 ? adjustedX + mapWidthVal : adjustedX;
                    const finalX = correctedX + offsetXValue;

                    // 編集モード & 頂点編集ツール
                    if (
                        currentState.isEditMode &&
                        (currentState.currentTool === 'lineVertexEdit' ||
                            currentState.currentTool === 'polygonVertexEdit') &&
                        currentState.selectedFeature
                    ) {
                        const feature = currentState.selectedFeature;
                        const isPolygon = (currentState.currentTool === 'polygonVertexEdit');
                        const requiredMin = isPolygon ? 3 : 2;

                        if (feature.points && feature.points.length < requiredMin) {
                            feature.points.push({ x: finalX, y: scaledY });
                            if (currentState.currentTool === 'lineVertexEdit') {
                                DataStore.updateLine(feature);
                            } else {
                                DataStore.updatePolygon(feature);
                            }
                            renderData();
                            return;
                        }
                    }

                    // 追加モード
                    if (currentState.isAddMode) {
                        if (currentState.currentTool === 'point') {
                            stateManager.setState({
                                isDrawing: true,
                                tempPoint: { x: finalX, y: scaledY },
                            });
                            renderData();
                            showEditForm(null, renderData);
                        } else if (currentState.currentTool === 'line') {
                            if (!currentState.isDrawing) {
                                stateManager.setState({
                                    isDrawing: true,
                                    tempLinePoints: [{ x: finalX, y: scaledY }],
                                });
                            } else {
                                const updatedPoints = [...currentState.tempLinePoints, { x: finalX, y: scaledY }];
                                stateManager.setState({ tempLinePoints: updatedPoints });
                            }
                            renderData();
                        } else if (currentState.currentTool === 'polygon') {
                            if (!currentState.isDrawing) {
                                stateManager.setState({
                                    isDrawing: true,
                                    tempPolygonPoints: [{ x: finalX, y: scaledY }],
                                });
                            } else {
                                const updatedPoints = [...currentState.tempPolygonPoints, { x: finalX, y: scaledY }];
                                stateManager.setState({ tempPolygonPoints: updatedPoints });
                            }
                            renderData();
                        }
                    }
                } catch (error) {
                    debugLog(1, `地図クリックイベントでエラー: ${error}`);
                    showNotification('地図上での操作中にエラーが発生しました。', 'error');
                }
            });
        }

        document.getElementById('confirmDrawButton').addEventListener('click', () => {
            debugLog(4, 'confirmDrawButton クリックイベントが発生しました。');
            try {
                const currentState = stateManager.getState();
                const currentYear = currentState.currentYear || 0;
                if (currentState.isAddMode && currentState.isDrawing) {
                    if (currentState.currentTool === 'line' && currentState.tempLinePoints.length >= 2) {
                        const newLine = {
                            id: Date.now(),
                            points: currentState.tempLinePoints.slice(),
                            properties: [{
                                year: currentYear,
                                name: '新しい線情報',
                                description: '',
                            }],
                        };
                        DataStore.addLine(newLine);
                        stateManager.setState({
                            isDrawing: false,
                            tempLinePoints: [],
                            tempPoint: null,
                        });
                        renderData();
                        showLineEditForm(newLine, renderData, true, true);
                    } else if (currentState.currentTool === 'polygon' && currentState.tempPolygonPoints.length >= 3) {
                        const newPolygon = {
                            id: Date.now(),
                            points: currentState.tempPolygonPoints.slice(),
                            properties: [{
                                year: currentYear,
                                name: '新しい面情報',
                                description: '',
                            }],
                        };
                        DataStore.addPolygon(newPolygon);
                        stateManager.setState({
                            isDrawing: false,
                            tempPolygonPoints: [],
                            tempPoint: null,
                        });
                        renderData();
                        showPolygonEditForm(newPolygon, renderData, true, true);
                    }
                }
            } catch (error) {
                debugLog(1, `confirmDrawButton のクリックイベントでエラー: ${error}`);
                showNotification('描画の確定中にエラーが発生しました。', 'error');
            }
        });

        const timeSlider = document.getElementById('timeSlider');
        const currentYearDisplay = document.getElementById('currentYear');
        timeSlider.addEventListener('input', () => {
            debugLog(4, 'timeSlider inputイベントが発生しました。');
            try {
                const newYear = parseInt(timeSlider.value, 10);
                stateManager.setState({ currentYear: newYear });
                currentYearDisplay.textContent = `年: ${newYear}`;
                renderData();
            } catch (error) {
                debugLog(1, `時間スライダーの変更中にエラー: ${error}`);
            }
        });

        document.getElementById('updateSliderButton').addEventListener('click', () => {
            debugLog(4, 'updateSliderButton クリックイベントが発生しました。');
            try {
                const min = parseInt(document.getElementById('sliderMin').value, 10);
                const max = parseInt(document.getElementById('sliderMax').value, 10);
                if (isNaN(min) || isNaN(max) || min >= max) {
                    showNotification('最小値と最大値を正しく入力してください。', 'error');
                    return;
                }
                stateManager.setState({
                    sliderMin: min,
                    sliderMax: max,
                    currentYear: Math.max(state.currentYear, min),
                });
                uiManager.updateSlider();
                renderData();
            } catch (error) {
                debugLog(1, `updateSliderButton のクリックイベントでエラー: ${error}`);
                showNotification('スライダーの更新中にエラーが発生しました。', 'error');
            }
        });

        document.getElementById('saveWorldSettingsButton').addEventListener('click', () => {
            debugLog(4, 'saveWorldSettingsButton クリックイベントが発生しました。');
            try {
                const name = document.getElementById('worldName').value;
                const description = document.getElementById('worldDescription').value;
                stateManager.setState({
                    worldName: name,
                    worldDescription: description,
                });
                uiManager.updateWorldInfo();
            } catch (error) {
                debugLog(1, `saveWorldSettingsButton のクリックイベントでエラー: ${error}`);
                showNotification('世界情報の保存中にエラーが発生しました。', 'error');
            }
        });

        document.getElementById('settingsButton').addEventListener('click', () => {
            debugLog(4, 'settingsButton クリックイベントが発生しました。');
            try {
                const settingsModal = document.getElementById('settingsModal');
                settingsModal.style.display = 'block';
                uiManager.populateSettings();
            } catch (error) {
                debugLog(1, `settingsButton のクリックイベントでエラー: ${error}`);
                showNotification('設定ウィンドウの表示中にエラーが発生しました。', 'error');
            }
        });

        document.getElementById('closeSettingsButton').addEventListener('click', () => {
            debugLog(4, 'closeSettingsButton クリックイベントが発生しました。');
            try {
                const settingsModal = document.getElementById('settingsModal');
                settingsModal.style.display = 'none';
            } catch (error) {
                debugLog(1, `closeSettingsButton のクリックイベントでエラー: ${error}`);
                showNotification('設定ウィンドウの閉鎖中にエラーが発生しました。', 'error');
            }
        });

        window.addEventListener('click', (event) => {
            // モーダル背景をクリックしたときに閉じる
            try {
                const settingsModal = document.getElementById('settingsModal');
                if (event.target === settingsModal) {
                    settingsModal.style.display = 'none';
                }
            } catch (error) {
                debugLog(1, `モーダル外クリックでエラー: ${error}`);
            }
        });

        document.addEventListener('keydown', (e) => {
            try {
                if (e.key === 'Delete') {
                    debugLog(4, 'Deleteキー押下イベントが発生しました。');
                    const state = stateManager.getState();
                    const { selectedFeature } = state;
                    if (selectedFeature && (state.currentTool === 'lineVertexEdit' || state.currentTool === 'polygonVertexEdit')) {
                        removeSelectedVertices();
                    } else if (selectedFeature && state.currentTool === 'pointMove') {
                        if (selectedFeature.points && selectedFeature.points.length === 1) {
                            DataStore.removePoint(selectedFeature.id);
                            stateManager.setState({ selectedFeature: null, selectedVertices: [] });
                            renderData();
                        }
                    }
                }
            } catch (error) {
                debugLog(1, `Deleteキー押下時にエラー: ${error}`);
            }
        });

        function confirmObjectValidityBeforeModeChange(callback) {
            debugLog(4, 'confirmObjectValidityBeforeModeChange() が呼び出されました。');
            const currentState = stateManager.getState();
            const selectedFeature = currentState.selectedFeature;
            if (!selectedFeature) {
                callback();
                return;
            }
            if (!selectedFeature.id) {
                selectedFeature.id = Date.now() + Math.random();
            }
            if (
                (currentState.currentTool === 'lineVertexEdit' && selectedFeature.points && selectedFeature.points.length < 2) ||
                (currentState.currentTool === 'polygonVertexEdit' && selectedFeature.points && selectedFeature.points.length < 3)
            ) {
                window.electronAPI.invoke('show-confirm-dialog', {
                    title: 'データの確認',
                    message: 'このオブジェクトは有効な形状ではありません。削除しますか？'
                }).then((result) => {
                    if (result) {
                        if (currentState.currentTool === 'lineVertexEdit') {
                            DataStore.removeLine(selectedFeature.id);
                        } else if (currentState.currentTool === 'polygonVertexEdit') {
                            DataStore.removePolygon(selectedFeature.id);
                        }
                        stateManager.setState({ selectedFeature: null, selectedVertices: [] });
                        renderData();
                        callback();
                    } else {
                        uiManager.showNotification('不正なオブジェクトが残っています。頂点を追加してください。', 'warning');
                    }
                }).catch(error => {
                    debugLog(1, `確認ダイアログ表示中にエラー: ${error}`);
                    uiManager.showNotification('確認中にエラーが発生しました。', 'error');
                });
            } else {
                callback();
            }
        }
    } catch (error) {
        debugLog(1, `setupUIEventListeners() でエラーが発生: ${error}`);
    }
}
