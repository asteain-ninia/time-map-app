// src/dataStore/index.js

import stateManager from './../state/index.js';
import PointsStore from './pointsStore.js';
import LinesStore from './linesStore.js';
import PolygonsStore from './polygonsStore.js';
import { debugLog } from '../utils/logger.js';
import uiManager from '../ui/uiManager.js';

/**
 * DataStore 全体を統括するモジュール
 * 点情報・線情報・面情報の管理機能をまとめる
 */
let unsavedChanges = false;

const DataStore = {

    getPoints: (year) => {
        debugLog(4, `DataStore.getPoints() が呼び出されました。year=${year}`);
        try {
            const result = PointsStore.getPoints(year);
            return result;
        } catch (error) {
            debugLog(1, `DataStore.getPoints() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.getPoints() でエラーが発生しました: ${error}`, 'error');
            return [];
        }
    },

    getAllPoints: () => {
        debugLog(4, `DataStore.getAllPoints() が呼び出されました。`);
        try {
            const result = PointsStore.getAllPoints();
            return result;
        } catch (error) {
            debugLog(1, `DataStore.getAllPoints() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.getAllPoints() でエラーが発生しました: ${error}`, 'error');
            return [];
        }
    },

    addPoint: (p) => {
        debugLog(4, `DataStore.addPoint() が呼び出されました。point.id=${p?.id}`);
        try {
            PointsStore.addPoint(p);
            unsavedChanges = true;
        } catch (error) {
            debugLog(1, `DataStore.addPoint() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.addPoint() でエラーが発生しました: ${error}`, 'error');
        }
    },

    updatePoint: (p) => {
        debugLog(4, `DataStore.updatePoint() が呼び出されました。point.id=${p?.id}`);
        try {
            PointsStore.updatePoint(p);
            unsavedChanges = true;
        } catch (error) {
            debugLog(1, `DataStore.updatePoint() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.updatePoint() でエラーが発生しました: ${error}`, 'error');
        }
    },

    removePoint: (id) => {
        debugLog(4, `DataStore.removePoint() が呼び出されました。id=${id}`);
        try {
            PointsStore.removePoint(id);
            unsavedChanges = true;
        } catch (error) {
            debugLog(1, `DataStore.removePoint() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.removePoint() でエラーが発生しました: ${error}`, 'error');
        }
    },

    getLines: (year) => {
        debugLog(4, `DataStore.getLines() が呼び出されました。year=${year}`);
        try {
            const result = LinesStore.getLines(year);
            return result;
        } catch (error) {
            debugLog(1, `DataStore.getLines() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.getLines() でエラーが発生しました: ${error}`, 'error');
            return [];
        }
    },

    getAllLines: () => {
        debugLog(4, `DataStore.getAllLines() が呼び出されました。`);
        try {
            const result = LinesStore.getAllLines();
            return result;
        } catch (error) {
            debugLog(1, `DataStore.getAllLines() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.getAllLines() でエラーが発生しました: ${error}`, 'error');
            return [];
        }
    },

    addLine: (l) => {
        debugLog(4, `DataStore.addLine() が呼び出されました。line.id=${l?.id}`);
        try {
            LinesStore.addLine(l);
            unsavedChanges = true;
        } catch (error) {
            debugLog(1, `DataStore.addLine() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.addLine() でエラーが発生しました: ${error}`, 'error');
        }
    },

    updateLine: (l) => {
        debugLog(4, `DataStore.updateLine() が呼び出されました。line.id=${l?.id}`);
        try {
            LinesStore.updateLine(l);
            unsavedChanges = true;
        } catch (error) {
            debugLog(1, `DataStore.updateLine() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.updateLine() でエラーが発生しました: ${error}`, 'error');
        }
    },

    removeLine: (id) => {
        debugLog(4, `DataStore.removeLine() が呼び出されました。id=${id}`);
        try {
            LinesStore.removeLine(id);
            unsavedChanges = true;
        } catch (error) {
            debugLog(1, `DataStore.removeLine() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.removeLine() でエラーが発生しました: ${error}`, 'error');
        }
    },

    getPolygons: (year) => {
        debugLog(4, `DataStore.getPolygons() が呼び出されました。year=${year}`);
        try {
            const result = PolygonsStore.getPolygons(year);
            return result;
        } catch (error) {
            debugLog(1, `DataStore.getPolygons() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.getPolygons() でエラーが発生しました: ${error}`, 'error');
            return [];
        }
    },

    getAllPolygons: () => {
        debugLog(4, `DataStore.getAllPolygons() が呼び出されました。`);
        try {
            const result = PolygonsStore.getAllPolygons();
            return result;
        } catch (error) {
            debugLog(1, `DataStore.getAllPolygons() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.getAllPolygons() でエラーが発生しました: ${error}`, 'error');
            return [];
        }
    },

    addPolygon: (pg) => {
        debugLog(4, `DataStore.addPolygon() が呼び出されました。polygon.id=${pg?.id}`);
        try {
            PolygonsStore.addPolygon(pg);
            unsavedChanges = true;
        } catch (error) {
            debugLog(1, `DataStore.addPolygon() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.addPolygon() でエラーが発生しました: ${error}`, 'error');
        }
    },

    updatePolygon: (pg) => {
        debugLog(4, `DataStore.updatePolygon() が呼び出されました。polygon.id=${pg?.id}`);
        try {
            PolygonsStore.updatePolygon(pg);
            unsavedChanges = true;
        } catch (error) {
            debugLog(1, `DataStore.updatePolygon() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.updatePolygon() でエラーが発生しました: ${error}`, 'error');
        }
    },

    removePolygon: (id) => {
        debugLog(4, `DataStore.removePolygon() が呼び出されました。id=${id}`);
        try {
            PolygonsStore.removePolygon(id);
            unsavedChanges = true;
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
        } catch (error) {
            debugLog(1, `DataStore.clearData() でエラー発生: ${error}`);
            uiManager.showNotification(`DataStore.clearData() でエラーが発生しました: ${error}`, 'error');
        }
    },

    // 変更管理フラグ
    hasUnsavedChanges() {
        debugLog(4, 'DataStore.hasUnsavedChanges() が呼び出されました。');
        return unsavedChanges;
    },
    resetUnsavedChanges() {
        debugLog(4, 'DataStore.resetUnsavedChanges() が呼び出されました。');
        unsavedChanges = false;
    },

    /**
     * JSON 等からロード
     * @param {Object} data
     */
    loadData(data) {
        debugLog(3, 'DataStore.loadData() が呼び出されました。');
        try {
            PointsStore.clear();
            LinesStore.clear();
            PolygonsStore.clear();

            if (data.points) {
                data.points.forEach((point) => {
                    this.addPoint(point);
                });
            }
            if (data.lines) {
                data.lines.forEach((line) => {
                    this.addLine(line);
                });
            }
            if (data.polygons) {
                data.polygons.forEach((polygon) => {
                    this.addPolygon(polygon);
                });
            }
            unsavedChanges = false;
        } catch (error) {
            debugLog(1, `DataStore.loadData() でエラー発生: ${error}`);
            console.error('DataStore.loadData エラー:', error);
            uiManager.showNotification('データの読み込み中にエラーが発生しました。', 'error');
        }
    },

    /**
     * 現在の全データをまとめて返却
     * @returns {Object} { points, lines, polygons, metadata }
     */
    getData() {
        debugLog(3, 'DataStore.getData() が呼び出されました。');
        try {
            const state = stateManager.getState();
            return {
                points: this.getAllPoints(),
                lines: this.getAllLines(),
                polygons: this.getAllPolygons(),
                metadata: {
                    sliderMin: state.sliderMin,
                    sliderMax: state.sliderMax,
                    worldName: state.worldName,
                    worldDescription: state.worldDescription,
                },
            };
        } catch (error) {
            debugLog(1, `DataStore.getData() でエラー発生: ${error}`);
            console.error('DataStore.getData エラー:', error);
            uiManager.showNotification('全データの取得中にエラーが発生しました。', 'error');
            return null;
        }
    },
};

export default DataStore;
