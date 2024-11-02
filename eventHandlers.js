// eventHandlers.js

import stateManager from './stateManager.js';

const EventHandlers = (() => {
    function setupEventListeners(DataStore, MapModule, UI, ipc, renderData) {
        try {
            // 状態の取得
            let state = stateManager.getState();

            // 状態の変更時に再度状態を取得
            stateManager.subscribe(newState => {
                state = newState;
            });

            // 編集モードボタンのイベントリスナー
            document.getElementById('editModeButton').addEventListener('click', () => {
                try {
                    const isEditMode = !state.isEditMode;
                    stateManager.setState({
                        isEditMode,
                        currentTool: isEditMode ? state.currentTool : 'select',
                        isDrawing: false,
                        tempPoint: null,
                        tempLinePoints: [],
                        tempPolygonPoints: [],
                    });
                    UI.updateUI();
                    renderData();

                    if (state.debugMode) {
                        console.info('編集モードが切り替えられました:', isEditMode);
                    }
                } catch (error) {
                    console.error('editModeButton のクリックイベントでエラーが発生しました:', error);
                    UI.showNotification('編集モードの切り替え中にエラーが発生しました。', 'error');
                }
            });

            // ツールボタンのイベントリスナー
            ['selectTool', 'pointTool', 'lineTool', 'polygonTool'].forEach(toolId => {
                document.getElementById(toolId).addEventListener('click', () => {
                    try {
                        const toolName = toolId.replace('Tool', '');
                        stateManager.setState({
                            currentTool: toolName,
                            isDrawing: false,
                            tempPoint: null,
                            tempLinePoints: [],
                            tempPolygonPoints: [],
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

            // 地図上のクリックイベントを設定
            const svg = d3.select('#map svg');
            if (!svg.empty()) {
                svg.on('click', (event) => {
                    try {
                        const currentState = stateManager.getState();
                        if (currentState.isEditMode) {
                            const [x, y] = d3.pointer(event);
                            const transform = d3.zoomTransform(svg.node());
                            const scaledX = (x - transform.x) / transform.k;
                            const scaledY = (y - transform.y) / transform.k;

                            const mapWidth = MapModule.getMapWidth();
                            const offsetXValue = Math.floor(scaledX / mapWidth) * mapWidth;
                            const adjustedX = scaledX % mapWidth;
                            const correctedX = adjustedX < 0 ? adjustedX + mapWidth : adjustedX;
                            const finalX = correctedX + offsetXValue;

                            if (currentState.currentTool === 'point') {
                                stateManager.setState({
                                    isDrawing: true,
                                    tempPoint: {
                                        x: finalX,
                                        y: scaledY,
                                    },
                                });
                                renderData(); // 一時的なポイントを表示
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

                            if (state.debugMode) {
                                console.info(`地図上でクリックが発生しました。ツール: ${currentState.currentTool}, 座標: (${finalX}, ${scaledY})`);
                            }
                        }
                    } catch (error) {
                        console.error('地図のクリックイベントでエラーが発生しました:', error);
                        UI.showNotification('地図上での操作中にエラーが発生しました。', 'error');
                    }
                });

                // ダブルクリックで線や面の描画を完了
                svg.on('dblclick.zoom', null);
                svg.on('dblclick', (event) => {
                    try {
                        const currentState = stateManager.getState();
                        if (currentState.isEditMode && currentState.isDrawing) {
                            const currentYear = currentState.currentYear || 0;
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
                                });
                                renderData();
                                UI.showLineEditForm(newLine, DataStore, renderData, true);
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
                                });
                                renderData();
                                UI.showPolygonEditForm(newPolygon, DataStore, renderData, true);
                            } else {
                                UI.showNotification('ポイントが足りません。', 'error');
                            }

                            if (state.debugMode) {
                                console.info(`地図上でダブルクリックが発生しました。ツール: ${currentState.currentTool}`);
                            }
                        }
                    } catch (error) {
                        console.error('地図のダブルクリックイベントでエラーが発生しました:', error);
                        UI.showNotification('描画の確定中にエラーが発生しました。', 'error');
                    }
                });
            } else {
                console.error('SVG 要素が見つかりません');
                UI.showNotification('地図が正しく読み込まれていません。', 'error');
            }

            // 確定ボタンのイベントリスナー
            document.getElementById('confirmDrawButton').addEventListener('click', () => {
                try {
                    const currentState = stateManager.getState();
                    const currentYear = currentState.currentYear || 0;
                    if (currentState.isEditMode && currentState.isDrawing) {
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
                            UI.showLineEditForm(newLine, DataStore, renderData, true);
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
                            UI.showPolygonEditForm(newPolygon, DataStore, renderData, true);
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

            // スライダーのイベントリスナー
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

            // 保存・読み込みボタンのイベントリスナーや、IPC通信の設定
            document.getElementById('saveButton').addEventListener('click', () => {
                try {
                    const dataToSave = {
                        points: DataStore.getAllPoints(),
                        lines: DataStore.getAllLines(),
                        polygons: DataStore.getAllPolygons(),
                    };
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
                    // 既存のデータがあるか確認
                    if (
                        DataStore.getAllPoints().length > 0 ||
                        DataStore.getAllLines().length > 0 ||
                        DataStore.getAllPolygons().length > 0
                    ) {
                        ipc.invoke('show-confirm-dialog', {
                            message: '既存のデータがあります。新しいデータを読み込む前に、既存のデータを消去しますか？',
                        })
                            .then((result) => {
                                if (result) {
                                    ipc.send('load-data');

                                    if (state.debugMode) {
                                        console.info('データの読み込みが開始されました。');
                                    }
                                }
                            })
                            .catch((error) => {
                                console.error('確認ダイアログの表示中にエラーが発生しました:', error);
                                UI.showNotification('データの読み込み中にエラーが発生しました。', 'error');
                            });
                    } else {
                        ipc.send('load-data');

                        if (state.debugMode) {
                            console.info('データの読み込みが開始されました。');
                        }
                    }
                } catch (error) {
                    console.error('loadButton のクリックイベントでエラーが発生しました:', error);
                    UI.showNotification('データの読み込み中にエラーが発生しました。', 'error');
                }
            });

            // メインプロセスからのデータ受信
            ipc.on('load-data-reply', (data) => {
                try {
                    if (data) {
                        DataStore.clearData();
                        (data.points || []).forEach((point) => DataStore.addPoint(point));
                        (data.lines || []).forEach((line) => DataStore.addLine(line));
                        (data.polygons || []).forEach((polygon) => DataStore.addPolygon(polygon));
                        renderData();

                        if (state.debugMode) {
                            console.info('データの読み込みが完了しました。');
                        }
                    } else {
                        UI.showNotification('データの読み込み中にエラーが発生しました。', 'error');
                    }
                } catch (error) {
                    console.error('load-data-reply イベントでエラーが発生しました:', error);
                    UI.showNotification('データの読み込み中にエラーが発生しました。', 'error');
                }
            });

            ipc.on('save-data-reply', (success) => {
                try {
                    if (success) {
                        UI.showNotification('データを正常に保存しました。');

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
