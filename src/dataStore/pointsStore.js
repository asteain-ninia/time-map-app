// src/dataStore/pointsStore.js
/****************************************************
 * 点情報のストア
 *
 * 修正点:
 *   - getPoints(year) が返すオブジェクトから
 *     originalPoint を除去し、循環参照を回避。
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
                    // 年に応じたプロパティ
                    let properties = null;
                    if (point.properties && Array.isArray(point.properties)) {
                        properties = getPropertiesForYear(point.properties, year);
                    } else {
                        if (point.year !== undefined) {
                            properties = {
                                year: point.year,
                                name: point.name,
                                description: point.description,
                            };
                        } else {
                            properties = {
                                year: 0,
                                name: point.name || '不明な点情報',
                                description: point.description || '',
                            };
                        }
                    }

                    // 頂点座標
                    let coords = [];
                    if (point.vertexIds && Array.isArray(point.vertexIds)) {
                        coords = point.vertexIds.map(vId => {
                            const vertex = VerticesStore.getById(vId);
                            if (vertex) {
                                return { x: vertex.x, y: vertex.y };
                            }
                            return { x: 0, y: 0 };
                        });
                    }

                    if (properties) {
                        return {
                            id: point.id,
                            vertexIds: point.vertexIds,
                            properties: point.properties,
                            // 循環参照を避けるため originalPoint は付与しない
                            points: coords,
                            ...properties,
                        };
                    } else {
                        return null;
                    }
                })
                .filter(p => p !== null);
        } catch (error) {
            debugLog(1, `PointsStore.getPoints() でエラー発生: ${error}`);
            showNotification('点情報の取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    /**
     * すべてのポイント(年を考慮せず)を取得
     */
    getAllPoints() {
        debugLog(4, `PointsStore.getAllPoints() が呼び出されました。`);
        try {
            return Array.from(points.values());
        } catch (error) {
            debugLog(1, `PointsStore.getAllPoints() でエラー発生: ${error}`);
            showNotification('点情報の一覧取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    /**
     * ポイントを追加
     * - 受け取ったpointオブジェクトが x,y や point.points などを持っている場合は頂点ストアへ登録し、
     *   point.vertexIds に変換してから保存する。
     * @param {Object} point
     */
    addPoint(point) {
        debugLog(4, `PointsStore.addPoint() が呼び出されました。point.id=${point?.id}`);
        try {
            // プロパティ配列がなければ空配列
            if (!point.properties || !Array.isArray(point.properties)) {
                point.properties = [];
            }

            // geometry変換
            if (!point.vertexIds || !Array.isArray(point.vertexIds) || point.vertexIds.length === 0) {
                if (point.points && Array.isArray(point.points) && point.points.length > 0) {
                    point.vertexIds = point.points.map(coord => {
                        const newId = Date.now() + Math.random();
                        VerticesStore.addVertex({ id: newId, x: coord.x || 0, y: coord.y || 0 });
                        return newId;
                    });
                    delete point.points;
                } else if (point.x !== undefined && point.y !== undefined) {
                    const newId = Date.now() + Math.random();
                    VerticesStore.addVertex({ id: newId, x: point.x, y: point.y });
                    point.vertexIds = [newId];
                    delete point.x;
                    delete point.y;
                } else {
                    // 完全に座標情報がなければ、とりあえず(0,0)を1つ作成
                    const newId = Date.now() + Math.random();
                    VerticesStore.addVertex({ id: newId, x: 0, y: 0 });
                    point.vertexIds = [newId];
                }
            }

            points.set(point.id, point);
        } catch (error) {
            debugLog(1, `PointsStore.addPoint() でエラー発生: ${error}`);
            showNotification('点情報の追加中にエラーが発生しました。', 'error');
        }
    },

    /**
     * ポイントを更新
     * - 頂点座標の変更があった場合は、VerticesStore.updateVertex() などで反映する。
     * - ただし、単純化のためにここでは "point.x, point.y" の再指定や "point.points" の再指定があった場合のみ対応。
     *   新しい頂点の追加などは特別に行っていない。
     * @param {Object} updatedPoint
     */
    updatePoint(updatedPoint) {
        debugLog(4, `PointsStore.updatePoint() が呼び出されました。updatedPoint.id=${updatedPoint?.id}`);
        try {
            const existing = points.get(updatedPoint.id);
            if (!existing) {
                debugLog(3, `PointsStore.updatePoint() - 更新対象の点情報が見つかりません。ID: ${updatedPoint?.id}`);
                console.warn('更新対象の点情報が見つかりません。ID:', updatedPoint.id);
                return;
            }

            // geometry
            if (updatedPoint.points && Array.isArray(updatedPoint.points)) {
                existing.vertexIds = updatedPoint.points.map((coord, idx) => {
                    let vId;
                    if (existing.vertexIds[idx]) {
                        vId = existing.vertexIds[idx];
                        VerticesStore.updateVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
                    } else {
                        vId = Date.now() + Math.random();
                        VerticesStore.addVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
                    }
                    return vId;
                });
                delete updatedPoint.points;
            } else if (updatedPoint.x !== undefined && updatedPoint.y !== undefined) {
                let targetVid;
                if (existing.vertexIds && existing.vertexIds.length > 0) {
                    targetVid = existing.vertexIds[0];
                } else {
                    targetVid = Date.now() + Math.random();
                    existing.vertexIds = [targetVid];
                }
                VerticesStore.updateVertex({ id: targetVid, x: updatedPoint.x, y: updatedPoint.y });
                delete updatedPoint.x;
                delete updatedPoint.y;
            }

            // プロパティなどを上書き
            for (const key in updatedPoint) {
                if (key === 'id' || key === 'vertexIds') continue;
                existing[key] = updatedPoint[key];
            }

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

    /**
     * IDを指定してPointオブジェクトを取得 (なければnull)
     */
    getById(id) {
        debugLog(4, `PointsStore.getById() が呼び出されました。id=${id}`);
        try {
            if (!points.has(id)) {
                return null;
            }
            return points.get(id);
        } catch (error) {
            debugLog(1, `PointsStore.getById() でエラー発生: ${error}`);
            return null;
        }
    },

    /**
     * 全ポイント削除
     */
    clear() {
        debugLog(3, 'PointsStore.clear() が呼び出されました。');
        points.clear();
    }
};

export default PointsStore;
