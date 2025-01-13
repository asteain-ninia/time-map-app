// src/dataStore/polygonsStore.js

import { getPropertiesForYear } from '../utils/index.js';
import stateManager from '../state/index.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';
import VerticesStore from './verticesStore.js';

const polygons = new Map();

const PolygonsStore = {

    getPolygons(year) {
        debugLog(4, `PolygonsStore.getPolygons() が呼び出されました。year=${year}`);
        try {
            return Array.from(polygons.values())
                .map(polygon => {
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
                                name: polygon.name || '不明な面情報',
                                description: polygon.description || '',
                            };
                        }
                    }

                    // 頂点配列を組み立て
                    let pts = [];
                    if (polygon.vertexIds && Array.isArray(polygon.vertexIds)) {
                        pts = polygon.vertexIds.map(vId => {
                            const v = VerticesStore.getById(vId);
                            return v ? { x: v.x, y: v.y } : null;
                        }).filter(pp => pp !== null);
                    }

                    if (properties) {
                        return {
                            id: polygon.id,
                            points: pts,
                            properties: polygon.properties,
                            originalPolygon: polygon,
                            ...properties,
                        };
                    } else {
                        return null;
                    }
                })
                .filter(pg => pg !== null);
        } catch (error) {
            debugLog(1, `PolygonsStore.getPolygons() でエラー発生: ${error}`);
            showNotification('面情報の取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    getAllPolygons() {
        debugLog(4, `PolygonsStore.getAllPolygons() が呼び出されました。`);
        try {
            return Array.from(polygons.values());
        } catch (error) {
            debugLog(1, `PolygonsStore.getAllPolygons() でエラー発生: ${error}`);
            showNotification('面情報の一覧取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    addPolygon(polygon) {
        debugLog(4, `PolygonsStore.addPolygon() が呼び出されました。polygon.id=${polygon?.id}`);
        try {
            if (!polygon.vertexIds || !Array.isArray(polygon.vertexIds)) {
                polygon.vertexIds = [];
            }
            polygons.set(polygon.id, polygon);
        } catch (error) {
            debugLog(1, `PolygonsStore.addPolygon() でエラー発生: ${error}`);
            showNotification('面情報の追加中にエラーが発生しました。', 'error');
        }
    },

    updatePolygon(updatedPolygon) {
        debugLog(4, `PolygonsStore.updatePolygon() が呼び出されました。updatedPolygon.id=${updatedPolygon?.id}`);
        try {
            if (polygons.has(updatedPolygon.id)) {
                const existing = polygons.get(updatedPolygon.id);
                Object.assign(existing, updatedPolygon);
                polygons.set(updatedPolygon.id, existing);
            } else {
                debugLog(3, `PolygonsStore.updatePolygon() - 更新対象の面情報が見つかりません。ID: ${updatedPolygon?.id}`);
                console.warn('更新対象の面情報が見つかりません。ID:', updatedPolygon.id);
            }
        } catch (error) {
            debugLog(1, `PolygonsStore.updatePolygon() でエラー発生: ${error}`);
            showNotification('面情報の更新中にエラーが発生しました。', 'error');
        }
    },

    removePolygon(id) {
        debugLog(4, `PolygonsStore.removePolygon() が呼び出されました。id=${id}`);
        try {
            if (polygons.has(id)) {
                const pg = polygons.get(id);
                if (pg.vertexIds && Array.isArray(pg.vertexIds)) {
                    pg.vertexIds.forEach(vId => {
                        VerticesStore.removeVertex(vId);
                    });
                }
                polygons.delete(id);
            }
        } catch (error) {
            debugLog(1, `PolygonsStore.removePolygon() でエラー発生: ${error}`);
            showNotification('面情報の削除中にエラーが発生しました。', 'error');
        }
    },

    getById(id) {
        debugLog(4, `PolygonsStore.getById() が呼び出されました。id=${id}`);
        try {
            if (!polygons.has(id)) {
                return null;
            }
            return polygons.get(id);
        } catch (error) {
            debugLog(1, `PolygonsStore.getById() でエラー発生: ${error}`);
            return null;
        }
    },

    clear() {
        debugLog(3, 'PolygonsStore.clear() が呼び出されました。');
        polygons.clear();
    }
};

export default PolygonsStore;
