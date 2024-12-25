// src/dataStore/pointsStore.js

import { getPropertiesForYear } from '../utils/index.js';
import stateManager from '../../stateManager.js';

/**
 * ポイントを保持するローカル変数
 */
const points = new Map();

/**
 * ポイントに関する操作をまとめたモジュール
 */
const PointsStore = {
    /**
     * 指定年に表示すべきポイント一覧を取得
     * @param {number} year 
     * @returns {Array} 年がyear以下のポイントのみ返す
     */
    getPoints(year) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('PointsStore.getPoints() が呼び出されました。年:', year);
            }

            return Array.from(points.values())
                .map(point => {
                    if (stateManager.getState().debugMode) {
                        console.log('処理中のポイント:', point);
                    }

                    let properties = null;

                    if (point.properties && Array.isArray(point.properties)) {
                        properties = getPropertiesForYear(point.properties, year);
                    } else {
                        // 従来の year, name, description が直接付与されている場合
                        if (point.year !== undefined) {
                            properties = {
                                year: point.year,
                                name: point.name,
                                description: point.description,
                            };
                        } else {
                            properties = {
                                year: 0,
                                name: point.name || '不明なポイント',
                                description: point.description || '',
                            };
                        }
                    }

                    // points配列がなければ x, y を配列に変換
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
            console.error('PointsStore.getPoints 関数内でエラー:', error);
            return [];
        }
    },

    /**
     * すべてのポイント(年を考慮せず)を取得
     */
    getAllPoints() {
        try {
            if (stateManager.getState().debugMode) {
                console.info('PointsStore.getAllPoints() が呼び出されました。');
            }
            return Array.from(points.values());
        } catch (error) {
            console.error('PointsStore.getAllPoints 関数内でエラー:', error);
            return [];
        }
    },

    /**
     * ポイントを追加
     * @param {Object} point 
     */
    addPoint(point) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('PointsStore.addPoint() が呼び出されました。ID:', point.id);
                console.log('追加されるポイント:', point);
            }

            if (!point.properties || !Array.isArray(point.properties)) {
                point.properties = [];
            }

            // points配列がなければ作る
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
            console.error('PointsStore.addPoint エラー:', error);
        }
    },

    /**
     * ポイントを更新
     * @param {Object} updatedPoint 
     */
    updatePoint(updatedPoint) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('PointsStore.updatePoint() ポイントID:', updatedPoint.id);
            }
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
                console.warn('更新対象のポイントが見つかりません。ID:', updatedPoint.id);
            }
        } catch (error) {
            console.error('PointsStore.updatePoint エラー:', error);
        }
    },

    /**
     * ポイントを削除
     * @param {number|string} id 
     */
    removePoint(id) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('PointsStore.removePoint() ID:', id);
            }
            points.delete(id);
        } catch (error) {
            console.error('PointsStore.removePoint エラー:', error);
        }
    },

    /**
     * 全ポイントをクリア
     */
    clear() {
        points.clear();
    }
};

export default PointsStore;
