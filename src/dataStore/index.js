// src/dataStore/index.js

/**
 * ここで PointsStore / LinesStore / PolygonsStore をまとめ、
 * 従来の "DataStore" として扱う。
 *
 * - 追加で "unsavedChanges" や "loadData", "getData" などの全体管理も行う
 */

import stateManager from '../../stateManager.js';
import PointsStore from './pointsStore.js';
import LinesStore from './linesStore.js';
import PolygonsStore from './polygonsStore.js';

let unsavedChanges = false;

/**
 * DataStore 全体を統括するモジュール
 */
const DataStore = {
    // ポイント関連
    getPoints: (year) => PointsStore.getPoints(year),
    getAllPoints: () => PointsStore.getAllPoints(),
    addPoint: (p) => {
        PointsStore.addPoint(p);
        unsavedChanges = true;
    },
    updatePoint: (p) => {
        PointsStore.updatePoint(p);
        unsavedChanges = true;
    },
    removePoint: (id) => {
        PointsStore.removePoint(id);
        unsavedChanges = true;
    },

    // ライン関連
    getLines: (year) => LinesStore.getLines(year),
    getAllLines: () => LinesStore.getAllLines(),
    addLine: (l) => {
        LinesStore.addLine(l);
        unsavedChanges = true;
    },
    updateLine: (l) => {
        LinesStore.updateLine(l);
        unsavedChanges = true;
    },
    removeLine: (id) => {
        LinesStore.removeLine(id);
        unsavedChanges = true;
    },

    // ポリゴン関連
    getPolygons: (year) => PolygonsStore.getPolygons(year),
    getAllPolygons: () => PolygonsStore.getAllPolygons(),
    addPolygon: (pg) => {
        PolygonsStore.addPolygon(pg);
        unsavedChanges = true;
    },
    updatePolygon: (pg) => {
        PolygonsStore.updatePolygon(pg);
        unsavedChanges = true;
    },
    removePolygon: (id) => {
        PolygonsStore.removePolygon(id);
        unsavedChanges = true;
    },

    // データ全消去
    clearData() {
        if (stateManager.getState().debugMode) {
            console.info('DataStore.clearData() が呼び出されました。');
        }
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
            PointsStore.clear();
            LinesStore.clear();
            PolygonsStore.clear();

            if (data.points) {
                data.points.forEach((point) => {
                    // x,y を points配列に変換するロジックは addPoint 内で実施
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
        }
    },

    /**
     * 現在の全データをまとめて返却
     * @returns {Object} { points, lines, polygons, metadata }
     */
    getData() {
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
            console.error('DataStore.getData エラー:', error);
            return null;
        }
    },
};

export default DataStore;
