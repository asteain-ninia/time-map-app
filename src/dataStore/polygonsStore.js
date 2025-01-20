// src/dataStore/polygonsStore.js
/****************************************************
 * 面情報のストア
 *
 * 修正点:
 *   - getPolygons(year) の戻り値から
 *     originalPolygon を除去し、循環参照を回避。
 ****************************************************/

import { getPropertiesForYear } from '../utils/index.js';
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

                    // 頂点ストアから座標を取得
                    let coords = [];
                    if (polygon.vertexIds && Array.isArray(polygon.vertexIds)) {
                        coords = polygon.vertexIds.map(vId => {
                            const vertex = VerticesStore.getById(vId);
                            if (vertex) {
                                return { x: vertex.x, y: vertex.y };
                            }
                            return { x: 0, y: 0 };
                        });
                    }

                    if (properties) {
                        return {
                            id: polygon.id,
                            vertexIds: polygon.vertexIds,
                            properties: polygon.properties,
                            // 循環参照を避けるため originalPolygon は付与しない
                            points: coords,
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

    /**
     * 面情報を追加
     * - polygon.vertexIds が無い場合は polygon.points などから頂点ストアへ登録
     */
    addPolygon(polygon) {
        debugLog(4, `PolygonsStore.addPolygon() が呼び出されました。polygon.id=${polygon?.id}`);
        try {
            if (!polygon.properties || !Array.isArray(polygon.properties)) {
                polygon.properties = [];
            }

            if (!polygon.vertexIds || !Array.isArray(polygon.vertexIds) || polygon.vertexIds.length === 0) {
                if (polygon.points && Array.isArray(polygon.points) && polygon.points.length > 0) {
                    polygon.vertexIds = polygon.points.map(coord => {
                        const newVid = Date.now() + Math.random();
                        VerticesStore.addVertex({ id: newVid, x: coord.x || 0, y: coord.y || 0 });
                        return newVid;
                    });
                    delete polygon.points;
                } else {
                    polygon.vertexIds = [];
                }
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
            const existing = polygons.get(updatedPolygon.id);
            if (!existing) {
                debugLog(3, `PolygonsStore.updatePolygon() - 更新対象の面情報が見つかりません。ID: ${updatedPolygon?.id}`);
                return;
            }

            if (updatedPolygon.points && Array.isArray(updatedPolygon.points)) {
                existing.vertexIds = updatedPolygon.points.map((coord, idx) => {
                    let vId;
                    if (existing.vertexIds && existing.vertexIds[idx]) {
                        vId = existing.vertexIds[idx];
                        VerticesStore.updateVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
                    } else {
                        vId = Date.now() + Math.random();
                        VerticesStore.addVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
                    }
                    return vId;
                });
                delete updatedPolygon.points;
            }

            for (const key in updatedPolygon) {
                if (key === 'id' || key === 'vertexIds') continue;
                existing[key] = updatedPolygon[key];
            }

            polygons.set(existing.id, existing);
        } catch (error) {
            debugLog(1, `PolygonsStore.updatePolygon() でエラー発生: ${error}`);
            showNotification('面情報の更新中にエラーが発生しました。', 'error');
        }
    },

    removePolygon(id) {
        debugLog(4, `PolygonsStore.removePolygon() が呼び出されました。id=${id}`);
        try {
            polygons.delete(id);
        } catch (error) {
            debugLog(1, `PolygonsStore.removePolygon() でエラー発生: ${error}`);
            showNotification('面情報の削除中にエラーが発生しました。', 'error');
        }
    },

    /**
     * IDを指定してPolygonオブジェクトを取得
     */
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
