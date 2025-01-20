// src/dataStore/pointsStore.js
/****************************************************
 * 点情報ストア
 *
 * 修正点:
 *   1) getAllPointsWithCoords() 新設:
 *      -> ストア内部データを走査し、各頂点の x,y を取得して
 *         "points: [...]" として付与した完全版のPointオブジェクトを返す
 *   2) addPoint / updatePoint 時に "points" フィールドも保持し、
 *      再読み込み後も geometry を持つように。
 ****************************************************/

import { getPropertiesForYear } from '../utils/index.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';
import VerticesStore from './verticesStore.js';

const points = new Map();

/**
 * 点情報に関する操作をまとめたモジュール
 * - geometry (座標) は頂点ストア(VerticesStore)で一元管理。
 * - pointオブジェクトは { id, properties:[], vertexIds:[] } などを持ち、
 *   座標は頂点IDを介して取得・更新する。
 */
const PointsStore = {

    /**
     * 指定年に表示すべきポイント一覧を取得
     * @param {number} year
     * @returns {Array} 年がyear以下のポイントのみ返す(geometryは {x,y}配列として付与)
     */
    getPoints(year) {
        debugLog(4, `PointsStore.getPoints() が呼び出されました。year=${year}`);
        try {
            return Array.from(points.values())
                .map(point => {
                    // プロパティ
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

                    // 座標
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
                // vertexIdsから座標生成
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
            if (!point.properties) {
                point.properties = [];
            }

            // geometry: vertexIds が無ければ作成
            if (!point.vertexIds || !Array.isArray(point.vertexIds) || point.vertexIds.length === 0) {
                if (point.points && Array.isArray(point.points) && point.points.length > 0) {
                    point.vertexIds = point.points.map(coord => {
                        const newId = Date.now() + Math.random();
                        VerticesStore.addVertex({ id: newId, x: coord.x || 0, y: coord.y || 0 });
                        return newId;
                    });
                } else {
                    // fallback
                    const newId = Date.now() + Math.random();
                    VerticesStore.addVertex({ id: newId, x: 0, y: 0 });
                    point.vertexIds = [newId];
                }
            }

            // pointsフィールドを同期
            if (!point.points || !Array.isArray(point.points) || point.points.length === 0) {
                point.points = point.vertexIds.map(vid => {
                    const vx = VerticesStore.getById(vid);
                    return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
                });
            }

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

            // 座標反映
            if (updated.points && Array.isArray(updated.points)) {
                // 頂点ストア更新
                existing.vertexIds = updated.points.map((coord, idx) => {
                    let vId = existing.vertexIds[idx];
                    if (!vId) {
                        vId = Date.now() + Math.random();
                        existing.vertexIds.push(vId);
                    }
                    VerticesStore.updateVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
                    return vId;
                });
            }

            // points保持
            existing.points = updated.points || existing.points;

            // properties
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
            // 頂点は共有検討中なので残す
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
