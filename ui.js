// ui.js

const UI = (() => {
    const tooltip = d3.select('#tooltip');

    function updateUI(State) {
        document.getElementById('editModeButton').textContent =
            `編集モード: ${State.isEditMode ? 'ON' : 'OFF'}`;

        document.getElementById('editModeButton').classList.toggle('active', State.isEditMode);
        document.getElementById('tools').style.display = State.isEditMode ? 'block' : 'none';

        const buttons = document.querySelectorAll('#tools button');
        buttons.forEach(button => {
            button.classList.toggle('active', button.id === `${State.currentTool}Tool`);
        });

        // 確定ボタンの表示/非表示
        console.log(State.isEditMode);
        console.log(State.isDrawing);
        document.getElementById('drawControls').style.display = (State.isEditMode && State.isDrawing) ? 'block' : 'none';

        if (!State.isEditMode) {
            hideAllForms();
        }
    }

    function showTooltip(event, d, State) {
        tooltip.style('display', 'block')
            .html(`名前: ${d.name}<br>年: ${State.currentYear}`);
    }

    function moveTooltip(event) {
        tooltip.style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY + 10) + 'px');
    }

    function hideTooltip() {
        tooltip.style('display', 'none');
    }

    function showDetailWindow(data) {
        const detailWindow = document.getElementById('detailWindow');
        document.getElementById('detailName').textContent = data.name;
        document.getElementById('detailDescription').textContent = data.description || '説明がありません。';
        detailWindow.style.display = 'block';

        makeDraggable(detailWindow);

        document.getElementById('closeDetailButton').addEventListener('click', () => {
            detailWindow.style.display = 'none';
        });
    }

    function makeDraggable(element) {
        let isDragging = false;
        let startX, startY, offsetX, offsetY;

        element.addEventListener('mousedown', (e) => {
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
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                element.style.left = (e.clientX - offsetX) + 'px';
                element.style.top = (e.clientY - offsetY) + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.classList.remove('dragging');
            }
        });
    }

    function showEditForm(point, DataStore, renderData, State) {
        const form = document.getElementById('editForm');
        form.style.display = 'block';
        makeDraggable(form);

        const currentYear = State.currentYear || 0;

        if (!point) {
            // 新規ポイントの場合、デフォルト値を設定
            document.getElementById('pointName').value = '新しいポイント';
            document.getElementById('pointDescription').value = '';
            document.getElementById('pointYear').value = currentYear;
        } else {
            // 既存ポイントの場合、現在の年に対応するプロパティを取得
            const properties = getPropertiesForYear(point.properties, currentYear);

            document.getElementById('pointName').value = properties.name || '';
            document.getElementById('pointDescription').value = properties.description || '';
            document.getElementById('pointYear').value = currentYear;
        }

        document.getElementById('savePointButton').onclick = () => {
            const name = document.getElementById('pointName').value;
            const description = document.getElementById('pointDescription').value;
            const year = parseInt(document.getElementById('pointYear').value, 10);

            if (!point) {
                // 新規ポイントの追加
                const newPoint = {
                    id: Date.now(),
                    x: State.tempPoint.x,
                    y: State.tempPoint.y,
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
                // 既存ポイントの更新
                if (!point.properties) {
                    point.properties = [];
                }

                point.properties.push({
                    year: year,
                    name: name,
                    description: description,
                });
                DataStore.updatePoint(point);
            }

            // 描画モードを終了し、仮のポイントをクリア
            State.isDrawing = false;
            State.tempPoint = null;
            renderData();
            form.style.display = 'none';
        };

        document.getElementById('cancelEditButton').onclick = () => {
            form.style.display = 'none';
            // 描画をキャンセル
            State.isDrawing = false;
            State.tempPoint = null;
            renderData();
        };

        document.getElementById('deletePointButton').onclick = () => {
            if (point) {
                DataStore.removePoint(point.id);
            }
            State.isDrawing = false;
            State.tempPoint = null;
            renderData();
            form.style.display = 'none';
        };
    }

    // ヘルパー関数を追加
    function getPropertiesForYear(propertiesArray, year) {
        if (!propertiesArray || propertiesArray.length === 0) return {};
        const sortedProperties = propertiesArray.slice().sort((a, b) => a.year - b.year);
        let currentProperties = {};
        for (const prop of sortedProperties) {
            if (prop.year <= year) {
                currentProperties = prop;
            } else {
                break;
            }
        }
        return currentProperties;
    }

    function showLineEditForm(line, DataStore, renderData, State, isNewLine = false) {
        const form = document.getElementById('lineEditForm');
        form.style.display = 'block';
        document.getElementById('lineName').value = line.name || '';
        document.getElementById('lineDescription').value = line.description || '';
        document.getElementById('lineYear').value = State.currentYear || 0;

        makeDraggable(form);

        document.getElementById('saveLineButton').onclick = () => {
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
            State.isDrawing = false;
            State.tempLinePoints = [];
            State.tempPoint = null; // 仮のポイントをクリア
            renderData();
            form.style.display = 'none';
        };

        document.getElementById('cancelLineEditButton').onclick = () => {
            form.style.display = 'none';
            // 描画をキャンセル
            State.isDrawing = false;
            State.tempLinePoints = [];
            State.tempPoint = null; // 仮のポイントをクリア
            // 追加した線を削除（新規の場合のみ）
            if (isNewLine) {
                DataStore.removeLine(line.id);
            }
            renderData();
        };

        document.getElementById('deleteLineButton').onclick = () => {
            DataStore.removeLine(line.id);
            State.isDrawing = false;
            State.tempLinePoints = [];
            renderData();
            form.style.display = 'none';
        };
    }

    function showPolygonEditForm(polygon, DataStore, renderData, State, isNewPolygon = false) {
        const form = document.getElementById('polygonEditForm');
        form.style.display = 'block';
        document.getElementById('polygonName').value = polygon.name || '';
        document.getElementById('polygonDescription').value = polygon.description || '';
        document.getElementById('polygonYear').value = State.currentYear || 0;

        makeDraggable(form);

        document.getElementById('savePolygonButton').onclick = () => {
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
            State.isDrawing = false;
            State.tempPolygonPoints = [];
            State.tempPoint = null; // 仮のポイントをクリア
            renderData();
            form.style.display = 'none';
        };

        document.getElementById('cancelPolygonEditButton').onclick = () => {
            form.style.display = 'none';
            // 描画をキャンセル
            State.isDrawing = false;
            State.tempPolygonPoints = [];
            State.tempPoint = null; // 仮のポイントをクリア
            // 追加した面を削除（新規の場合のみ）
            if (isNewPolygon) {
                DataStore.removePolygon(polygon.id);
            }
            renderData();
        };

        document.getElementById('deletePolygonButton').onclick = () => {
            DataStore.removePolygon(polygon.id);
            State.isDrawing = false;
            State.tempPolygonPoints = [];
            renderData();
            form.style.display = 'none';
        };
    }

    function hideAllForms() {
        document.getElementById('editForm').style.display = 'none';
        document.getElementById('lineEditForm').style.display = 'none';
        document.getElementById('polygonEditForm').style.display = 'none';
        document.getElementById('detailWindow').style.display = 'none';
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    function updateEventList(DataStore, State) {
        const eventList = document.getElementById('eventList');
        eventList.innerHTML = ''; // 既存のリストをクリア

        const currentYear = State.currentYear || 0;

        // 全エンティティを取得
        const points = DataStore.getPoints(currentYear);
        const lines = DataStore.getLines(currentYear);
        const polygons = DataStore.getPolygons(currentYear);

        // イベントを一つの配列に統合
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

        // 年次でソート
        events.sort((a, b) => a.data.year - b.data.year);

        // リストアイテムを作成
        events.forEach(event => {
            const li = document.createElement('li');
            li.textContent = `${event.data.year}: ${event.data.name} (${event.type})`;
            li.addEventListener('click', () => {
                // イベントをクリックしたときの動作
                showDetailWindow(event.data);
            });
            eventList.appendChild(li);
        });
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
    };
})();

module.exports = UI;
