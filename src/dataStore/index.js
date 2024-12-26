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
    getPoints: (year) => PointsStore.getPoints(year),
    getAllPoints: () => PointsStore.getAllPoints(),
    addPoint: (p) => {
        debugLog(3, '点情報を追加します。');
        PointsStore.addPoint(p);
        unsavedChanges = true;
    },
    updatePoint: (p) => {
        debugLog(4, '点情報を更新します。');
        PointsStore.updatePoint(p);
        unsavedChanges = true;
    },
    removePoint: (id) => {
        debugLog(3, '点情報を削除します。');
        PointsStore.removePoint(id);
        unsavedChanges = true;
    },

    getLines: (year) => LinesStore.getLines(year),
    getAllLines: () => LinesStore.getAllLines(),
    addLine: (l) => {
        debugLog(3, '線情報を追加します。');
        LinesStore.addLine(l);
        unsavedChanges = true;
    },
    updateLine: (l) => {
        debugLog(4, '線情報を更新します。');
        LinesStore.updateLine(l);
        unsavedChanges = true;
    },
    removeLine: (id) => {
        debugLog(3, '線情報を削除します。');
        LinesStore.removeLine(id);
        unsavedChanges = true;
    },

    getPolygons: (year) => PolygonsStore.getPolygons(year),
    getAllPolygons: () => PolygonsStore.getAllPolygons(),
    addPolygon: (pg) => {
        debugLog(3, '面情報を追加します。');
        PolygonsStore.addPolygon(pg);
        unsavedChanges = true;
    },
    updatePolygon: (pg) => {
        debugLog(4, '面情報を更新します。');
        PolygonsStore.updatePolygon(pg);
        unsavedChanges = true;
    },
    removePolygon: (id) => {
        debugLog(3, '面情報を削除します。');
        PolygonsStore.removePolygon(id);
        unsavedChanges = true;
    },

    clearData() {
        debugLog(2, 'データを全消去します。');
        PointsStore.clear();
        LinesStore.clear();
        PolygonsStore.clear();
    },

    // 変更管理フラグ
    hasUnsavedChanges() {
        return unsavedChanges;
    },
    resetUnsavedChanges() {
        unsavedChanges = false;
    },

    /**
     * JSON 等からロード
     * @param {Object} data
     */
    loadData(data) {
        try {
            debugLog(2, '外部ファイルからデータをロードします。');
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
            console.error('DataStore.loadData エラー:', error);
            uiManager.showNotification('データの読み込み中にエラーが発生しました。', 'error');
        }
    },

    /**
     * 現在の全データをまとめて返却
     * @returns {Object} { points, lines, polygons, metadata }
     */
    getData() {
        try {
            debugLog(2, '全データを取得し、JSON形式で返します。');
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
            console.error('DataStore.getData エラー:', error);
            uiManager.showNotification('全データの取得中にエラーが発生しました。', 'error');
            return null;
        }
    },
};

export default DataStore;
