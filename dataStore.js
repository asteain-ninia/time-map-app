// dataStore.js

import { getPropertiesForYear } from './utils.js';

const DataStore = (() => {
    const points = new Map();
    const lines = new Map();
    const polygons = new Map();

    // 年次に応じたポイントの取得
    function getPoints(year) {
        return Array.from(points.values())
            .map(point => {
                const properties = getPropertiesForYear(point.properties, year);
                if (properties) {
                    return { ...point, ...properties };
                } else {
                    return null;
                }
            })
            .filter(point => point !== null);
    }

    // 年次に応じたラインの取得
    function getLines(year) {
        return Array.from(lines.values())
            .map(line => {
                const properties = getPropertiesForYear(line.properties, year);
                if (properties) {
                    return { ...line, ...properties };
                } else {
                    return null;
                }
            })
            .filter(line => line !== null);
    }

    // 年次に応じたポリゴンの取得
    function getPolygons(year) {
        return Array.from(polygons.values())
            .map(polygon => {
                const properties = getPropertiesForYear(polygon.properties, year);
                if (properties) {
                    return { ...polygon, ...properties };
                } else {
                    return null;
                }
            })
            .filter(polygon => polygon !== null);
    }

    // 全ポイントの取得（保存・読み込み用）
    function getAllPoints() {
        return Array.from(points.values());
    }

    // 全ラインの取得（保存・読み込み用）
    function getAllLines() {
        return Array.from(lines.values());
    }

    // 全ポリゴンの取得（保存・読み込み用）
    function getAllPolygons() {
        return Array.from(polygons.values());
    }

    // 新しいポイントを追加
    function addPoint(point) {
        if (!point.properties) {
            point.properties = [];
        }
        points.set(point.id, point);
    }

    // ポイントを更新（新しいプロパティを追加）
    function updatePoint(updatedPoint) {
        if (points.has(updatedPoint.id)) {
            points.set(updatedPoint.id, updatedPoint);
        }
    }

    // 新しいラインを追加
    function addLine(line) {
        lines.set(line.id, line);
    }

    // ラインを更新
    function updateLine(updatedLine) {
        if (lines.has(updatedLine.id)) {
            lines.set(updatedLine.id, updatedLine);
        }
    }

    // 新しいポリゴンを追加
    function addPolygon(polygon) {
        polygons.set(polygon.id, polygon);
    }

    // ポリゴンを更新
    function updatePolygon(updatedPolygon) {
        if (polygons.has(updatedPolygon.id)) {
            polygons.set(updatedPolygon.id, updatedPolygon);
        }
    }

    // ポイントを削除
    function removePoint(id) {
        points.delete(id);
    }

    // ラインを削除
    function removeLine(id) {
        lines.delete(id);
    }

    // ポリゴンを削除
    function removePolygon(id) {
        polygons.delete(id);
    }

    // データをクリア（読み込み時などに使用）
    function clearData() {
        points.clear();
        lines.clear();
        polygons.clear();
    }

    return {
        getPoints,
        getLines,
        getPolygons,

        getAllPoints,
        getAllLines,
        getAllPolygons,

        addPoint,
        addLine,
        addPolygon,

        updatePoint,
        updateLine,
        updatePolygon,

        removePoint,
        removeLine,
        removePolygon,

        clearData,
    };
})();

export default DataStore;
