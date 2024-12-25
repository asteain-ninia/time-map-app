// src/dataStore/polygonsStore.js

import { getPropertiesForYear } from '../utils/index.js';
import stateManager from '../../stateManager.js';

const polygons = new Map();

const PolygonsStore = {
    getPolygons(year) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('PolygonsStore.getPolygons() 年:', year);
            }

            return Array.from(polygons.values())
                .map(polygon => {
                    console.log('処理中のポリゴン:', polygon);

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
                                name: polygon.name || '不明なポリゴン',
                                description: polygon.description || '',
                            };
                        }
                    }

                    console.log('取得されたプロパティ:', properties);

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
            return [];
        }
    },

    getAllPolygons() {
        try {
            if (stateManager.getState().debugMode) {
                console.info('PolygonsStore.getAllPolygons() が呼び出されました。');
            }
            return Array.from(polygons.values());
        } catch (error) {
            console.error('PolygonsStore.getAllPolygons エラー:', error);
            return [];
        }
    },

    addPolygon(polygon) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('PolygonsStore.addPolygon() ポリゴンID:', polygon.id);
            }
            polygons.set(polygon.id, polygon);
        } catch (error) {
            console.error('PolygonsStore.addPolygon エラー:', error);
        }
    },

    updatePolygon(updatedPolygon) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('PolygonsStore.updatePolygon() ポリゴンID:', updatedPolygon.id);
            }
            if (polygons.has(updatedPolygon.id)) {
                polygons.set(updatedPolygon.id, updatedPolygon);
            } else {
                console.warn('更新対象のポリゴンが見つかりません。ID:', updatedPolygon.id);
            }
        } catch (error) {
            console.error('PolygonsStore.updatePolygon エラー:', error);
        }
    },

    removePolygon(id) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('PolygonsStore.removePolygon() ID:', id);
            }
            polygons.delete(id);
        } catch (error) {
            console.error('PolygonsStore.removePolygon エラー:', error);
        }
    },

    clear() {
        polygons.clear();
    }
};

export default PolygonsStore;
