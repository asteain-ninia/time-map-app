// src/dataStore/polygonsStore.js
/****************************************************
 * 面情報のストア
 ****************************************************/

import { getPropertiesForYear } from '../utils/index.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';
import VerticesStore from './verticesStore.js';
import stateManager from '../state/index.js';

function generateVertexId() {
    return 'vx-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
}

const polygons = new Map();

const PolygonsStore = {

    /**
     * 指定年以下のプロパティを適用し、面情報を配列で返す
     * @param {number} year
     */
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
                .filter(pg => pg !== null);
        } catch (error) {
            debugLog(1, `PolygonsStore.getPolygons() でエラー発生: ${error}`);
            showNotification('面情報の取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    /**
     * 全面情報を返す (保存用) geometry含む
     */
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

    /**
     * 面情報を追加
     * @param {Object} poly
     */
    addPolygon(poly) {
        debugLog(4, `PolygonsStore.addPolygon() が呼び出されました。polygon.id=${poly?.id}`);
        try {
            const st = stateManager.getState();
            if (!poly.id) {
                poly.id = 'pg-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
            }

            // properties が無ければ currentYear を付与
            if (!poly.properties || poly.properties.length === 0) {
                poly.properties = [{
                    year: st.currentYear,
                    name: poly.name || '新しい面情報',
                    description: poly.description || ''
                }];
            }

            if (!poly.vertexIds) {
                poly.vertexIds = [];
            }

            const ptsArr = (poly.points && Array.isArray(poly.points)) ? poly.points : [];
            while (poly.vertexIds.length < ptsArr.length) {
                const newVid = generateVertexId();
                poly.vertexIds.push(newVid);
                VerticesStore.addVertex({ id: newVid, x: 0, y: 0 });
            }
            while (poly.vertexIds.length > ptsArr.length) {
                poly.vertexIds.pop();
            }

            for (let i = 0; i < ptsArr.length; i++) {
                const coord = ptsArr[i];
                const vId = poly.vertexIds[i];
                VerticesStore.updateVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
            }

            poly.points = poly.vertexIds.map(vId => {
                const vx = VerticesStore.getById(vId);
                return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
            });

            polygons.set(poly.id, poly);
        } catch (error) {
            debugLog(1, `PolygonsStore.addPolygon() でエラー発生: ${error}`);
            showNotification('面情報の追加中にエラーが発生しました。', 'error');
        }
    },

    /**
     * 面情報を更新
     * @param {Object} updated
     */
    updatePolygon(updated) {
        debugLog(4, `PolygonsStore.updatePolygon() が呼び出されました。updatedPolygon.id=${updated?.id}`);
        try {
            const existing = polygons.get(updated.id);
            if (!existing) {
                debugLog(3, `PolygonsStore.updatePolygon() - 更新対象が見つかりません。ID: ${updated?.id}`);
                return;
            }

            const ptsArr = (updated.points && Array.isArray(updated.points)) ? updated.points : existing.points || [];
            while (existing.vertexIds.length < ptsArr.length) {
                const newVid = generateVertexId();
                existing.vertexIds.push(newVid);
                VerticesStore.addVertex({ id: newVid, x: 0, y: 0 });
            }
            while (existing.vertexIds.length > ptsArr.length) {
                existing.vertexIds.pop();
            }

            for (let i = 0; i < ptsArr.length; i++) {
                const coord = ptsArr[i];
                const vId = existing.vertexIds[i];
                VerticesStore.updateVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
            }
            existing.points = existing.vertexIds.map(vId => {
                const vx = VerticesStore.getById(vId);
                return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
            });

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
