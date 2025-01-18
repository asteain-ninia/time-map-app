// src/dataStore/index.js

import stateManager from './../state/index.js';
import PointsStore from './pointsStore.js';
import LinesStore from './linesStore.js';
import PolygonsStore from './polygonsStore.js';
import VerticesStore from './verticesStore.js';  // 新規追加
import { debugLog } from '../utils/logger.js';
import uiManager from '../ui/uiManager.js';
import UndoRedoManager from '../utils/undoRedoManager.js';

let unsavedChanges = false;

const DataStore = {

    getPoints: (year) => {
        debugLog(4, `DataStore.getPoints() が呼び出されました。year=${year}`);
        try {
            return PointsStore.getPoints(year);
        } catch (error) {
            debugLog(1, `DataStore.getPoints() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.getPoints() でエラーが発生しました: ${error}`, 'error');
            return [];
        }
    },

    getAllPoints: () => {
        debugLog(4, `DataStore.getAllPoints() が呼び出されました。`);
        try {
            return PointsStore.getAllPoints();
        } catch (error) {
            debugLog(1, `DataStore.getAllPoints() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.getAllPoints() でエラーが発生しました: ${error}`, 'error');
            return [];
        }
    },

    addPoint: (p, shouldRecord = false) => {
        debugLog(4, `DataStore.addPoint() が呼び出されました。point.id=${p?.id}, shouldRecord=${shouldRecord}`);
        try {
            PointsStore.addPoint(p);
            unsavedChanges = true;

            if (shouldRecord) {
                const action = UndoRedoManager.makeAction('addPoint', null, p);
                UndoRedoManager.record(action);
            }
        } catch (error) {
            debugLog(1, `DataStore.addPoint() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.addPoint() でエラーが発生しました: ${error}`, 'error');
        }
    },

    updatePoint: (p, shouldRecord = false) => {
        debugLog(4, `DataStore.updatePoint() が呼び出されました。point.id=${p?.id}, shouldRecord=${shouldRecord}`);
        try {
            const oldObj = PointsStore.getById(p.id);
            PointsStore.updatePoint(p);
            unsavedChanges = true;

            if (shouldRecord && oldObj) {
                const action = UndoRedoManager.makeAction('updatePoint', oldObj, p);
                UndoRedoManager.record(action);
            }
        } catch (error) {
            debugLog(1, `DataStore.updatePoint() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.updatePoint() でエラーが発生しました: ${error}`, 'error');
        }
    },

    removePoint: (id, shouldRecord = false) => {
        debugLog(4, `DataStore.removePoint() が呼び出されました。id=${id}, shouldRecord=${shouldRecord}`);
        try {
            const oldObj = PointsStore.getById(id);
            PointsStore.removePoint(id);
            unsavedChanges = true;

            if (shouldRecord && oldObj) {
                const action = UndoRedoManager.makeAction('removePoint', oldObj, null);
                UndoRedoManager.record(action);
            }
        } catch (error) {
            debugLog(1, `DataStore.removePoint() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.removePoint() でエラーが発生しました: ${error}`, 'error');
        }
    },

    // ... Lines ...
    getLines: (year) => {
        debugLog(4, `DataStore.getLines() が呼び出されました。year=${year}`);
        try {
            return LinesStore.getLines(year);
        } catch (error) {
            debugLog(1, `DataStore.getLines() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.getLines() でエラーが発生しました: ${error}`, 'error');
            return [];
        }
    },

    getAllLines: () => {
        debugLog(4, `DataStore.getAllLines() が呼び出されました。`);
        try {
            return LinesStore.getAllLines();
        } catch (error) {
            debugLog(1, `DataStore.getAllLines() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.getAllLines() でエラーが発生しました。`, 'error');
            return [];
        }
    },

    addLine: (l, shouldRecord = false) => {
        debugLog(4, `DataStore.addLine() が呼び出されました。line.id=${l?.id}, shouldRecord=${shouldRecord}`);
        try {
            LinesStore.addLine(l);
            unsavedChanges = true;

            if (shouldRecord) {
                const action = UndoRedoManager.makeAction('addLine', null, l);
                UndoRedoManager.record(action);
            }
        } catch (error) {
            debugLog(1, `DataStore.addLine() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.addLine() でエラーが発生しました: ${error}`, 'error');
        }
    },

    updateLine: (l, shouldRecord = false) => {
        debugLog(4, `DataStore.updateLine() が呼び出されました。line.id=${l?.id}, shouldRecord=${shouldRecord}`);
        try {
            const oldObj = LinesStore.getById(l.id);
            LinesStore.updateLine(l);
            unsavedChanges = true;

            if (shouldRecord && oldObj) {
                const action = UndoRedoManager.makeAction('updateLine', oldObj, l);
                UndoRedoManager.record(action);
            }
        } catch (error) {
            debugLog(1, `DataStore.updateLine() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.updateLine() でエラーが発生しました: ${error}`, 'error');
        }
    },

    removeLine: (id, shouldRecord = false) => {
        debugLog(4, `DataStore.removeLine() が呼び出されました。id=${id}, shouldRecord=${shouldRecord}`);
        try {
            const oldObj = LinesStore.getById(id);
            LinesStore.removeLine(id);
            unsavedChanges = true;

            if (shouldRecord && oldObj) {
                const action = UndoRedoManager.makeAction('removeLine', oldObj, null);
                UndoRedoManager.record(action);
            }
        } catch (error) {
            debugLog(1, `DataStore.removeLine() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.removeLine() でエラーが発生しました: ${error}`, 'error');
        }
    },

    // ... Polygons ...
    getPolygons: (year) => {
        debugLog(4, `DataStore.getPolygons() が呼び出されました。year=${year}`);
        try {
            return PolygonsStore.getPolygons(year);
        } catch (error) {
            debugLog(1, `DataStore.getPolygons() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.getPolygons() でエラーが発生しました: ${error}`, 'error');
            return [];
        }
    },

    getAllPolygons: () => {
        debugLog(4, `DataStore.getAllPolygons() が呼び出されました。`);
        try {
            return PolygonsStore.getAllPolygons();
        } catch (error) {
            debugLog(1, `DataStore.getAllPolygons() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.getAllPolygons() でエラーが発生しました。`, 'error');
            return [];
        }
    },

    addPolygon: (pg, shouldRecord = false) => {
        debugLog(4, `DataStore.addPolygon() が呼び出されました。polygon.id=${pg?.id}, shouldRecord=${shouldRecord}`);
        try {
            PolygonsStore.addPolygon(pg);
            unsavedChanges = true;

            if (shouldRecord) {
                const action = UndoRedoManager.makeAction('addPolygon', null, pg);
                UndoRedoManager.record(action);
            }
        } catch (error) {
            debugLog(1, `DataStore.addPolygon() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.addPolygon() でエラーが発生しました: ${error}`, 'error');
        }
    },

    updatePolygon: (pg, shouldRecord = false) => {
        debugLog(4, `DataStore.updatePolygon() が呼び出されました。polygon.id=${pg?.id}, shouldRecord=${shouldRecord}`);
        try {
            const oldObj = PolygonsStore.getById(pg.id);
            PolygonsStore.updatePolygon(pg);
            unsavedChanges = true;

            if (shouldRecord && oldObj) {
                const action = UndoRedoManager.makeAction('updatePolygon', oldObj, pg);
                UndoRedoManager.record(action);
            }
        } catch (error) {
            debugLog(1, `DataStore.updatePolygon() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.updatePolygon() でエラーが発生しました: ${error}`, 'error');
        }
    },

    removePolygon: (id, shouldRecord = false) => {
        debugLog(4, `DataStore.removePolygon() が呼び出されました。id=${id}, shouldRecord=${shouldRecord}`);
        try {
            const oldObj = PolygonsStore.getById(id);
            PolygonsStore.removePolygon(id);
            unsavedChanges = true;

            if (shouldRecord && oldObj) {
                const action = UndoRedoManager.makeAction('removePolygon', oldObj, null);
                UndoRedoManager.record(action);
            }
        } catch (error) {
            debugLog(1, `DataStore.removePolygon() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.removePolygon() でエラーが発生しました: ${error}`, 'error');
        }
    },

    clearData() {
        debugLog(3, 'DataStore.clearData() が呼び出されました。');
        try {
            PointsStore.clear();
            LinesStore.clear();
            PolygonsStore.clear();
            VerticesStore.clear(); // 頂点もクリア
        } catch (error) {
            debugLog(1, `DataStore.clearData() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.clearData() でエラーが発生しました: ${error}`, 'error');
        }
    },

    hasUnsavedChanges() {
        debugLog(4, 'DataStore.hasUnsavedChanges() が呼び出されました。');
        return unsavedChanges;
    },

    resetUnsavedChanges() {
        debugLog(4, 'DataStore.resetUnsavedChanges() が呼び出されました。');
        unsavedChanges = false;
    },

    loadData(data) {
        debugLog(3, 'DataStore.loadData() が呼び出されました。');
        try {
            // Undo対象外
            PointsStore.clear();
            LinesStore.clear();
            PolygonsStore.clear();
            VerticesStore.clear();

            // ここで古い形式 (point.x, point.y) などは読み込み不可とする or エラーにする
            // いちおう簡易チェックする
            if (data.points) {
                data.points.forEach((point) => {
                    if (!point.vertexIds && (point.x !== undefined || point.y !== undefined)) {
                        throw new Error('Old-format point data found (points array). This version does not support it.');
                    }
                    this.addPoint(point, false);
                });
            }
            if (data.lines) {
                data.lines.forEach((line) => {
                    if (!line.vertexIds && line.points) {
                        throw new Error('Old-format line data found (points array). This version does not support it.');
                    }
                    this.addLine(line, false);
                });
            }
            if (data.polygons) {
                data.polygons.forEach((polygon) => {
                    if (!polygon.vertexIds && polygon.points) {
                        throw new Error('Old-format polygon data found (points array). This version does not support it.');
                    }
                    this.addPolygon(polygon, false);
                });
            }

            unsavedChanges = false;
        } catch (error) {
            debugLog(1, `DataStore.loadData() でエラー発生: ${error}`);
            uiManager.showNotification('データの読み込み中にエラーが発生しました。', 'error');
        }
    },

    getData() {
        debugLog(3, 'DataStore.getData() が呼び出されました。');
        try {
            const st = stateManager.getState();
            return {
                points: this.getAllPoints(),
                lines: this.getAllLines(),
                polygons: this.getAllPolygons(),
                metadata: {
                    sliderMin: st.sliderMin,
                    sliderMax: st.sliderMax,
                    worldName: st.worldName,
                    worldDescription: st.worldDescription,
                },
            };
        } catch (error) {
            debugLog(1, `DataStore.getData() でエラー発生: ${error}`);
            uiManager.showNotification('全データの取得中にエラーが発生しました。', 'error');
            return null;
        }
    },

    /**
     * 全ストアから指定IDに該当する要素を検索して返す (Point/Line/Polygon いずれか)
     * なければnull
     */
    getById: (id) => {
        const p = PointsStore.getById(id);
        if (p) return p;

        const l = LinesStore.getById(id);
        if (l) return l;

        const pol = PolygonsStore.getById(id);
        if (pol) return pol;

        return null;
    },
};

export default DataStore;
