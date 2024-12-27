// src/dataStore/pointsStore.js

import { getPropertiesForYear } from '../utils/index.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';

const points = new Map();

/**
 * 点情報に関する操作をまとめたモジュール
 */
const PointsStore = {

    /**
     * 指定年に表示すべきポイント一覧を取得
     * @param {number} year
     * @returns {Array} 年がyear以下のポイントのみ返す
     */
    getPoints(year) {
        debugLog(4, `PointsStore.getPoints() が呼び出されました。year=${year}`);
        try {
            return Array.from(points.values())
                .map(point => {
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
                    if (!point.points || !Array.isArray(point.points) || point.points.length === 0) {
                        if (point.x !== undefined && point.y !== undefined) {
                            point.points = [{ x: point.x, y: point.y }];
                        } else {
                            point.points = [{ x: 0, y: 0 }];
                        }
                    }
                    if (properties) {
                        return {
                            id: point.id,
                            points: point.points,
                            properties: point.properties,
                            originalPoint: point,
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
     * @param {Object} point
     */
    addPoint(point) {
        debugLog(4, `PointsStore.addPoint() が呼び出されました。point.id=${point?.id}`);
        try {
            if (!point.properties || !Array.isArray(point.properties)) {
                point.properties = [];
            }
            if (!point.points || !Array.isArray(point.points) || point.points.length === 0) {
                if (point.x !== undefined && point.y !== undefined) {
                    point.points = [{ x: point.x, y: point.y }];
                    delete point.x;
                    delete point.y;
                } else {
                    point.points = [{ x: 0, y: 0 }];
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
     * @param {Object} updatedPoint
     */
    updatePoint(updatedPoint) {
        debugLog(4, `PointsStore.updatePoint() が呼び出されました。updatedPoint.id=${updatedPoint?.id}`);
        try {
            if (points.has(updatedPoint.id)) {
                if (!updatedPoint.points || !Array.isArray(updatedPoint.points) || updatedPoint.points.length === 0) {
                    if (updatedPoint.x !== undefined && updatedPoint.y !== undefined) {
                        updatedPoint.points = [{ x: updatedPoint.x, y: updatedPoint.y }];
                        delete updatedPoint.x;
                        delete updatedPoint.y;
                    } else {
                        updatedPoint.points = [{ x: 0, y: 0 }];
                    }
                }
                points.set(updatedPoint.id, updatedPoint);
            } else {
                debugLog(3, `PointsStore.updatePoint() - 更新対象の点情報が見つかりません。ID: ${updatedPoint?.id}`);
                console.warn('更新対象の点情報が見つかりません。ID:', updatedPoint.id);
            }
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

    clear() {
        debugLog(3, 'PointsStore.clear() が呼び出されました。');
        points.clear();
    }
};

export default PointsStore;
