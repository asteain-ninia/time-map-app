// ui.js

import { getPropertiesForYear } from './utils.js';
import stateManager from './stateManager.js';

const UI = (() => {
    const tooltip = d3.select('#tooltip');

    function updateUI() {
        try {
            const state = stateManager.getState();

            if (state.debugMode) {
                console.info('updateUI() が呼び出されました。');
            }

            document.getElementById('editModeButton').textContent =
                `編集モード: ${state.isEditMode ? 'ON' : 'OFF'}`;

            document.getElementById('editModeButton').classList.toggle('active', state.isEditMode);
            document.getElementById('tools').style.display = state.isEditMode ? 'block' : 'none';

            const buttons = document.querySelectorAll('#tools button');
            buttons.forEach(button => {
                button.classList.toggle('active', button.id === `${state.currentTool}Tool`);
            });

            // 確定ボタンの表示/非表示
            let showConfirmButton = false;
            if (state.isEditMode && state.isDrawing) {
                if (state.currentTool === 'line' && state.tempLinePoints.length >= 2) {
                    showConfirmButton = true;
                } else if (state.currentTool === 'polygon' && state.tempPolygonPoints.length >= 3) {
                    showConfirmButton = true;
                }
            }

            document.getElementById('drawControls').style.display = showConfirmButton ? 'block' : 'none';

            if (!state.isEditMode) {
                hideAllForms();
            }

            updateSlider();
            updateWorldInfo();
        } catch (error) {
            console.error('updateUI 関数内でエラーが発生しました:', error);
            showNotification('UIの更新中にエラーが発生しました。', 'error');
        }
    }

    function showTooltip(event, d) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('showTooltip() が呼び出されました。');
            }

            tooltip.style('display', 'block')
                .html(`名前: ${d.name}<br>年: ${d.year !== undefined ? d.year : '不明'}`);
        } catch (error) {
            console.error('showTooltip 関数内でエラーが発生しました:', error);
        }
    }

    function moveTooltip(event) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('moveTooltip() が呼び出されました。');
            }

            tooltip.style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY + 10) + 'px');
        } catch (error) {
            console.error('moveTooltip 関数内でエラーが発生しました:', error);
        }
    }

    function hideTooltip() {
        try {
            if (stateManager.getState().debugMode) {
                console.info('hideTooltip() が呼び出されました。');
            }

            tooltip.style('display', 'none');
        } catch (error) {
            console.error('hideTooltip 関数内でエラーが発生しました:', error);
        }
    }

    function showDetailWindow(data) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('showDetailWindow() が呼び出されました。');
            }

            const detailWindow = document.getElementById('detailWindow');
            document.getElementById('detailName').textContent = data.name;
            document.getElementById('detailDescription').textContent = data.description || '説明がありません。';
            detailWindow.style.display = 'block';

            makeDraggable(detailWindow);

            document.getElementById('closeDetailButton').addEventListener('click', () => {
                detailWindow.style.display = 'none';
            });
        } catch (error) {
            console.error('showDetailWindow 関数内でエラーが発生しました:', error);
        }
    }

    function makeDraggable(element) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('makeDraggable() が呼び出されました。');
            }

            let isDragging = false;
            let startX, startY, offsetX, offsetY;

            element.addEventListener('mousedown', (e) => {
                try {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' ||
                        e.target.tagName === 'TEXTAREA' || e.target.tagName === 'LABEL') {
                        return;
                    }
                    isDragging = true;
                    element.classList.add('dragging');
                    startX = e.clientX;
                    startY = e.clientY;
                    const rect = element.getBoundingClientRect();
                    offsetX = startX - rect.left;
                    offsetY = startY - rect.top;
                    e.preventDefault();
                } catch (error) {
                    console.error('makeDraggable の mousedown イベントでエラーが発生しました:', error);
                }
            });

            document.addEventListener('mousemove', (e) => {
                try {
                    if (isDragging) {
                        element.style.left = (e.clientX - offsetX) + 'px';
                        element.style.top = (e.clientY - offsetY) + 'px';
                    }
                } catch (error) {
                    console.error('makeDraggable の mousemove イベントでエラーが発生しました:', error);
                }
            });

            document.addEventListener('mouseup', () => {
                try {
                    if (isDragging) {
                        isDragging = false;
                        element.classList.remove('dragging');
                    }
                } catch (error) {
                    console.error('makeDraggable の mouseup イベントでエラーが発生しました:', error);
                }
            });
        } catch (error) {
            console.error('makeDraggable 関数内でエラーが発生しました:', error);
        }
    }

    function showEditForm(point, DataStore, renderData) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('showEditForm() が呼び出されました。');
            }

            const form = document.getElementById('editForm');
            form.style.display = 'block';
            makeDraggable(form);

            const state = stateManager.getState();
            const currentYear = state.currentYear || 0;

            if (!point) {
                document.getElementById('pointName').value = '新しいポイント';
                document.getElementById('pointDescription').value = '';
                document.getElementById('pointYear').value = currentYear;
            } else {
                const properties = getPropertiesForYear(point.properties, currentYear);

                document.getElementById('pointName').value = properties.name || '';
                document.getElementById('pointDescription').value = properties.description || '';
                document.getElementById('pointYear').value = properties.year !== undefined ? properties.year : '';
            }

            document.getElementById('savePointButton').onclick = () => {
                try {
                    const name = document.getElementById('pointName').value;
                    const description = document.getElementById('pointDescription').value;
                    const yearInputValue = document.getElementById('pointYear').value;
                    const year = yearInputValue !== '' ? parseInt(yearInputValue, 10) : undefined;

                    if (year === undefined || isNaN(year)) {
                        showNotification('年を正しく入力してください。', 'error');
                        return;
                    }

                    if (!point) {
                        const newPoint = {
                            id: Date.now(),
                            x: state.tempPoint.x,
                            y: state.tempPoint.y,
                            properties: [
                                {
                                    year: year,
                                    name: name || '新しいポイント',
                                    description: description || '',
                                }
                            ],
                        };
                        DataStore.addPoint(newPoint);
                    } else {
                        if (!point.properties || !Array.isArray(point.properties)) {
                            point.properties = [];
                        }

                        point.properties.push({
                            year: year,
                            name: name,
                            description: description,
                        });
                        DataStore.updatePoint(point);
                    }

                    stateManager.setState({
                        isDrawing: false,
                        tempPoint: null,
                    });
                    renderData();
                    form.style.display = 'none';
                } catch (error) {
                    console.error('savePointButton のクリックイベントでエラーが発生しました:', error);
                    showNotification('ポイントの保存中にエラーが発生しました。', 'error');
                }
            };

            document.getElementById('cancelEditButton').onclick = () => {
                try {
                    form.style.display = 'none';
                    stateManager.setState({
                        isDrawing: false,
                        tempPoint: null,
                    });
                    renderData();
                } catch (error) {
                    console.error('cancelEditButton のクリックイベントでエラーが発生しました:', error);
                }
            };

            document.getElementById('deletePointButton').onclick = () => {
                try {
                    if (point) {
                        DataStore.removePoint(point.id);
                    }
                    stateManager.setState({
                        isDrawing: false,
                        tempPoint: null,
                    });
                    renderData();
                    form.style.display = 'none';
                } catch (error) {
                    console.error('deletePointButton のクリックイベントでエラーが発生しました:', error);
                    showNotification('ポイントの削除中にエラーが発生しました。', 'error');
                }
            };
        } catch (error) {
            console.error('showEditForm 関数内でエラーが発生しました:', error);
        }
    }

    function showLineEditForm(line, DataStore, renderData, isNewLine = false) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('showLineEditForm() が呼び出されました。');
            }

            const form = document.getElementById('lineEditForm');
            form.style.display = 'block';

            const state = stateManager.getState();
            const currentYear = state.currentYear || 0;

            if (!line.properties || line.properties.length === 0) {
                document.getElementById('lineName').value = line.name || '';
                document.getElementById('lineDescription').value = line.description || '';
                document.getElementById('lineYear').value = currentYear;
            } else {
                const properties = getPropertiesForYear(line.properties, currentYear);
                document.getElementById('lineName').value = properties.name || '';
                document.getElementById('lineDescription').value = properties.description || '';
                document.getElementById('lineYear').value = properties.year !== undefined ? properties.year : '';
            }

            makeDraggable(form);

            document.getElementById('saveLineButton').onclick = () => {
                try {
                    const name = document.getElementById('lineName').value;
                    const description = document.getElementById('lineDescription').value;
                    const year = parseInt(document.getElementById('lineYear').value, 10);

                    if (!line.properties) {
                        line.properties = [];
                    }

                    line.properties.push({
                        year: year,
                        name: name,
                        description: description,
                    });

                    DataStore.updateLine(line);
                    stateManager.setState({
                        isDrawing: false,
                        tempLinePoints: [],
                        tempPoint: null,
                    });
                    renderData();
                    form.style.display = 'none';
                } catch (error) {
                    console.error('saveLineButton のクリックイベントでエラーが発生しました:', error);
                    showNotification('ラインの保存中にエラーが発生しました。', 'error');
                }
            };

            document.getElementById('cancelLineEditButton').onclick = () => {
                try {
                    form.style.display = 'none';
                    stateManager.setState({
                        isDrawing: false,
                        tempLinePoints: [],
                        tempPoint: null,
                    });
                    if (isNewLine) {
                        DataStore.removeLine(line.id);
                    }
                    renderData();
                } catch (error) {
                    console.error('cancelLineEditButton のクリックイベントでエラーが発生しました:', error);
                }
            };

            document.getElementById('deleteLineButton').onclick = () => {
                try {
                    DataStore.removeLine(line.id);
                    stateManager.setState({
                        isDrawing: false,
                        tempLinePoints: [],
                    });
                    renderData();
                    form.style.display = 'none';
                } catch (error) {
                    console.error('deleteLineButton のクリックイベントでエラーが発生しました:', error);
                    showNotification('ラインの削除中にエラーが発生しました。', 'error');
                }
            };
        } catch (error) {
            console.error('showLineEditForm 関数内でエラーが発生しました:', error);
        }
    }

    function showPolygonEditForm(polygon, DataStore, renderData, isNewPolygon = false) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('showPolygonEditForm() が呼び出されました。');
            }

            const form = document.getElementById('polygonEditForm');
            form.style.display = 'block';

            const state = stateManager.getState();
            const currentYear = state.currentYear || 0;

            if (!polygon.properties || polygon.properties.length === 0) {
                document.getElementById('polygonName').value = polygon.name || '';
                document.getElementById('polygonDescription').value = polygon.description || '';
                document.getElementById('polygonYear').value = currentYear;
            } else {
                const properties = getPropertiesForYear(polygon.properties, currentYear);
                document.getElementById('polygonName').value = properties.name || '';
                document.getElementById('polygonDescription').value = properties.description || '';
                document.getElementById('polygonYear').value = properties.year !== undefined ? properties.year : '';
            }

            makeDraggable(form);

            document.getElementById('savePolygonButton').onclick = () => {
                try {
                    const name = document.getElementById('polygonName').value;
                    const description = document.getElementById('polygonDescription').value;
                    const year = parseInt(document.getElementById('polygonYear').value, 10);

                    if (!polygon.properties) {
                        polygon.properties = [];
                    }

                    polygon.properties.push({
                        year: year,
                        name: name,
                        description: description,
                    });

                    DataStore.updatePolygon(polygon);
                    stateManager.setState({
                        isDrawing: false,
                        tempPolygonPoints: [],
                        tempPoint: null,
                    });
                    renderData();
                    form.style.display = 'none';
                } catch (error) {
                    console.error('savePolygonButton のクリックイベントでエラーが発生しました:', error);
                    showNotification('ポリゴンの保存中にエラーが発生しました。', 'error');
                }
            };

            document.getElementById('cancelPolygonEditButton').onclick = () => {
                try {
                    form.style.display = 'none';
                    stateManager.setState({
                        isDrawing: false,
                        tempPolygonPoints: [],
                        tempPoint: null,
                    });
                    if (isNewPolygon) {
                        DataStore.removePolygon(polygon.id);
                    }
                    renderData();
                } catch (error) {
                    console.error('cancelPolygonEditButton のクリックイベントでエラーが発生しました:', error);
                }
            };

            document.getElementById('deletePolygonButton').onclick = () => {
                try {
                    DataStore.removePolygon(polygon.id);
                    stateManager.setState({
                        isDrawing: false,
                        tempPolygonPoints: [],
                    });
                    renderData();
                    form.style.display = 'none';
                } catch (error) {
                    console.error('deletePolygonButton のクリックイベントでエラーが発生しました:', error);
                    showNotification('ポリゴンの削除中にエラーが発生しました。', 'error');
                }
            };
        } catch (error) {
            console.error('showPolygonEditForm 関数内でエラーが発生しました:', error);
        }
    }

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

    function showNotification(message, type = 'info') {
        try {
            if (stateManager.getState().debugMode) {
                console.info('showNotification() が呼び出されました。メッセージ:', message);
            }

            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.remove();
            }, 5000);

            if (type === 'error') {
                console.error('エラー:', message);
            }
        } catch (error) {
            console.error('showNotification 関数内でエラーが発生しました:', error);
        }
    }

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

    // スライダーの最小・最大値を更新する関数
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

    // 世界の名前と概要を更新する関数
    function updateWorldInfo() {
        try {
            const state = stateManager.getState();

            document.getElementById('worldNameDisplay').textContent = state.worldName || '無名の世界';
            document.getElementById('worldDescriptionDisplay').textContent = state.worldDescription || '説明がありません。';
        } catch (error) {
            console.error('updateWorldInfo 関数内でエラーが発生しました:', error);
        }
    }

    // 設定ウィンドウのフィールドを現在の状態で更新する関数
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

    return {
        updateUI,
        showTooltip,
        moveTooltip,
        hideTooltip,
        showDetailWindow,
        showEditForm,
        showLineEditForm,
        showPolygonEditForm,
        showNotification,
        hideAllForms,
        updateEventList,
        updateSlider,
        updateWorldInfo,
        populateSettings
    };
})();

export default UI;
