// eventHandlers.js

import stateManager from './stateManager.js';
import MapModule from './map.js';

const EventHandlers = (() => {
    function setupEventListeners(DataStore, MapModuleInstance, UI, ipc, renderData) {
        try {
            let state = stateManager.getState();

            stateManager.subscribe(newState => {
                state = newState;
            });

            document.getElementById('addModeButton').addEventListener('click', () => {
                try {
                    // モード変更時に不正オブジェクトチェック
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
                        UI.updateUI();
                        renderData();

                        if (state.debugMode) {
                            console.info('追加モードが切り替えられました:', isAddMode);
                        }
                    });
                } catch (error) {
                    console.error('addModeButton のクリックイベントでエラーが発生しました:', error);
                    UI.showNotification('追加モードの切り替え中にエラーが発生しました。', 'error');
                }
            });

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
                        UI.updateUI();
                        renderData();

                        if (state.debugMode) {
                            console.info('編集モードが切り替えられました:', isEditMode);
                        }
                    });
                } catch (error) {
                    console.error('editModeButton のクリックイベントでエラーが発生しました:', error);
                    UI.showNotification('編集モードの切り替え中にエラーが発生しました。', 'error');
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
                    try {
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
                        UI.updateUI();
                        renderData();

                        if (state.debugMode) {
                            console.info(`${toolName} ツールが選択されました。`);
                        }
                    } catch (error) {
                        console.error(`${toolId} のクリックイベントでエラーが発生しました:`, error);
                        UI.showNotification('ツールの切り替え中にエラーが発生しました。', 'error');
                    }
                });
            });

            const svg = d3.select('#map svg');
            if (!svg.empty()) {
                svg.on('click', (event) => {
                    try {
                        const currentState = stateManager.getState();
                        const [x, y] = d3.pointer(event);
                        const transform = d3.zoomTransform(svg.node());
                        const scaledX = (x - transform.x) / transform.k;
                        const scaledY = (y - transform.y) / transform.k;

                        const mapWidth = MapModule.getMapWidth();
                        const offsetXValue = Math.floor(scaledX / mapWidth) * mapWidth;
                        const adjustedX = scaledX % mapWidth;
                        const correctedX = adjustedX < 0 ? adjustedX + mapWidth : adjustedX;
                        const finalX = correctedX + offsetXValue;

                        // 不完全なライン/ポリゴンに頂点追加（1点状態）
                        if (currentState.isEditMode && (currentState.currentTool === 'lineVertexEdit' || currentState.currentTool === 'polygonVertexEdit') && currentState.selectedFeature) {
                            const feature = currentState.selectedFeature;
                            const isPolygon = currentState.currentTool === 'polygonVertexEdit';
                            const requiredMin = isPolygon ? 3 : 2;

                            if (feature.points && feature.points.length < requiredMin) {
                                // 不足しているのでクリックで頂点追加
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

                        if (currentState.isAddMode) {
                            if (state.debugMode) {
                                console.info(`追加モードでクリックが発生しました。ツール: ${currentState.currentTool}, 座標: (${finalX}, ${scaledY})`);
                            }

                            if (currentState.currentTool === 'point') {
                                stateManager.setState({
                                    isDrawing: true,
                                    tempPoint: {
                                        x: finalX,
                                        y: scaledY,
                                    },
                                });
                                renderData();
                                UI.showEditForm(null, DataStore, renderData);
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
                        console.error('地図のクリックイベントでエラーが発生しました:', error);
                        UI.showNotification('地図上での操作中にエラーが発生しました。', 'error');
                    }
                });
            }

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
                            UI.showLineEditForm(newLine, DataStore, renderData, true, true);
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
                            UI.showPolygonEditForm(newPolygon, DataStore, renderData, true, true);
                        } else {
                            UI.showNotification('ポイントが足りません。', 'error');
                        }

                        if (state.debugMode) {
                            console.info('描画が確定されました。');
                        }
                    }
                } catch (error) {
                    console.error('confirmDrawButton のクリックイベントでエラーが発生しました:', error);
                    UI.showNotification('描画の確定中にエラーが発生しました。', 'error');
                }
            });

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
                    console.error('時間スライダーの変更中にエラーが発生しました:', error);
                    UI.showNotification('時間の変更中にエラーが発生しました。', 'error');
                }
            });

            document.getElementById('saveButton').addEventListener('click', () => {
                try {
                    const dataToSave = DataStore.getData();
                    ipc.send('save-data', dataToSave);

                    if (state.debugMode) {
                        console.info('データの保存が開始されました。');
                    }
                } catch (error) {
                    console.error('saveButton のクリックイベントでエラーが発生しました:', error);
                    UI.showNotification('データの保存中にエラーが発生しました。', 'error');
                }
            });

            document.getElementById('loadButton').addEventListener('click', () => {
                try {
                    if (DataStore.hasUnsavedChanges()) {
                        ipc.invoke('show-confirm-dialog', {
                            title: 'データの読み込み',
                            message: '保存されていない変更があります。続行しますか？',
                        }).then((result) => {
                            if (result) {
                                ipc.send('load-data');
                            }
                        }).catch((error) => {
                            console.error('確認ダイアログの表示中にエラーが発生しました:', error);
                            UI.showNotification('データの読み込み中にエラーが発生しました。', 'error');
                        });
                    } else {
                        ipc.send('load-data');
                    }
                } catch (error) {
                    console.error('loadButton のクリックイベントでエラーが発生しました:', error);
                    UI.showNotification('データの読み込み中にエラーが発生しました。', 'error');
                }
            });

            ipc.on('load-data-reply', (data) => {
                try {
                    if (data) {
                        DataStore.loadData(data);
                        DataStore.resetUnsavedChanges();

                        stateManager.setState({
                            sliderMin: data.metadata && data.metadata.sliderMin !== undefined ? data.metadata.sliderMin : 0,
                            sliderMax: data.metadata && data.metadata.sliderMax !== undefined ? data.metadata.sliderMax : 10000,
                            worldName: data.metadata && data.metadata.worldName ? data.metadata.worldName : '',
                            worldDescription: data.metadata && data.metadata.worldDescription ? data.metadata.worldDescription : '',
                            currentYear: data.metadata && data.metadata.sliderMin !== undefined ? data.metadata.sliderMin : 0,
                            selectedFeature: null,
                            isDrawing: false,
                            tempPoint: null,
                            tempLinePoints: [],
                            tempPolygonPoints: [],
                            selectedVertices: []
                        });

                        UI.updateSlider();
                        UI.updateWorldInfo();
                        UI.updateUI();
                        renderData();

                        UI.showNotification('データが正常に読み込まれました。', 'info');
                    } else {
                        UI.showNotification('データの読み込みがキャンセルされました。', 'info');
                    }
                } catch (error) {
                    console.error('load-data-reply イベントでエラーが発生しました:', error);
                    UI.showNotification('データの読み込み中にエラーが発生しました。', 'error');
                }
            });

            ipc.on('save-data-reply', (success) => {
                try {
                    if (success) {
                        DataStore.resetUnsavedChanges();
                        UI.showNotification('データが正常に保存されました。', 'info');

                        if (state.debugMode) {
                            console.info('データの保存が完了しました。');
                        }
                    } else {
                        UI.showNotification('データの保存中にエラーが発生しました。', 'error');
                    }
                } catch (error) {
                    console.error('save-data-reply イベントでエラーが発生しました:', error);
                    UI.showNotification('データの保存中にエラーが発生しました。', 'error');
                }
            });

            document.getElementById('updateSliderButton').addEventListener('click', () => {
                try {
                    const min = parseInt(document.getElementById('sliderMin').value, 10);
                    const max = parseInt(document.getElementById('sliderMax').value, 10);

                    if (isNaN(min) || isNaN(max) || min >= max) {
                        UI.showNotification('最小値と最大値を正しく入力してください。', 'error');
                        return;
                    }

                    stateManager.setState({
                        sliderMin: min,
                        sliderMax: max,
                        currentYear: Math.max(state.currentYear, min),
                    });

                    UI.updateSlider();
                    renderData();

                    if (state.debugMode) {
                        console.info('スライダーの最小・最大値が更新されました。');
                    }
                } catch (error) {
                    console.error('updateSliderButton のクリックイベントでエラーが発生しました:', error);
                    UI.showNotification('スライダーの更新中にエラーが発生しました。', 'error');
                }
            });

            document.getElementById('saveWorldSettingsButton').addEventListener('click', () => {
                try {
                    const name = document.getElementById('worldName').value;
                    const description = document.getElementById('worldDescription').value;

                    stateManager.setState({
                        worldName: name,
                        worldDescription: description,
                    });

                    UI.updateWorldInfo();

                    if (state.debugMode) {
                        console.info('世界の名前と概要が更新されました。');
                    }
                } catch (error) {
                    console.error('saveWorldSettingsButton のクリックイベントでエラーが発生しました:', error);
                    UI.showNotification('世界情報の保存中にエラーが発生しました。', 'error');
                }
            });

            document.getElementById('settingsButton').addEventListener('click', () => {
                try {
                    const settingsModal = document.getElementById('settingsModal');
                    settingsModal.style.display = 'block';
                    UI.populateSettings();
                } catch (error) {
                    console.error('settingsButton のクリックイベントでエラーが発生しました:', error);
                    UI.showNotification('設定ウィンドウの表示中にエラーが発生しました。', 'error');
                }
            });

            document.getElementById('closeSettingsButton').addEventListener('click', () => {
                try {
                    const settingsModal = document.getElementById('settingsModal');
                    settingsModal.style.display = 'none';
                } catch (error) {
                    console.error('closeSettingsButton のクリックイベントでエラーが発生しました:', error);
                    UI.showNotification('設定ウィンドウの閉鎖中にエラーが発生しました。', 'error');
                }
            });

            window.addEventListener('click', (event) => {
                try {
                    const settingsModal = document.getElementById('settingsModal');
                    if (event.target === settingsModal) {
                        settingsModal.style.display = 'none';
                    }
                } catch (error) {
                    console.error('モーダル外クリックイベントでエラーが発生しました:', error);
                }
            });

            document.addEventListener('keydown', (e) => {
                try {
                    if (e.key === 'Delete') {
                        const state = stateManager.getState();
                        const { selectedFeature } = state;

                        if (selectedFeature && (state.currentTool === 'lineVertexEdit' || state.currentTool === 'polygonVertexEdit')) {
                            MapModule.removeSelectedVertices();
                        }
                    }
                } catch (error) {
                    console.error('Deleteキー押下時にエラーが発生しました:', error);
                }
            });

            /**
             * モード変更前にオブジェクト有効性を確認する関数
             * 不正なライン・ポリゴン（頂点不足）の場合、ダイアログ表示
             * @param {Function} callback - 有効または削除で決定後呼び出す
             */
            function confirmObjectValidityBeforeModeChange(callback) {
                const state = stateManager.getState();
                const selectedFeature = state.selectedFeature;
                if (!selectedFeature) {
                    callback();
                    return;
                }

                // 現在のツールがラインまたはポリゴン頂点編集モードのとき、不足チェック
                if ((state.currentTool === 'lineVertexEdit' && selectedFeature.points && selectedFeature.points.length < 2) ||
                    (state.currentTool === 'polygonVertexEdit' && selectedFeature.points && selectedFeature.points.length < 3)) {
                    ipc.invoke('show-confirm-dialog', {
                        title: 'データの確認',
                        message: 'このオブジェクトは有効な形状ではありません。削除しますか？'
                    }).then(result => {
                        if (result) {
                            // 削除実行
                            if (state.currentTool === 'lineVertexEdit') {
                                DataStore.removeLine(selectedFeature.id);
                            } else if (state.currentTool === 'polygonVertexEdit') {
                                DataStore.removePolygon(selectedFeature.id);
                            }
                            stateManager.setState({ selectedFeature: null, selectedVertices: [] });
                            renderData();
                            callback();
                        } else {
                            // キャンセル時
                            UI.showNotification('不正なオブジェクトが残っています。頂点を追加してください。', 'warning');
                        }
                    }).catch(error => {
                        console.error('確認ダイアログの表示中にエラーが発生しました:', error);
                        UI.showNotification('確認中にエラーが発生しました。', 'error');
                    });
                } else {
                    // 有効ならそのまま
                    callback();
                }
            }

        } catch (error) {
            console.error('setupEventListeners 関数内でエラーが発生しました:', error);
            UI.showNotification('イベントリスナーの設定中にエラーが発生しました。', 'error');
        }
    }

    return {
        setupEventListeners,
    };
})();

export default EventHandlers;
