// src/dataStore/polygonsStore.js

import { getPropertiesForYear } from '../utils/index.js';
import stateManager from '../state/index.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';

const polygons = new Map();

const PolygonsStore = {
    getPolygons(year) {
        try {
            debugLog(4, '面情報を年に応じて取得します。');
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
                    if (properties) {
                        return {
                            id: polygon.id,
                            points: polygon.points,
                            properties: polygon.properties,
                            originalPolygon: polygon,
                            ...properties,
                        };
                    } else {
                        return null;
                    }
                })
                .filter(pg => pg !== null);
        } catch (error) {
            console.error('PolygonsStore.getPolygons エラー:', error);
            showNotification('面情報の取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    getAllPolygons() {
        try {
            debugLog(4, 'すべての面情報を取得します。');
            return Array.from(polygons.values());
        } catch (error) {
            console.error('PolygonsStore.getAllPolygons エラー:', error);
            showNotification('面情報の一覧取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    addPolygon(polygon) {
        try {
            debugLog(3, '面情報を追加します。');
            polygons.set(polygon.id, polygon);
        } catch (error) {
            console.error('PolygonsStore.addPolygon エラー:', error);
            showNotification('面情報の追加中にエラーが発生しました。', 'error');
        }
    },

    updatePolygon(updatedPolygon) {
        try {
            debugLog(4, '面情報を更新します。');
            if (polygons.has(updatedPolygon.id)) {
                polygons.set(updatedPolygon.id, updatedPolygon);
            } else {
                console.warn('更新対象の面情報が見つかりません。ID:', updatedPolygon.id);
            }
        } catch (error) {
            console.error('PolygonsStore.updatePolygon エラー:', error);
            showNotification('面情報の更新中にエラーが発生しました。', 'error');
        }
    },

    removePolygon(id) {
        try {
            debugLog(3, '面情報を削除します。');
            polygons.delete(id);
        } catch (error) {
            console.error('PolygonsStore.removePolygon エラー:', error);
            showNotification('面情報の削除中にエラーが発生しました。', 'error');
        }
    },

    clear() {
        polygons.clear();
    }
};

export default PolygonsStore;
