// src/dataStore/pointsStore.js

import { getPropertiesForYear } from '../utils/index.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';
import VerticesStore from './verticesStore.js';

/**
 * 点情報に関する操作をまとめたモジュール
 * - point構造: { id, vertexIds: [vertexId], properties: [...], ... }
 */
const points = new Map();

const PointsStore = {

    /**
     * 指定年に表示すべきポイント一覧を取得
     * @param {number} year
     * @returns {Array} 
     *  形: [ { id, x, y, properties, originalPoint, ... } ]
     */
    getPoints(year) {
        debugLog(4, `PointsStore.getPoints() が呼び出されました。year=${year}`);
        try {
            return Array.from(points.values())
                .map(point => {
                    // 年に応じたproperties
                    let properties = null;
                    if (point.properties && Array.isArray(point.properties)) {
                        properties = getPropertiesForYear(point.properties, year);
                    } else {
                        // 従来の year/name/desc が直入れされている場合
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

                    // 頂点の取得 (pointsStoreでは基本1個のvertex)
                    let x = 0;
                    let y = 0;
                    if (point.vertexIds && point.vertexIds.length > 0) {
                        const vId = point.vertexIds[0];
                        const vertexObj = VerticesStore.getById(vId);
                        if (vertexObj) {
                            x = vertexObj.x;
                            y = vertexObj.y;
                        }
                    }

                    return {
                        id: point.id,
                        x,
                        y,
                        properties: point.properties,
                        originalPoint: point,
                        ...properties,   // spread で name/year/description を上書き
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
     * 全ポイント(年を考慮しない)
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
     * ポイント追加
     * @param {Object} point - { id, vertexIds?:string[], x?:number, y?:number, properties?:[] }
     */
    addPoint(point) {
        debugLog(4, `PointsStore.addPoint() が呼び出されました。point.id=${point?.id}`);
        try {
            // プロパティ配列がなければ空配列
            if (!point.properties || !Array.isArray(point.properties)) {
                point.properties = [];
            }

            // vertexIds がない、または空なら新規頂点を作る
            if (!point.vertexIds || !Array.isArray(point.vertexIds) || point.vertexIds.length === 0) {
                // x,y が指定されていれば使う
                let vx = point.x !== undefined ? point.x : 0;
                let vy = point.y !== undefined ? point.y : 0;
                const vId = VerticesStore.addVertex({ x: vx, y: vy });
                point.vertexIds = [vId];
                // 余計な x,y フィールドを削除
                delete point.x;
                delete point.y;
            }

            points.set(point.id, point);
        } catch (error) {
            debugLog(1, `PointsStore.addPoint() でエラー発生: ${error}`);
            showNotification('点情報の追加中にエラーが発生しました。', 'error');
        }
    },

    /**
     * ポイントを更新
     * @param {Object} updatedPoint - { id, vertexIds, properties, ... }
     *   もし (x,y) が入っていれば、その座標でVerticesStoreの頂点を更新する
     */
    updatePoint(updatedPoint) {
        debugLog(4, `PointsStore.updatePoint() が呼び出されました。updatedPoint.id=${updatedPoint?.id}`);
        try {
            if (!points.has(updatedPoint.id)) {
                debugLog(3, `PointsStore.updatePoint() - 更新対象の点情報が見つかりません。ID: ${updatedPoint?.id}`);
                console.warn('更新対象の点情報が見つかりません。ID:', updatedPoint.id);
                return;
            }
            const existing = points.get(updatedPoint.id);

            // 頂点更新 (もし x,y が指定されていれば)
            if (updatedPoint.x !== undefined && updatedPoint.y !== undefined) {
                if (existing.vertexIds && existing.vertexIds.length > 0) {
                    const vId = existing.vertexIds[0];
                    VerticesStore.updateVertex({ id: vId, x: updatedPoint.x, y: updatedPoint.y });
                }
                // 使い終わったら消す
                delete updatedPoint.x;
                delete updatedPoint.y;
            }

            // プロパティを合体
            Object.assign(existing, updatedPoint);

            // もし updatedPoint.properties が配列で渡されていたら、それを上書き
            // あるいは、追加をどう扱うかは状況次第
            // （ここでは Object.assign で十分）
            points.set(updatedPoint.id, existing);

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
            if (points.has(id)) {
                const obj = points.get(id);
                // 頂点削除（1つだけのはず）
                if (obj.vertexIds && Array.isArray(obj.vertexIds)) {
                    obj.vertexIds.forEach(vId => {
                        VerticesStore.removeVertex(vId);
                    });
                }
                points.delete(id);
            }
        } catch (error) {
            debugLog(1, `PointsStore.removePoint() でエラー発生: ${error}`);
            showNotification('点情報の削除中にエラーが発生しました。', 'error');
        }
    },

    /**
     * ID指定でPointオブジェクトを取得
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

    clear() {
        debugLog(3, 'PointsStore.clear() が呼び出されました。');
        points.clear();
    }
};

export default PointsStore;
