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

    function showTooltip(event, d) {
        tooltip.style('display', 'block')
            .html(`名前: ${d.name}`);
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

    function showEditForm(point, DataStore, renderData) {
        const form = document.getElementById('editForm');
        form.style.display = 'block';
        document.getElementById('pointName').value = point.name;
        document.getElementById('pointDescription').value = point.description;

        makeDraggable(form);

        document.getElementById('savePointButton').onclick = () => {
            point.name = document.getElementById('pointName').value;
            point.description = document.getElementById('pointDescription').value;
            DataStore.updatePoint(point);
            renderData();
            form.style.display = 'none';
        };

        document.getElementById('cancelEditButton').onclick = () => {
            form.style.display = 'none';
        };

        document.getElementById('deletePointButton').onclick = () => {
            DataStore.removePoint(point.id);
            renderData();
            form.style.display = 'none';
        };
    }

    function showLineEditForm(line, DataStore, renderData) {
        const form = document.getElementById('lineEditForm');
        form.style.display = 'block';
        document.getElementById('lineName').value = line.name;
        document.getElementById('lineDescription').value = line.description;

        makeDraggable(form);

        document.getElementById('saveLineButton').onclick = () => {
            line.name = document.getElementById('lineName').value;
            line.description = document.getElementById('lineDescription').value;
            DataStore.updateLine(line);
            renderData();
            form.style.display = 'none';
        };

        document.getElementById('cancelLineEditButton').onclick = () => {
            form.style.display = 'none';
        };

        document.getElementById('deleteLineButton').onclick = () => {
            DataStore.removeLine(line.id);
            renderData();
            form.style.display = 'none';
        };
    }

    function showPolygonEditForm(polygon, DataStore, renderData) {
        const form = document.getElementById('polygonEditForm');
        form.style.display = 'block';
        document.getElementById('polygonName').value = polygon.name;
        document.getElementById('polygonDescription').value = polygon.description;

        makeDraggable(form);

        document.getElementById('savePolygonButton').onclick = () => {
            polygon.name = document.getElementById('polygonName').value;
            polygon.description = document.getElementById('polygonDescription').value;
            DataStore.updatePolygon(polygon);
            renderData();
            form.style.display = 'none';
        };

        document.getElementById('cancelPolygonEditButton').onclick = () => {
            form.style.display = 'none';
        };

        document.getElementById('deletePolygonButton').onclick = () => {
            DataStore.removePolygon(polygon.id);
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
    };
})();

module.exports = UI;
