// src/dataStore/pointsStore.js
/****************************************************
 * 点情報ストア
 *
 * 主な修正:
 *   1) ID生成を「文字列化」し衝突・Float不一致を防止
 *   2) addPoint / updatePoint で "points.length" と "vertexIds.length" を
 *      常に合わせるようにし、頂点ストアとの不整合を回避
 ****************************************************/

import { getPropertiesForYear } from '../utils/index.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';
import VerticesStore from './verticesStore.js';
import stateManager from '../state/index.js';

// ランダム頂点ID生成用
function generateVertexId() {
    return 'vx-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
}

const points = new Map();

const PointsStore = {

    /**
     * 指定年の points array
     */
    getPoints(year) {
        debugLog(4, `PointsStore.getPoints() が呼び出されました。year=${year}`);
        try {
            return Array.from(points.values())
                .map(point => {
                    let props = null;
                    if (point.properties && Array.isArray(point.properties)) {
                        props = getPropertiesForYear(point.properties, year);
                    } else {
                        props = {
                            year: point.year || 0,
                            name: point.name || '不明な点情報',
                            description: point.description || '',
                        };
                    }

                    let coords = [];
                    if (point.vertexIds && Array.isArray(point.vertexIds)) {
                        coords = point.vertexIds.map(vId => {
                            const vx = VerticesStore.getById(vId);
                            return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
                        });
                    }

                    if (!props) return null;
                    return {
                        id: point.id,
                        vertexIds: point.vertexIds,
                        properties: point.properties,
                        points: coords,
                        ...props
                    };
                })
                .filter(p => p !== null);
        } catch (error) {
            debugLog(1, `PointsStore.getPoints() でエラー発生: ${error}`);
            showNotification('点情報の取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    /**
     * 全pointを座標付きで返す (保存用)
     */
    getAllPointsWithCoords() {
        debugLog(4, 'PointsStore.getAllPointsWithCoords() が呼び出されました。');
        try {
            return Array.from(points.values()).map(pt => {
                let coords = [];
                if (pt.vertexIds) {
                    coords = pt.vertexIds.map(vId => {
                        const vx = VerticesStore.getById(vId);
                        return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
                    });
                }
                return {
                    ...pt,
                    points: coords,
                };
            });
        } catch (error) {
            debugLog(1, `PointsStore.getAllPointsWithCoords() でエラー発生: ${error}`);
            return [];
        }
    },

    /**
     * ポイントを追加
     * @param {Object} point
     */
    addPoint(point) {
        debugLog(4, `PointsStore.addPoint() が呼び出されました。point.id=${point?.id}`);
        try {
            const st = stateManager.getState();
            if (!point.id) {
                point.id = 'pt-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
            }

            // プロパティのyearが無いなら currentYear を付与
            if (!point.properties || point.properties.length === 0) {
                point.properties = [{
                    year: st.currentYear,
                    name: point.name || '新しい点情報',
                    description: point.description || ''
                }];
            }

            // あとは頂点数合わせのロジック
            if (!point.vertexIds) {
                point.vertexIds = [];
            }
            const ptsArr = (point.points && Array.isArray(point.points)) ? point.points : [];
            while (point.vertexIds.length < ptsArr.length) {
                const newVid = generateVertexId();
                point.vertexIds.push(newVid);
                VerticesStore.addVertex({ id: newVid, x: 0, y: 0 });
            }
            while (point.vertexIds.length > ptsArr.length) {
                point.vertexIds.pop();
            }

            for (let i = 0; i < ptsArr.length; i++) {
                const coord = ptsArr[i];
                const vId = point.vertexIds[i];
                VerticesStore.updateVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
            }

            point.points = point.vertexIds.map(vId => {
                const vx = VerticesStore.getById(vId);
                return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
            });

            points.set(point.id, point);
        } catch (error) {
            debugLog(1, `PointsStore.addPoint() でエラー発生: ${error}`);
            showNotification('点情報の追加中にエラーが発生しました。', 'error');
        }
    },

    /**
     * 更新
     * @param {Object} updatedPoint
     */
    updatePoint(updated) {
        debugLog(4, `PointsStore.updatePoint() が呼び出されました。updatedPoint.id=${updated?.id}`);
        try {
            const existing = points.get(updated.id);
            if (!existing) {
                debugLog(3, `PointsStore.updatePoint() - 更新対象の点情報が見つかりません。ID: ${updated?.id}`);
                return;
            }

            // 同様に "points" の数に合わせて既存の vertexIds を調整
            const ptsArr = (updated.points && Array.isArray(updated.points)) ? updated.points : existing.points || [];
            while (existing.vertexIds.length < ptsArr.length) {
                const newVid = generateVertexId();
                existing.vertexIds.push(newVid);
                VerticesStore.addVertex({ id: newVid, x: 0, y: 0 });
            }
            while (existing.vertexIds.length > ptsArr.length) {
                existing.vertexIds.pop();
            }

            // 頂点を更新
            for (let i = 0; i < ptsArr.length; i++) {
                const coord = ptsArr[i];
                const vId = existing.vertexIds[i];
                VerticesStore.updateVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
            }

            existing.points = existing.vertexIds.map(vId => {
                const vx = VerticesStore.getById(vId);
                return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
            });

            // プロパティなどを上書き
            if (updated.properties) {
                existing.properties = updated.properties;
            }
            if (updated.name !== undefined) existing.name = updated.name;
            if (updated.description !== undefined) existing.description = updated.description;
            if (updated.year !== undefined) existing.year = updated.year;

            points.set(existing.id, existing);
        } catch (error) {
            debugLog(1, `PointsStore.updatePoint() でエラー発生: ${error}`);
            showNotification('点情報の更新中にエラーが発生しました。', 'error');
        }
    },

    /**
     * ポイントを削除
     * @param {number|string} id
     */
    removePoint(id) {
        debugLog(4, `PointsStore.removePoint() が呼び出されました。id=${id}`);
        try {
            points.delete(id);
        } catch (error) {
            debugLog(1, `PointsStore.removePoint() でエラー発生: ${error}`);
            showNotification('点情報の削除中にエラーが発生しました。', 'error');
        }
    },

    getById(id) {
        debugLog(4, `PointsStore.getById() が呼び出されました。id=${id}`);
        try {
            return points.get(id) || null;
        } catch (error) {
            debugLog(1, `PointsStore.getById() でエラー発生: ${error}`);
            return null;
        }
    },

    clear() {
        debugLog(3, 'PointsStore.clear() が呼び出されました。');
        points.clear();
    }
};

export default PointsStore;
