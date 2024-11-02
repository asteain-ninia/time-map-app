// dataStore.js

import { getPropertiesForYear } from './utils.js';
import stateManager from './stateManager.js';

const DataStore = (() => {
    const points = new Map();
    const lines = new Map();
    const polygons = new Map();

    function getPoints(year) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('getPoints() が呼び出されました。年:', year);
            }

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
                    const properties = getPropertiesForYear(line.properties, year);
                    if (properties) {
                        return { ...line, ...properties };
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
                    const properties = getPropertiesForYear(polygon.properties, year);
                    if (properties) {
                        return { ...polygon, ...properties };
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
            }

            if (!point.properties) {
                point.properties = [];
            }
            points.set(point.id, point);
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
