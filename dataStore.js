// dataStore.js

import { getPropertiesForYear } from './utils.js';
import stateManager from './stateManager.js';

const DataStore = (() => {
    const points = new Map();
    const lines = new Map();
    const polygons = new Map();
    let unsavedChanges = false;

    function getPoints(year) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('getPoints() が呼び出されました。年:', year);
            }

            return Array.from(points.values())
                .map(point => {
                    console.log('処理中のポイント:', point);

                    let properties = null;

                    // 'properties' フィールドが存在し、配列の場合
                    if (point.properties && Array.isArray(point.properties)) {
                        properties = getPropertiesForYear(point.properties, year);
                    } else {
                        // 'properties' がない場合でも、ポイントに直接 'year', 'name', 'description' があるか確認
                        if (point.year !== undefined) {
                            properties = {
                                year: point.year,
                                name: point.name,
                                description: point.description,
                            };
                        } else {
                            // 'year' がない場合はデフォルト値を設定
                            properties = {
                                year: 0,
                                name: point.name || '不明なポイント',
                                description: point.description || '',
                            };
                        }
                    }

                    console.log('取得されたプロパティ:', properties);

                    if (properties) {
                        return {
                            id: point.id,
                            x: point.x,
                            y: point.y,
                            ...properties,
                        };
                    } else {
                        return null;
                    }
                })
                .filter(point => point !== null);
        } catch (error) {
            console.error('getPoints 関数内でエラーが発生しました:', error);
            return [];
        }
    }

    function getLines(year) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('getLines() が呼び出されました。年:', year);
            }

            return Array.from(lines.values())
                .map(line => {
                    console.log('処理中のライン:', line);

                    let properties = null;

                    if (line.properties && Array.isArray(line.properties)) {
                        properties = getPropertiesForYear(line.properties, year);
                    } else {
                        if (line.year !== undefined) {
                            properties = {
                                year: line.year,
                                name: line.name,
                                description: line.description,
                            };
                        } else {
                            properties = {
                                year: 0,
                                name: line.name || '不明なライン',
                                description: line.description || '',
                            };
                        }
                    }

                    console.log('取得されたプロパティ:', properties);

                    if (properties) {
                        return {
                            id: line.id,
                            points: line.points,
                            ...properties,
                        };
                    } else {
                        return null;
                    }
                })
                .filter(line => line !== null);
        } catch (error) {
            console.error('getLines 関数内でエラーが発生しました:', error);
            return [];
        }
    }

    function getPolygons(year) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('getPolygons() が呼び出されました。年:', year);
            }

            return Array.from(polygons.values())
                .map(polygon => {
                    console.log('処理中のポリゴン:', polygon);

                    let properties = null;

                    if (polygon.properties && Array.isArray(polygon.properties)) {
                        properties = getPropertiesForYear(polygon.properties, year);
                    } else {
                        if (polygon.year !== undefined) {
                            properties = {
                                year: polygon.year,
                                name: polygon.name,
                                description: polygon.description,
                            };
                        } else {
                            properties = {
                                year: 0,
                                name: polygon.name || '不明なポリゴン',
                                description: polygon.description || '',
                            };
                        }
                    }

                    console.log('取得されたプロパティ:', properties);

                    if (properties) {
                        return {
                            id: polygon.id,
                            points: polygon.points,
                            ...properties,
                        };
                    } else {
                        return null;
                    }
                })
                .filter(polygon => polygon !== null);
        } catch (error) {
            console.error('getPolygons 関数内でエラーが発生しました:', error);
            return [];
        }
    }

    function getAllPoints() {
        try {
            if (stateManager.getState().debugMode) {
                console.info('getAllPoints() が呼び出されました。');
            }

            return Array.from(points.values());
        } catch (error) {
            console.error('getAllPoints 関数内でエラーが発生しました:', error);
            return [];
        }
    }

    function getAllLines() {
        try {
            if (stateManager.getState().debugMode) {
                console.info('getAllLines() が呼び出されました。');
            }

            return Array.from(lines.values());
        } catch (error) {
            console.error('getAllLines 関数内でエラーが発生しました:', error);
            return [];
        }
    }

    function getAllPolygons() {
        try {
            if (stateManager.getState().debugMode) {
                console.info('getAllPolygons() が呼び出されました。');
            }

            return Array.from(polygons.values());
        } catch (error) {
            console.error('getAllPolygons 関数内でエラーが発生しました:', error);
            return [];
        }
    }

    function addPoint(point) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('addPoint() が呼び出されました。ポイントID:', point.id);
                console.log('追加されるポイント:', point);
            }

            if (!point.properties || !Array.isArray(point.properties)) {
                point.properties = [];
            }
            points.set(point.id, point);
            unsavedChanges = true;
        } catch (error) {
            console.error('addPoint 関数内でエラーが発生しました:', error);
        }
    }

    function updatePoint(updatedPoint) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('updatePoint() が呼び出されました。ポイントID:', updatedPoint.id);
            }

            if (points.has(updatedPoint.id)) {
                points.set(updatedPoint.id, updatedPoint);
                unsavedChanges = true;
            }
        } catch (error) {
            console.error('updatePoint 関数内でエラーが発生しました:', error);
        }
    }

    function addLine(line) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('addLine() が呼び出されました。ラインID:', line.id);
            }

            lines.set(line.id, line);
            unsavedChanges = true;
        } catch (error) {
            console.error('addLine 関数内でエラーが発生しました:', error);
        }
    }

    function updateLine(updatedLine) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('updateLine() が呼び出されました。ラインID:', updatedLine.id);
            }

            if (lines.has(updatedLine.id)) {
                lines.set(updatedLine.id, updatedLine);
                unsavedChanges = true;
            }
        } catch (error) {
            console.error('updateLine 関数内でエラーが発生しました:', error);
        }
    }

    function addPolygon(polygon) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('addPolygon() が呼び出されました。ポリゴンID:', polygon.id);
            }

            polygons.set(polygon.id, polygon);
            unsavedChanges = true;
        } catch (error) {
            console.error('addPolygon 関数内でエラーが発生しました:', error);
        }
    }

    function updatePolygon(updatedPolygon) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('updatePolygon() が呼び出されました。ポリゴンID:', updatedPolygon.id);
            }

            if (polygons.has(updatedPolygon.id)) {
                polygons.set(updatedPolygon.id, updatedPolygon);
                unsavedChanges = true;
            }
        } catch (error) {
            console.error('updatePolygon 関数内でエラーが発生しました:', error);
        }
    }

    function removePoint(id) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('removePoint() が呼び出されました。ポイントID:', id);
            }

            points.delete(id);
            unsavedChanges = true;
        } catch (error) {
            console.error('removePoint 関数内でエラーが発生しました:', error);
        }
    }

    function removeLine(id) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('removeLine() が呼び出されました。ラインID:', id);
            }

            lines.delete(id);
            unsavedChanges = true;
        } catch (error) {
            console.error('removeLine 関数内でエラーが発生しました:', error);
        }
    }

    function removePolygon(id) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('removePolygon() が呼び出されました。ポリゴンID:', id);
            }

            polygons.delete(id);
            unsavedChanges = true;
        } catch (error) {
            console.error('removePolygon 関数内でエラーが発生しました:', error);
        }
    }

    function clearData() {
        try {
            if (stateManager.getState().debugMode) {
                console.info('clearData() が呼び出されました。');
            }

            points.clear();
            lines.clear();
            polygons.clear();
        } catch (error) {
            console.error('clearData 関数内でエラーが発生しました:', error);
        }
    }

    // hasUnsavedChanges メソッドを追加
    function hasUnsavedChanges() {
        return unsavedChanges;
    }

    // データの保存や読み込み時に unsavedChanges をリセット
    function resetUnsavedChanges() {
        unsavedChanges = false;
    }

    // データの読み込み時に unsavedChanges をリセット
    function loadData(data) {
        try {
            // データをクリア
            points.clear();
            lines.clear();
            polygons.clear();

            // データをセット
            if (data.points) {
                data.points.forEach(point => points.set(point.id, point));
            }
            if (data.lines) {
                data.lines.forEach(line => lines.set(line.id, line));
            }
            if (data.polygons) {
                data.polygons.forEach(polygon => polygons.set(polygon.id, polygon));
            }

            unsavedChanges = false; // データをロードしたので変更なしに設定
        } catch (error) {
            console.error('loadData 関数内でエラーが発生しました:', error);
        }
    }

    // データの取得（保存用）
    function getData() {
        try {
            const state = stateManager.getState();
            return {
                points: Array.from(points.values()),
                lines: Array.from(lines.values()),
                polygons: Array.from(polygons.values()),
                metadata: { // メタデータを含める
                    sliderMin: state.sliderMin,
                    sliderMax: state.sliderMax,
                    worldName: state.worldName,
                    worldDescription: state.worldDescription,
                },
            };
        } catch (error) {
            console.error('getData 関数内でエラーが発生しました:', error);
            return null;
        }
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
        hasUnsavedChanges,
        resetUnsavedChanges,
        loadData,
        getData,
    };
})();

export default DataStore;
