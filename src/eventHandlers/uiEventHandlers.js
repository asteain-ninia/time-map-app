// src/eventHandlers/uiEventHandlers.js

import stateManager from '../../stateManager.js';
import DataStore from '../../dataStore.js';
import uiManager from '../ui/uiManager.js';
import { showEditForm, showLineEditForm, showPolygonEditForm } from '../ui/forms.js';
import { removeSelectedVertices } from '../map/mapInteraction.js';
import { getMapWidth } from '../map/mapRenderer.js';

/**
 * UIイベント系のリスナーを設定する
 * (IPCを含まない、純粋にUIやDOM操作に関連するイベント)
 *
 * @param {Object} DataStore - データストア
 * @param {Object} MapModuleInstance - 地図モジュール
 * @param {Function} renderData - 再描画関数
 */
export function setupUIEventListeners(DataStore, MapModuleInstance, renderData) {
    let state = stateManager.getState();

    // Stateを購読し、変化するたびにローカル変数stateを更新
    stateManager.subscribe((newState) => {
        state = newState;
    });

    // 「追加モード」ボタン
    document.getElementById('addModeButton').addEventListener('click', () => {
        try {
            confirmObjectValidityBeforeModeChange(() => {
                const isAddMode = !state.isAddMode;
                stateManager.setState({
                    isAddMode,
                    isEditMode: false,
                    currentTool: isAddMode ? 'select' : 'select',
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

                if (state.debugMode) {
                    console.info('追加モードが切り替えられました:', isAddMode);
                }
            });
        } catch (error) {
            console.error('addModeButton のクリックイベントでエラー:', error);
            uiManager.showNotification('追加モードの切り替え中にエラーが発生しました。', 'error');
        }
    });

    // 「編集モード」ボタン
    document.getElementById('editModeButton').addEventListener('click', () => {
        try {
            confirmObjectValidityBeforeModeChange(() => {
                const isEditMode = !state.isEditMode;
                stateManager.setState({
                    isEditMode,
                    isAddMode: false,
                    currentTool: isEditMode ? 'select' : 'select',
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

                if (state.debugMode) {
                    console.info('編集モードが切り替えられました:', isEditMode);
                }
            });
        } catch (error) {
            console.error('editModeButton のクリックイベントでエラー:', error);
            uiManager.showNotification('編集モードの切り替え中にエラーが発生しました。', 'error');
        }
    });

    // ツールバーの各ツールボタン
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

                    if (state.debugMode) {
                        console.info(`${toolName} ツールが選択されました。`);
                    }
                });
            } catch (error) {
                console.error(`${toolId} のクリックイベントでエラー:`, error);
                uiManager.showNotification('ツールの切り替え中にエラーが発生しました。', 'error');
            }
        });
    });

    // 地図クリックイベント (追加モードなど)
    const svg = d3.select('#map svg');
    if (!svg.empty()) {
        svg.on('click', (event) => {
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
                    if (state.debugMode) {
                        console.info(`追加モードクリック: ツール=${currentState.currentTool} 座標=(${finalX}, ${scaledY})`);
                    }

                    if (currentState.currentTool === 'point') {
                        // 新規ポイント
                        stateManager.setState({
                            isDrawing: true,
                            tempPoint: {
                                x: finalX,
                                y: scaledY,
                            },
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
                console.error('地図クリックイベントでエラー:', error);
                uiManager.showNotification('地図上での操作中にエラーが発生しました。', 'error');
            }
        });
    }

    // 「確定」ボタン (ライン/ポリゴン追加確定)
    document.getElementById('confirmDrawButton').addEventListener('click', () => {
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
                            name: '新しい線',
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
                            name: '新しい面',
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

                } else {
                    // 頂点不足、または対応外
                }
            }
        } catch (error) {
            console.error('confirmDrawButton のクリックでエラー:', error);
            uiManager.showNotification('描画の確定中にエラーが発生しました。', 'error');
        }
    });

    // 時間スライダー (inputイベント)
    const timeSlider = document.getElementById('timeSlider');
    const currentYearDisplay = document.getElementById('currentYear');
    timeSlider.addEventListener('input', () => {
        try {
            const newYear = parseInt(timeSlider.value, 10);
            stateManager.setState({ currentYear: newYear });
            currentYearDisplay.textContent = `年: ${newYear}`;
            renderData();

            if (state.debugMode) {
                console.info(`年が変更されました: ${newYear}`);
            }
        } catch (error) {
            console.error('時間スライダー変更時のエラー:', error);
        }
    });

    // スライダー更新ボタン (「スライダー更新」)
    document.getElementById('updateSliderButton').addEventListener('click', () => {
        try {
            const min = parseInt(document.getElementById('sliderMin').value, 10);
            const max = parseInt(document.getElementById('sliderMax').value, 10);

            if (isNaN(min) || isNaN(max) || min >= max) {
                uiManager.showNotification('最小値と最大値を正しく入力してください。', 'error');
                return;
            }

            stateManager.setState({
                sliderMin: min,
                sliderMax: max,
                currentYear: Math.max(state.currentYear, min),
            });

            uiManager.updateSlider();
            renderData();

            if (state.debugMode) {
                console.info('スライダーの最小・最大値が更新されました。');
            }
        } catch (error) {
            console.error('updateSliderButton のクリックでエラー:', error);
            uiManager.showNotification('スライダーの更新中にエラーが発生しました。', 'error');
        }
    });

    // 「世界情報を保存」ボタン
    document.getElementById('saveWorldSettingsButton').addEventListener('click', () => {
        try {
            const name = document.getElementById('worldName').value;
            const description = document.getElementById('worldDescription').value;

            stateManager.setState({
                worldName: name,
                worldDescription: description,
            });

            uiManager.updateWorldInfo();
        } catch (error) {
            console.error('saveWorldSettingsButton のクリックイベントでエラー:', error);
            uiManager.showNotification('世界情報の保存中にエラーが発生しました。', 'error');
        }
    });

    // 「設定」ボタン
    document.getElementById('settingsButton').addEventListener('click', () => {
        try {
            const settingsModal = document.getElementById('settingsModal');
            settingsModal.style.display = 'block';
            uiManager.populateSettings();
        } catch (error) {
            console.error('settingsButton のクリックイベントでエラー:', error);
            uiManager.showNotification('設定ウィンドウの表示中にエラーが発生しました。', 'error');
        }
    });

    // 設定モーダルの閉じるボタン
    document.getElementById('closeSettingsButton').addEventListener('click', () => {
        try {
            const settingsModal = document.getElementById('settingsModal');
            settingsModal.style.display = 'none';
        } catch (error) {
            console.error('closeSettingsButton のクリックイベントでエラー:', error);
            uiManager.showNotification('設定ウィンドウの閉鎖中にエラーが発生しました。', 'error');
        }
    });

    // モーダル外をクリックすると閉じる
    window.addEventListener('click', (event) => {
        try {
            const settingsModal = document.getElementById('settingsModal');
            if (event.target === settingsModal) {
                settingsModal.style.display = 'none';
            }
        } catch (error) {
            console.error('モーダル外クリックイベントでエラー:', error);
        }
    });

    // Deleteキーで頂点削除・ポイント削除
    document.addEventListener('keydown', (e) => {
        try {
            if (e.key === 'Delete') {
                const state = stateManager.getState();
                const { selectedFeature } = state;

                if (selectedFeature && (state.currentTool === 'lineVertexEdit' || state.currentTool === 'polygonVertexEdit')) {
                    removeSelectedVertices();
                } else if (selectedFeature && state.currentTool === 'pointMove') {
                    // 単頂点(ポイント)なら削除
                    if (selectedFeature.points && selectedFeature.points.length === 1) {
                        DataStore.removePoint(selectedFeature.id);
                        stateManager.setState({ selectedFeature: null, selectedVertices: [] });
                        renderData();
                    }
                }
            }
        } catch (error) {
            console.error('Deleteキー押下時にエラー:', error);
        }
    });

    /**
     * 他モードへ切り替える際、選択中のオブジェクトの頂点数が不正なら確認ダイアログを表示
     */
    function confirmObjectValidityBeforeModeChange(callback) {
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
            // 形状が不正 → 削除するか確認
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
                console.error('確認ダイアログ表示中にエラー:', error);
                uiManager.showNotification('確認中にエラーが発生しました。', 'error');
            });
        } else {
            callback();
        }
    }
}

