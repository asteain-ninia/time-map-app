// src/dataStore/polygonsStore.js

import { getPropertiesForYear } from '../utils/index.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';
import VerticesStore from './verticesStore.js';
import stateManager from '../state/index.js';
import { polygonsOverlap } from '../utils/geometryUtils.js';

function generateVertexId() {
    return 'vx-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
}

const polygons = new Map();

const PolygonsStore = {

    /**
     * 指定年に表示すべき面情報一覧を取得する。
     * 面情報は外周と穴情報の座標を含む。
     * ※ layerId はそのまま返す。
     * @param {number} year
     */
    getPolygons(year) {
        debugLog(4, `PolygonsStore.getPolygons() が呼び出されました。year=${year}`);
        try {
            return Array.from(polygons.values())
                .map(pg => {
                    let props = null;
                    if (pg.properties && Array.isArray(pg.properties)) {
                        props = getPropertiesForYear(pg.properties, year);
                    } else {
                        props = {
                            year: pg.year || 0,
                            name: pg.name || '不明な面情報',
                            description: pg.description || '',
                        };
                    }

                    let coords = [];
                    if (pg.points && Array.isArray(pg.points)) {
                        coords = pg.points;
                    }

                    let holesCoords = [];
                    if (pg.holes && Array.isArray(pg.holes)) {
                        holesCoords = pg.holes;
                    }

                    return {
                        ...pg,
                        points: coords,
                        holes: holesCoords,
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
     * 保存用に全面情報を、頂点座標情報付きで返す。
     */
    getAllPolygonsWithCoords() {
        debugLog(4, 'PolygonsStore.getAllPolygonsWithCoords() が呼び出されました。');
        try {
            return Array.from(polygons.values()).map(pg => {
                let coords = [];
                if (pg.points && Array.isArray(pg.points)) {
                    coords = pg.points;
                }
                let holesCoords = [];
                if (pg.holes && Array.isArray(pg.holes)) {
                    holesCoords = pg.holes;
                }
                return {
                    ...pg,
                    points: coords,
                    holes: holesCoords,
                };
            });
        } catch (error) {
            debugLog(1, `PolygonsStore.getAllPolygonsWithCoords() でエラー発生: ${error}`);
            return [];
        }
    },

    /**
     * 面情報を追加する。
     * レイヤーIDが未指定の場合は"default"を設定する。
     * また、同一レイヤー内で既存の面情報と重なっていないかを geometryUtils.polygonsOverlap() によりチェックする。
     * @param {Object} poly
     */
    addPolygon(poly) {
        debugLog(4, `PolygonsStore.addPolygon() が呼び出されました。polygon.id=${poly?.id}`);
        try {
            const st = stateManager.getState();
            if (!poly.id) {
                poly.id = 'pg-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
            }
            // レイヤーIDの設定：未指定なら"default"
            if (!poly.layerId) {
                poly.layerId = 'default';
            }

            // propertiesの初期設定
            if (!poly.properties || poly.properties.length === 0) {
                poly.properties = [{
                    year: st.currentYear,
                    name: poly.name || '新しい面情報',
                    description: poly.description || ''
                }];
            }

            // 外周の座標配列の初期化
            if (!poly.points || !Array.isArray(poly.points)) {
                poly.points = [];
            }
            // 穴情報の初期化
            if (!poly.holes || !Array.isArray(poly.holes)) {
                poly.holes = [];
            }

            const ptsArr = poly.points;
            if (!poly.vertexIds) {
                poly.vertexIds = [];
            }
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
            // 再生成された外周の座標
            poly.points = poly.vertexIds.map(vId => {
                const vx = VerticesStore.getById(vId);
                return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
            });

            // 穴情報の処理
            if (poly.holes && Array.isArray(poly.holes)) {
                if (!poly.holesVertexIds) {
                    poly.holesVertexIds = [];
                }
                poly.holesVertexIds = poly.holes.map(holePoints => {
                    if (Array.isArray(holePoints)) {
                        const holeVIds = [];
                        holePoints.forEach(p => {
                            const newVid = generateVertexId();
                            holeVIds.push(newVid);
                            VerticesStore.addVertex({ id: newVid, x: p.x || 0, y: p.y || 0 });
                        });
                        return holeVIds;
                    }
                    return [];
                });
                poly.holes = poly.holesVertexIds.map(holeVIds => {
                    return holeVIds.map(vId => {
                        const vx = VerticesStore.getById(vId);
                        return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
                    });
                });
            } else {
                poly.holes = [];
                poly.holesVertexIds = [];
            }

            // ***** 排他化チェック（同一レイヤー内の重なり判定） *****
            for (let existing of polygons.values()) {
                if (existing.layerId === poly.layerId) {
                    if (polygonsOverlap(poly.points, existing.points)) {
                        throw new Error('同じレイヤー内で面情報が重なっています。');
                    }
                }
            }
            // ***** 終了 *****

            polygons.set(poly.id, poly);
        } catch (error) {
            debugLog(1, `PolygonsStore.addPolygon() でエラー発生: ${error}`);
            showNotification('面情報の追加中にエラーが発生しました。', 'error');
        }
    },

    /**
     * 面情報を更新する。
     * 更新後、同一レイヤー内で他の面情報と重なっていないかをチェックする。
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

            // 外周の座標更新
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

            // 穴情報の更新
            if (updated.holes && Array.isArray(updated.holes)) {
                if (!existing.holesVertexIds) {
                    existing.holesVertexIds = [];
                }
                existing.holesVertexIds = updated.holes.map((holePoints, holeIndex) => {
                    if (Array.isArray(holePoints)) {
                        let holeVIds = existing.holesVertexIds[holeIndex];
                        if (!holeVIds) holeVIds = [];
                        while (holeVIds.length < holePoints.length) {
                            const newVid = generateVertexId();
                            holeVIds.push(newVid);
                            VerticesStore.addVertex({ id: newVid, x: 0, y: 0 });
                        }
                        while (holeVIds.length > holePoints.length) {
                            holeVIds.pop();
                        }
                        for (let i = 0; i < holePoints.length; i++) {
                            const coord = holePoints[i];
                            const vId = holeVIds[i];
                            VerticesStore.updateVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
                        }
                        return holeVIds;
                    }
                    return existing.holesVertexIds[holeIndex] || [];
                });
                existing.holes = existing.holesVertexIds.map(holeVIds => {
                    return holeVIds.map(vId => {
                        const vx = VerticesStore.getById(vId);
                        return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
                    });
                });
            }

            if (updated.properties) {
                existing.properties = updated.properties;
            }
            if (updated.name !== undefined) existing.name = updated.name;
            if (updated.description !== undefined) existing.description = updated.description;
            if (updated.year !== undefined) existing.year = updated.year;

            // レイヤーIDの更新（更新時に変更があれば反映）
            if (updated.layerId !== undefined) {
                existing.layerId = updated.layerId;
            }

            // ***** 排他化チェック（更新後の形状が同一レイヤー内で重なっていないか） *****
            for (let other of polygons.values()) {
                if (other.id === existing.id) continue;
                if (other.layerId === existing.layerId) {
                    if (polygonsOverlap(existing.points, other.points)) {
                        throw new Error('同じレイヤー内で面情報が重なっています。');
                    }
                }
            }
            // ***** 終了 *****

            polygons.set(existing.id, existing);
        } catch (error) {
            debugLog(1, `PolygonsStore.updatePolygon() でエラー発生: ${error}`);
            showNotification('面情報の更新中にエラーが発生しました。', 'error');
        }
    },

    /**
     * 指定IDの面情報を削除する。
     */
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
     * 指定IDの面情報を取得する。
     */
    getById(id) {
        debugLog(4, `PolygonsStore.getById() が呼び出されました。id=${id}`);
        try {
            return polygons.get(id) || null;
        } catch (error) {
            debugLog(1, `PolygonsStore.getById() でエラー発生: ${error}`);
            return null;
        }
    },

    /**
     * すべての面情報をクリアする。
     */
    clear() {
        debugLog(3, 'PolygonsStore.clear() が呼び出されました。');
        polygons.clear();
    }
};

export default PolygonsStore;
