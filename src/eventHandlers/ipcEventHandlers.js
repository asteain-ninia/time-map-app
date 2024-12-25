// src/eventHandlers/ipcEventHandlers.js

import stateManager from '../../stateManager.js';
import uiManager from '../ui/uiManager.js';
import DataStore from '../dataStore/index.js';

/**
 * IPC通信関連のイベントリスナーを設定する
 * (保存・読み込みのIPC、ダイアログ操作など)
 *
 * @param {Object} ipc - window.electronAPI
 * @param {Function} renderData - 再描画関数
 */
export function setupIPCEventListeners(ipc, renderData) {
    let state = stateManager.getState();
    stateManager.subscribe((newState) => {
        state = newState;
    });

    // 「保存」ボタン
    document.getElementById('saveButton').addEventListener('click', () => {
        try {
            const dataToSave = DataStore.getData();
            ipc.send('save-data', dataToSave);

            if (state.debugMode) {
                console.info('データの保存が開始されました。');
            }
        } catch (error) {
            console.error('saveButton のクリックイベントでエラー:', error);
            uiManager.showNotification('データの保存中にエラーが発生しました。', 'error');
        }
    });

    // 「読み込み」ボタン
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
                    console.error('確認ダイアログの表示中にエラー:', error);
                    uiManager.showNotification('データの読み込み中にエラーが発生しました。', 'error');
                });
            } else {
                ipc.send('load-data');
            }
        } catch (error) {
            console.error('loadButton のクリックイベントでエラー:', error);
            uiManager.showNotification('データの読み込み中にエラーが発生しました。', 'error');
        }
    });

    // IPC: 保存結果
    ipc.on('save-data-reply', (success) => {
        try {
            if (success) {
                DataStore.resetUnsavedChanges();
                uiManager.showNotification('データが正常に保存されました。', 'info');

                if (state.debugMode) {
                    console.info('データの保存が完了しました。');
                }
            } else {
                uiManager.showNotification('データの保存中にエラーが発生しました。', 'error');
            }
        } catch (error) {
            console.error('save-data-reply イベントでエラー:', error);
            uiManager.showNotification('データの保存中にエラーが発生しました。', 'error');
        }
    });

    // IPC: 読み込み結果
    ipc.on('load-data-reply', (data) => {
        try {
            if (data) {
                // もしIDがないオブジェクトがあれば、仮IDを付与
                if (data.points) {
                    data.points.forEach(p => { if (!p.id) p.id = Date.now() + Math.random(); });
                }
                if (data.lines) {
                    data.lines.forEach(l => { if (!l.id) l.id = Date.now() + Math.random(); });
                }
                if (data.polygons) {
                    data.polygons.forEach(pg => { if (!pg.id) pg.id = Date.now() + Math.random(); });
                }

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

                uiManager.updateSlider();
                uiManager.updateWorldInfo();
                uiManager.updateUI();
                renderData();

                uiManager.showNotification('データが正常に読み込まれました。', 'info');
            } else {
                uiManager.showNotification('データの読み込みがキャンセルされました。', 'info');
            }
        } catch (error) {
            console.error('load-data-reply イベントでエラー:', error);
            uiManager.showNotification('データの読み込み中にエラーが発生しました。', 'error');
        }
    });
}

