// src/dataStore/polygonsStore.js
/****************************************************
 * 面情報ストア
 *
 * 修正点:
 *   - getAllPolygonsWithCoords() 追加
 *   - addPolygon, updatePolygon時に points 同期
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
                .map(poly => {
                    let props = null;
                    if (poly.properties && Array.isArray(poly.properties)) {
                        props = getPropertiesForYear(poly.properties, year);
                    } else {
                        props = {
                            year: poly.year || 0,
                            name: poly.name || '不明な面情報',
                            description: poly.description || '',
                        };
                    }

                    let coords = [];
                    if (poly.vertexIds && Array.isArray(poly.vertexIds)) {
                        coords = poly.vertexIds.map(vId => {
                            const vx = VerticesStore.getById(vId);
                            return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
                        });
                    }

                    if (!props) return null;
                    return {
                        id: poly.id,
                        vertexIds: poly.vertexIds,
                        properties: poly.properties,
                        points: coords,
                        ...props
                    };
                })
                .filter(p => p !== null);
        } catch (error) {
            debugLog(1, `PolygonsStore.getPolygons() でエラー発生: ${error}`);
            showNotification('面情報の取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    getAllPolygonsWithCoords() {
        debugLog(4, 'PolygonsStore.getAllPolygonsWithCoords() が呼び出されました。');
        try {
            return Array.from(polygons.values()).map(pg => {
                let coords = [];
                if (pg.vertexIds) {
                    coords = pg.vertexIds.map(vId => {
                        const vx = VerticesStore.getById(vId);
                        return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
                    });
                }
                return {
                    ...pg,
                    points: coords
                };
            });
        } catch (error) {
            debugLog(1, `PolygonsStore.getAllPolygonsWithCoords() でエラー発生: ${error}`);
            return [];
        }
    },

    addPolygon(poly) {
        debugLog(4, `PolygonsStore.addPolygon() が呼び出されました。polygon.id=${poly?.id}`);
        try {
            if (!poly.properties) {
                poly.properties = [];
            }

            if (!poly.vertexIds || !Array.isArray(poly.vertexIds) || poly.vertexIds.length === 0) {
                if (poly.points && Array.isArray(poly.points) && poly.points.length > 0) {
                    poly.vertexIds = poly.points.map(coord => {
                        const vid = Date.now() + Math.random();
                        VerticesStore.addVertex({ id: vid, x: coord.x || 0, y: coord.y || 0 });
                        return vid;
                    });
                } else {
                    poly.vertexIds = [];
                }
            }

            // points フィールドを同期
            if (!poly.points || !Array.isArray(poly.points)) {
                poly.points = poly.vertexIds.map(vid => {
                    const vx = VerticesStore.getById(vid);
                    return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
                });
            }

            polygons.set(poly.id, poly);
        } catch (error) {
            debugLog(1, `PolygonsStore.addPolygon() でエラー発生: ${error}`);
            showNotification('面情報の追加中にエラーが発生しました。', 'error');
        }
    },

    updatePolygon(updated) {
        debugLog(4, `PolygonsStore.updatePolygon() が呼び出されました。updatedPolygon.id=${updated?.id}`);
        try {
            const existing = polygons.get(updated.id);
            if (!existing) {
                debugLog(3, `PolygonsStore.updatePolygon() - 更新対象が見つかりません。ID: ${updated?.id}`);
                return;
            }

            if (updated.points && Array.isArray(updated.points)) {
                existing.vertexIds = updated.points.map((coord, idx) => {
                    let vId = existing.vertexIds[idx];
                    if (!vId) {
                        vId = Date.now() + Math.random();
                        existing.vertexIds.push(vId);
                    }
                    VerticesStore.updateVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
                    return vId;
                });
                existing.points = updated.points;
            }

            if (updated.properties) {
                existing.properties = updated.properties;
            }
            if (updated.name !== undefined) existing.name = updated.name;
            if (updated.description !== undefined) existing.description = updated.description;
            if (updated.year !== undefined) existing.year = updated.year;

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

    getById(id) {
        debugLog(4, `PolygonsStore.getById() が呼び出されました。id=${id}`);
        try {
            return polygons.get(id) || null;
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
