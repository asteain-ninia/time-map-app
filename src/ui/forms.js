// src/ui/forms.js

import { getPropertiesForYear } from '../utils/index.js';
import stateManager from '../state/index.js';
import DataStore from '../dataStore/index.js';

import uiManager from './uiManager.js';
import { debugLog } from '../utils/logger.js';
// import { showNotification } from './forms.js'; 
// ↑ 同じファイル内でexportしているshowNotificationを再importしており、エラーの原因。
//    循環参照による不具合や、「すでに定義されている」といったエラーが出るので削除する。

/**
 * ポイント編集フォームを表示
 * @param {Object|null} point - 既存ポイントまたはnull（新規）
 * @param {Function} renderData - 再描画関数
 * @param {Number} [x] - クリック座標(pageX)
 * @param {Number} [y] - クリック座標(pageY)
 */
export function showEditForm(point, renderData, x, y) {
    debugLog(4, 'showEditForm() が呼び出されました。');
    try {
        if (stateManager.getState().debugMode) {
            console.info('showEditForm() が呼び出されました。');
        }

        // 他フォームを全部閉じる（ポイント、ライン、ポリゴンのフォームなど）
        uiManager.hideAllForms();

        const form = document.getElementById('editForm');
        form.style.display = 'block';
        form.style.position = 'absolute';

        // クリック座標が渡された場合はそこに表示
        if (typeof x === 'number' && typeof y === 'number') {
            form.style.left = (x + 10) + 'px';
            form.style.top = (y + 10) + 'px';
        } else {
            form.style.left = '200px';
            form.style.top = '150px';
        }

        makeDraggable(form);

        const state = stateManager.getState();
        const currentYear = state.currentYear || 0;

        if (!point) {
            // 新規作成
            document.getElementById('pointName').value = '新しいポイント';
            document.getElementById('pointDescription').value = '';
            document.getElementById('pointYear').value = currentYear;
        } else {
            // 既存ポイントの編集
            const properties = getPropertiesForYear(point.properties, currentYear) || {
                name: point.name || '',
                description: point.description || '',
                year: point.year !== undefined ? point.year : currentYear
            };

            document.getElementById('pointName').value = properties.name || '';
            document.getElementById('pointDescription').value = properties.description || '';
            document.getElementById('pointYear').value = properties.year !== undefined ? properties.year : '';
        }

        // 保存ボタン
        document.getElementById('savePointButton').onclick = () => {
            debugLog(4, 'savePointButton クリックイベントが発生しました。');
            try {
                const name = document.getElementById('pointName').value;
                const description = document.getElementById('pointDescription').value;
                const yearInputValue = document.getElementById('pointYear').value;
                const year = yearInputValue !== '' ? parseInt(yearInputValue, 10) : 0; // 入力が空なら0に

                if (isNaN(year)) {
                    showNotification('年を正しく入力してください。', 'error');
                    return;
                }

                if (!point) {
                    // 新規ポイントの場合
                    const st = stateManager.getState();
                    if (!st.tempPoint) {
                        showNotification('tempPoint が存在しません。', 'error');
                        return;
                    }
                    const newPoint = {
                        id: Date.now(),
                        x: st.tempPoint.x,
                        y: st.tempPoint.y,
                        properties: [
                            {
                                year: year,
                                name: name || '新しいポイント',
                                description: description || '',
                            }
                        ],
                    };
                    // Undo対応
                    DataStore.addPoint(newPoint, true);

                    stateManager.setState({
                        selectedFeature: newPoint,
                        isDrawing: false,
                        tempPoint: null,
                    });
                } else {
                    // 既存ポイントを更新
                    if (!point.properties) {
                        point.properties = [];
                    }
                    point.properties.push({
                        year: year,
                        name: name,
                        description: description,
                    });

                    // Undo対応
                    DataStore.updatePoint(point, true);

                    stateManager.setState({
                        selectedFeature: point,
                        isDrawing: false,
                        tempPoint: null,
                    });
                }

                // 再描画とフォーム閉じる
                renderData();
                form.style.display = 'none';
            } catch (error) {
                debugLog(1, `savePointButton のクリック時にエラー: ${error}`);
                showNotification('ポイントの保存中にエラーが発生しました。', 'error');
            }
        };

        // キャンセルボタン
        document.getElementById('cancelEditButton').onclick = () => {
            debugLog(4, 'cancelEditButton クリックイベントが発生しました。');
            try {
                form.style.display = 'none';
                stateManager.setState({ isDrawing: false, tempPoint: null });
                renderData();
            } catch (error) {
                debugLog(1, `cancelEditButton のクリック時にエラー: ${error}`);
            }
        };

        // 削除ボタン
        document.getElementById('deletePointButton').onclick = () => {
            debugLog(4, 'deletePointButton クリックイベントが発生しました。');
            try {
                if (point) {
                    // Undo対応
                    DataStore.removePoint(point.id, true);
                }
                stateManager.setState({ isDrawing: false, tempPoint: null });
                renderData();
                form.style.display = 'none';
            } catch (error) {
                debugLog(1, `deletePointButton のクリック時にエラー: ${error}`);
                showNotification('ポイントの削除中にエラーが発生しました。', 'error');
            }
        };

    } catch (error) {
        debugLog(1, `showEditForm() でエラー発生: ${error}`);
    }
}

/**
 * ライン編集フォームを表示
 * @param {Object} line - ラインオブジェクト
 * @param {Function} renderData - 再描画関数
 * @param {Boolean} isNewLine - 新規ライン作成かどうか
 * @param {Boolean} showDeleteButton - 削除ボタンを表示するか
 * @param {Number} [x] - クリック座標(pageX)
 * @param {Number} [y] - クリック座標(pageY)
 */
export function showLineEditForm(line, renderData, isNewLine = false, showDeleteButton = false, x, y) {
    debugLog(4, 'showLineEditForm() が呼び出されました。');
    try {
        if (stateManager.getState().debugMode) {
            console.info('showLineEditForm() が呼び出されました。');
        }

        uiManager.hideAllForms();

        const form = document.getElementById('lineEditForm');
        form.style.display = 'block';
        form.style.position = 'absolute';

        if (typeof x === 'number' && typeof y === 'number') {
            form.style.left = (x + 10) + 'px';
            form.style.top = (y + 10) + 'px';
        } else {
            form.style.left = '220px';
            form.style.top = '180px';
        }

        makeDraggable(form);

        const state = stateManager.getState();
        const currentYear = state.currentYear || 0;

        if (!line.properties || line.properties.length === 0) {
            document.getElementById('lineName').value = line.name || '';
            document.getElementById('lineDescription').value = line.description || '';
            document.getElementById('lineYear').value = currentYear;
        } else {
            const properties = getPropertiesForYear(line.properties, currentYear) || {
                name: line.name || '',
                description: line.description || '',
                year: line.year !== undefined ? line.year : currentYear
            };
            document.getElementById('lineName').value = properties.name || '';
            document.getElementById('lineDescription').value = properties.description || '';
            document.getElementById('lineYear').value = properties.year !== undefined ? properties.year : '';
        }

        // 保存ボタン
        document.getElementById('saveLineButton').onclick = () => {
            debugLog(4, 'saveLineButton クリックイベントが発生しました。');
            try {
                const name = document.getElementById('lineName').value;
                const description = document.getElementById('lineDescription').value;
                const yearValue = document.getElementById('lineYear').value;
                const year = parseInt(yearValue, 10);

                if (isNaN(year)) {
                    showNotification('年を正しく入力してください。', 'error');
                    return;
                }

                if (!line.properties) {
                    line.properties = [];
                }
                line.properties.push({
                    year: year,
                    name: name,
                    description: description,
                });

                // UpdateLineはUndo可能に
                DataStore.updateLine(line, true);

                stateManager.setState({
                    isDrawing: false,
                    tempLinePoints: [],
                    tempPoint: null,
                    selectedFeature: line
                });
                renderData();
                form.style.display = 'none';
            } catch (error) {
                debugLog(1, `saveLineButton のクリック時にエラー: ${error}`);
                showNotification('ラインの保存中にエラーが発生しました。', 'error');
            }
        };

        // キャンセルボタン
        document.getElementById('cancelLineEditButton').onclick = () => {
            debugLog(4, 'cancelLineEditButton クリックイベントが発生しました。');
            try {
                form.style.display = 'none';
                stateManager.setState({
                    isDrawing: false,
                    tempLinePoints: [],
                    tempPoint: null,
                });
                if (isNewLine) {
                    // 新規作成直後にキャンセル -> 追加済みラインを取り消す
                    DataStore.removeLine(line.id, true);
                }
                renderData();
            } catch (error) {
                debugLog(1, `cancelLineEditButton のクリック時にエラー: ${error}`);
            }
        };

        const deleteButton = document.getElementById('deleteLineButton');
        deleteButton.style.display = showDeleteButton ? 'inline-block' : 'none';
        deleteButton.onclick = () => {
            debugLog(4, 'deleteLineButton クリックイベントが発生しました。');
            try {
                // Undo可能に
                DataStore.removeLine(line.id, true);
                stateManager.setState({
                    isDrawing: false,
                    tempLinePoints: [],
                    selectedFeature: null
                });
                renderData();
                form.style.display = 'none';
            } catch (error) {
                debugLog(1, `deleteLineButton のクリック時にエラー: ${error}`);
                showNotification('ラインの削除中にエラーが発生しました。', 'error');
            }
        };

    } catch (error) {
        debugLog(1, `showLineEditForm() でエラー発生: ${error}`);
    }
}

/**
 * ポリゴン編集フォームを表示
 * @param {Object} polygon - ポリゴンオブジェクト
 * @param {Function} renderData - 再描画関数
 * @param {Boolean} isNewPolygon - 新規作成かどうか
 * @param {Boolean} showDeleteButton - 削除ボタンを表示するか
 * @param {Number} [x] - クリック座標(pageX)
 * @param {Number} [y] - クリック座標(pageY)
 */
export function showPolygonEditForm(polygon, renderData, isNewPolygon = false, showDeleteButton = false, x, y) {
    debugLog(4, 'showPolygonEditForm() が呼び出されました。');
    try {
        if (stateManager.getState().debugMode) {
            console.info('showPolygonEditForm() が呼び出されました。');
        }

        uiManager.hideAllForms();

        const form = document.getElementById('polygonEditForm');
        form.style.display = 'block';
        form.style.position = 'absolute';

        if (typeof x === 'number' && typeof y === 'number') {
            form.style.left = (x + 10) + 'px';
            form.style.top = (y + 10) + 'px';
        } else {
            form.style.left = '250px';
            form.style.top = '200px';
        }

        makeDraggable(form);

        const state = stateManager.getState();
        const currentYear = state.currentYear || 0;

        // 既存プロパティが無い場合は初期入力
        if (!polygon.properties || polygon.properties.length === 0) {
            document.getElementById('polygonName').value = polygon.name || '';
            document.getElementById('polygonDescription').value = polygon.description || '';
            document.getElementById('polygonYear').value = currentYear;
        } else {
            const properties = getPropertiesForYear(polygon.properties, currentYear) || {
                name: polygon.name || '',
                description: polygon.description || '',
                year: polygon.year !== undefined ? polygon.year : currentYear
            };
            document.getElementById('polygonName').value = properties.name || '';
            document.getElementById('polygonDescription').value = properties.description || '';
            document.getElementById('polygonYear').value = properties.year !== undefined ? properties.year : '';
        }

        // 保存ボタン
        document.getElementById('savePolygonButton').onclick = () => {
            debugLog(4, 'savePolygonButton クリックイベントが発生しました。');
            try {
                const name = document.getElementById('polygonName').value;
                const description = document.getElementById('polygonDescription').value;
                const yearValue = document.getElementById('polygonYear').value;
                const year = parseInt(yearValue, 10);

                if (isNaN(year)) {
                    showNotification('年を正しく入力してください。', 'error');
                    return;
                }

                if (!polygon.properties) {
                    polygon.properties = [];
                }
                polygon.properties.push({
                    year: year,
                    name: name,
                    description: description,
                });

                DataStore.updatePolygon(polygon, true);

                stateManager.setState({
                    isDrawing: false,
                    tempPolygonPoints: [],
                    tempPoint: null,
                    selectedFeature: polygon
                });
                renderData();
                form.style.display = 'none';
            } catch (error) {
                debugLog(1, `savePolygonButton のクリック時にエラー: ${error}`);
                showNotification('ポリゴンの保存中にエラーが発生しました。', 'error');
            }
        };

        // キャンセルボタン
        document.getElementById('cancelPolygonEditButton').onclick = () => {
            debugLog(4, 'cancelPolygonEditButton クリックイベントが発生しました。');
            try {
                form.style.display = 'none';
                stateManager.setState({
                    isDrawing: false,
                    tempPolygonPoints: [],
                    tempPoint: null,
                });
                if (isNewPolygon) {
                    // 新規作成直後にキャンセル -> 追加済みポリゴンを取り消す
                    DataStore.removePolygon(polygon.id, true);
                }
                renderData();
            } catch (error) {
                debugLog(1, `cancelPolygonEditButton のクリック時にエラー: ${error}`);
            }
        };

        // 削除ボタン
        const deleteButton = document.getElementById('deletePolygonButton');
        deleteButton.style.display = showDeleteButton ? 'inline-block' : 'none';
        deleteButton.onclick = () => {
            debugLog(4, 'deletePolygonButton クリックイベントが発生しました。');
            try {
                // Undo対応
                DataStore.removePolygon(polygon.id, true);
                stateManager.setState({
                    isDrawing: false,
                    tempPolygonPoints: [],
                    selectedFeature: null
                });
                renderData();
                form.style.display = 'none';
            } catch (error) {
                debugLog(1, `deletePolygonButton のクリック時にエラー: ${error}`);
                showNotification('ポリゴンの削除中にエラーが発生しました。', 'error');
            }
        };

    } catch (error) {
        debugLog(1, `showPolygonEditForm() でエラー発生: ${error}`);
    }
}

/**
 * 詳細ウィンドウ（オブジェクトの簡易情報表示用）
 * @param {Object} data - フィーチャーデータ(名前や年など)
 * @param {Number} [x] - マウスクリック座標(pageX)
 * @param {Number} [y] - マウスクリック座標(pageY)
 */
export function showDetailWindow(data, x, y) {
    debugLog(4, 'showDetailWindow() が呼び出されました。');
    try {
        if (stateManager.getState().debugMode) {
            console.info('showDetailWindow() が呼び出されました。');
        }

        uiManager.hideAllForms();

        const detailWindow = document.getElementById('detailWindow');
        detailWindow.style.display = 'block';
        detailWindow.style.position = 'absolute';

        if (typeof x === 'number' && typeof y === 'number') {
            detailWindow.style.left = (x + 10) + 'px';
            detailWindow.style.top = (y + 10) + 'px';
        } else {
            detailWindow.style.left = '300px';
            detailWindow.style.top = '120px';
        }

        makeDraggable(detailWindow);

        document.getElementById('detailName').textContent = data.name;
        document.getElementById('detailDescription').textContent = data.description || '説明がありません。';

        document.getElementById('closeDetailButton').onclick = () => {
            debugLog(4, 'closeDetailButton クリックイベントが発生しました。');
            detailWindow.style.display = 'none';
        };
    } catch (error) {
        debugLog(1, `showDetailWindow() でエラー発生: ${error}`);
    }
}

/**
 * 簡易通知メッセージ
 * @param {string} message - 通知メッセージ
 * @param {string} [type='info'] - 通知タイプ(info, error, warningなど)
 */
export function showNotification(message, type = 'info') {
    debugLog(4, `showNotification() が呼び出されました。message=${message}, type=${type}`);
    try {
        if (stateManager.getState().debugMode) {
            console.info('showNotification() が呼び出されました:', message);
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);

        if (type === 'error') {
            debugLog(1, `エラー通知: ${message}`);
        }
    } catch (error) {
        debugLog(1, `showNotification() でエラー発生: ${error}`);
    }
}

/**
 * ダイアログやフォーム要素をドラッグ可能にする共通関数
 * @param {HTMLElement} element - ドラッグ対象のDOM要素
 */
function makeDraggable(element) {
    debugLog(4, 'makeDraggable() が呼び出されました。');
    try {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let offsetX = 0;
        let offsetY = 0;

        element.addEventListener('mousedown', (e) => {
            try {
                if (
                    e.target.tagName === 'INPUT' ||
                    e.target.tagName === 'BUTTON' ||
                    e.target.tagName === 'TEXTAREA' ||
                    e.target.tagName === 'LABEL'
                ) {
                    return;
                }

                isDragging = true;
                element.classList.add('dragging');

                startX = e.pageX;
                startY = e.pageY;

                const rect = element.getBoundingClientRect();
                offsetX = startX - rect.left;
                offsetY = startY - rect.top;

                e.preventDefault();
            } catch (error) {
                debugLog(1, `makeDraggable mousedown中にエラー発生: ${error}`);
            }
        });

        document.addEventListener('mousemove', (e) => {
            try {
                if (isDragging) {
                    const newLeft = e.pageX - offsetX;
                    const newTop = e.pageY - offsetY;

                    element.style.left = newLeft + 'px';
                    element.style.top = newTop + 'px';
                }
            } catch (error) {
                debugLog(1, `makeDraggable mousemove中にエラー発生: ${error}`);
            }
        });

        document.addEventListener('mouseup', () => {
            try {
                if (isDragging) {
                    isDragging = false;
                    element.classList.remove('dragging');
                }
            } catch (error) {
                debugLog(1, `makeDraggable mouseup中にエラー発生: ${error}`);
            }
        });
    } catch (error) {
        debugLog(1, `makeDraggable() でエラー発生: ${error}`);
    }
}
