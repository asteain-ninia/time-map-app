// eventHandlers.js

const EventHandlers = (() => {
    function setupEventListeners(State, DataStore, MapModule, UI, ipcRenderer, renderData) {
        document.getElementById('editModeButton').addEventListener('click', () => {
            State.isEditMode = !State.isEditMode;
            if (!State.isEditMode) {
                State.currentTool = 'select';
                State.isDrawing = false;
                State.tempLinePoints = [];
                State.tempPolygonPoints = [];
            }
            UI.updateUI(State);
            renderData();
        });

        // ツールボタンのイベントリスナー
        document.getElementById('selectTool').addEventListener('click', () => {
            State.currentTool = 'select';
            UI.updateUI(State);
            State.isDrawing = false;
            State.tempLinePoints = [];
            State.tempPolygonPoints = [];
            renderData();
        });
        document.getElementById('pointTool').addEventListener('click', () => {
            State.currentTool = 'point';
            UI.updateUI(State);
        });
        document.getElementById('lineTool').addEventListener('click', () => {
            State.currentTool = 'line';
            UI.updateUI(State);
        });
        document.getElementById('polygonTool').addEventListener('click', () => {
            State.currentTool = 'polygon';
            UI.updateUI(State);
        });
        console.log("イベント追加開始")
        console.log(d3.select('#map').selectAll("svg"))

        initialize()
        // 地図上のクリックイベント
        function initialize() {
            console.log("イベントリスナーを設定します");

            const svg = d3.select('#map svg');
            if (!svg.empty()) {
                svg.on('click', (event) => {
                    console.log("SVG がクリックされました");
                    if (State.isEditMode) {
                        const [x, y] = d3.pointer(event);
                        const transform = d3.zoomTransform(svg.node());
                        const scaledX = (x - transform.x) / transform.k;
                        const scaledY = (y - transform.y) / transform.k;

                        const mapWidth = MapModule.getMapWidth();
                        const offsetXValue = Math.floor(scaledX / mapWidth) * mapWidth;
                        const adjustedX = scaledX % mapWidth;
                        const correctedX = adjustedX < 0 ? adjustedX + mapWidth : adjustedX;
                        const finalX = correctedX + offsetXValue;

                        if (State.currentTool === 'point') {
                            const newPoint = {
                                id: Date.now(),
                                name: '新しいポイント',
                                x: finalX,
                                y: scaledY,
                                description: '',
                                year: State.currentYear || 0,
                            };
                            DataStore.addPoint(newPoint);
                            renderData();
                            UI.showEditForm(newPoint, DataStore, renderData, State);
                        } else if (State.currentTool === 'line') {
                            UI.updateUI(State);
                            if (!State.isDrawing) {
                                State.isDrawing = true;
                                State.tempLinePoints = [{ x: finalX, y: scaledY }];
                            } else {
                                State.tempLinePoints.push({ x: finalX, y: scaledY })
                            }
                            renderData();
                        } else if (State.currentTool === 'polygon') {
                            UI.updateUI(State);
                            if (!State.isDrawing) {
                                State.isDrawing = true;
                                State.tempPolygonPoints = [{ x: finalX, y: scaledY }];
                            } else {
                                State.tempPolygonPoints.push({ x: finalX, y: scaledY });
                            }
                            renderData();
                        }
                    }
                });

                // ダブルクリックで線や面の描画を完了
                svg.on('dblclick.zoom', null);
                svg.on('dblclick', (event) => {
                    if (State.isEditMode && State.isDrawing) {
                        if (State.currentTool === 'line' && State.tempLinePoints.length >= 2) {
                            const newLine = {
                                id: Date.now(),
                                name: '新しい線',
                                points: State.tempLinePoints.slice(),
                                description: '',
                                year: State.currentYear || 0,
                            };
                            DataStore.addLine(newLine);
                            State.isDrawing = false;
                            State.tempLinePoints = [];
                            renderData();
                            UI.showLineEditForm(newLine, DataStore, renderData, State);
                        } else if (State.currentTool === 'polygon' && State.tempPolygonPoints.length >= 3) {
                            const newPolygon = {
                                id: Date.now(),
                                name: '新しい面',
                                points: State.tempPolygonPoints.slice(),
                                description: '',
                                year: State.currentYear || 0,
                            };
                            DataStore.addPolygon(newPolygon);
                            State.isDrawing = false;
                            State.tempPolygonPoints = [];
                            renderData();
                            UI.showPolygonEditForm(newPolygon, DataStore, renderData, State);
                        } else {
                            UI.showNotification('ポイントが足りません。', 'error');
                        }
                    }
                });
            } else {
                console.error('SVG 要素が見つかりません');
            }

            // ドキュメントの状態を確認して、適切に処理を実行
            if (document.readyState === 'loading') {
                // まだ読み込み中の場合は、DOMContentLoaded イベントを待つ
                document.addEventListener('DOMContentLoaded', initialize);
            }
        }

        // 確定ボタンのイベントリスナー
        document.getElementById('confirmDrawButton').addEventListener('click', () => {
            if (State.isEditMode && State.isDrawing) {
                if (State.currentTool === 'line' && State.tempLinePoints.length >= 2) {
                    const newLine = {
                        id: Date.now(),
                        name: '新しい線',
                        points: State.tempLinePoints.slice(),
                        description: '',
                        year: State.currentYear || 0, // 年次情報を追加
                    };
                    DataStore.addLine(newLine);
                    State.isDrawing = false;
                    State.tempLinePoints = [];
                    renderData();
                    UI.showLineEditForm(newLine, DataStore, renderData, State);
                } else if (State.currentTool === 'polygon' && State.tempPolygonPoints.length >= 3) {
                    const newPolygon = {
                        id: Date.now(),
                        name: '新しい面',
                        points: State.tempPolygonPoints.slice(),
                        description: '',
                        year: State.currentYear || 0, // 年次情報を追加
                    };
                    DataStore.addPolygon(newPolygon);
                    State.isDrawing = false;
                    State.tempPolygonPoints = [];
                    renderData();
                    UI.showPolygonEditForm(newPolygon, DataStore, renderData, State);
                } else {
                    UI.showNotification('ポイントが足りません。', 'error');
                }
            }
        });

        // スライダーのイベントリスナーを追加
        const timeSlider = document.getElementById('timeSlider');
        const currentYearDisplay = document.getElementById('currentYear');

        timeSlider.addEventListener('input', () => {
            State.currentYear = parseInt(timeSlider.value, 10);
            currentYearDisplay.textContent = `年: ${State.currentYear}`;
            renderData();
        });

        // 保存・読み込みボタンのイベントリスナーや、IPC通信の設定
        document.getElementById('saveButton').addEventListener('click', () => {
            const dataToSave = {
                points: DataStore.getPoints(),
                lines: DataStore.getLines(),
                polygons: DataStore.getPolygons(),
            };
            ipcRenderer.send('save-data', dataToSave);
        });

        document.getElementById('loadButton').addEventListener('click', () => {
            if (DataStore.getPoints().length > 0 || DataStore.getLines().length > 0 || DataStore.getPolygons().length > 0) {
                // 既存のデータがある場合、メインプロセスに確認ダイアログを表示するようにリクエスト
                ipcRenderer.invoke('show-confirm-dialog', {
                    message: '既存のデータがあります。新しいデータを読み込む前に、既存のデータを消去しますか？'
                }).then((result) => {
                    if (result) {
                        // ユーザーが「はい」を選択した場合のみ、ファイル選択ダイアログを表示
                        ipcRenderer.send('load-data');
                    }
                }).catch((error) => {
                    console.error('確認ダイアログの表示中にエラーが発生しました:', error);
                });
            } else {
                // 既存のデータがない場合は、直接ファイル選択ダイアログを表示
                ipcRenderer.send('load-data');
            }
        });

        // メインプロセスからのデータ受信
        ipcRenderer.on('load-data-reply', (event, data) => {
            if (data) {
                DataStore.getPoints().length = 0;
                DataStore.getPoints().push(...(data.points || []));
                DataStore.getLines().length = 0;
                DataStore.getLines().push(...(data.lines || []));
                DataStore.getPolygons().length = 0;
                DataStore.getPolygons().push(...(data.polygons || []));
                renderData();
            } else {
                UI.showNotification('データの読み込み中にエラーが発生しました。', 'error');
            }
        });

        ipcRenderer.on('save-data-reply', (event, success) => {
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

module.exports = EventHandlers;
