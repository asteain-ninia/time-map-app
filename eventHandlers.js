// eventHandlers.js

import stateManager from './stateManager.js'; // 追加

const EventHandlers = (() => {
    function setupEventListeners(DataStore, MapModule, UI, ipc, renderData) {
        // 状態の取得
        let state = stateManager.getState();

        // 状態の変更時に再度状態を取得
        stateManager.subscribe(newState => {
            state = newState;
        });

        document.getElementById('editModeButton').addEventListener('click', () => {
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
        });

        // ツールボタンのイベントリスナー
        document.getElementById('selectTool').addEventListener('click', () => {
            stateManager.setState({
                currentTool: 'select',
                isDrawing: false,
                tempPoint: null,
                tempLinePoints: [],
                tempPolygonPoints: [],
            });
            UI.updateUI();
            renderData();
        });

        document.getElementById('pointTool').addEventListener('click', () => {
            stateManager.setState({
                currentTool: 'point',
                isDrawing: false,
                tempPoint: null,
                tempLinePoints: [],
                tempPolygonPoints: [],
            });
            UI.updateUI();
            renderData();
        });

        document.getElementById('lineTool').addEventListener('click', () => {
            stateManager.setState({
                currentTool: 'line',
                isDrawing: false,
                tempPoint: null,
                tempLinePoints: [],
                tempPolygonPoints: [],
            });
            UI.updateUI();
            renderData();
        });

        document.getElementById('polygonTool').addEventListener('click', () => {
            stateManager.setState({
                currentTool: 'polygon',
                isDrawing: false,
                tempPoint: null,
                tempLinePoints: [],
                tempPolygonPoints: [],
            });
            UI.updateUI();
            renderData();
        });

        // 地図上のクリックイベントを設定
        const svg = d3.select('#map svg');
        if (!svg.empty()) {
            svg.on('click', (event) => {
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
                }
            });

            // ダブルクリックで線や面の描画を完了
            svg.on('dblclick.zoom', null);
            svg.on('dblclick', (event) => {
                const currentState = stateManager.getState();
                if (currentState.isEditMode && currentState.isDrawing) {
                    if (currentState.currentTool === 'line' && currentState.tempLinePoints.length >= 2) {
                        const newLine = {
                            id: Date.now(),
                            name: '新しい線',
                            points: currentState.tempLinePoints.slice(),
                            properties: [],
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
                            name: '新しい面',
                            points: currentState.tempPolygonPoints.slice(),
                            properties: [],
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
                }
            });
        } else {
            console.error('SVG 要素が見つかりません');
        }

        // 確定ボタンのイベントリスナー
        document.getElementById('confirmDrawButton').addEventListener('click', () => {
            const currentState = stateManager.getState();
            const currentYear = currentState.currentYear || 0; // 現在の年を取得

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
            }
        });

        // スライダーのイベントリスナーを追加
        const timeSlider = document.getElementById('timeSlider');
        const currentYearDisplay = document.getElementById('currentYear');

        timeSlider.addEventListener('input', () => {
            const newYear = parseInt(timeSlider.value, 10);
            stateManager.setState({ currentYear: newYear });
            currentYearDisplay.textContent = `年: ${newYear}`;
            renderData();
        });

        // 保存・読み込みボタンのイベントリスナーや、IPC通信の設定
        document.getElementById('saveButton').addEventListener('click', () => {
            const dataToSave = {
                points: DataStore.getAllPoints(),
                lines: DataStore.getAllLines(),
                polygons: DataStore.getAllPolygons(),
            };
            ipc.send('save-data', dataToSave);
        });

        document.getElementById('loadButton').addEventListener('click', () => {
            // 既存のデータがあるか確認
            if (
                DataStore.getAllPoints().length > 0 ||
                DataStore.getAllLines().length > 0 ||
                DataStore.getAllPolygons().length > 0
            ) {
                // 既存のデータがある場合、確認ダイアログを表示
                ipc.invoke('show-confirm-dialog', {
                    message: '既存のデータがあります。新しいデータを読み込む前に、既存のデータを消去しますか？',
                })
                    .then((result) => {
                        if (result) {
                            // ユーザーが「はい」を選択した場合のみ、ファイル選択ダイアログを表示
                            ipc.send('load-data');
                        }
                    })
                    .catch((error) => {
                        console.error('確認ダイアログの表示中にエラーが発生しました:', error);
                    });
            } else {
                // 既存のデータがない場合は、直接ファイル選択ダイアログを表示
                ipc.send('load-data');
            }
        });

        // メインプロセスからのデータ受信
        ipc.on('load-data-reply', (data) => {
            if (data) {
                DataStore.clearData();
                (data.points || []).forEach((point) => DataStore.addPoint(point));
                (data.lines || []).forEach((line) => DataStore.addLine(line));
                (data.polygons || []).forEach((polygon) => DataStore.addPolygon(polygon));
                renderData();
            } else {
                UI.showNotification('データの読み込み中にエラーが発生しました。', 'error');
            }
        });

        ipc.on('save-data-reply', (success) => {
            if (success) {
                UI.showNotification('データを正常に保存しました。');
            } else {
                UI.showNotification('データの保存中にエラーが発生しました。', 'error');
            }
        });
    }

    return {
        setupEventListeners,
    };
})();

export default EventHandlers;
