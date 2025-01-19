// src/dataStore/linesStore.js

import { getPropertiesForYear } from '../utils/index.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';
import VerticesStore from './verticesStore.js';

const lines = new Map();

const LinesStore = {

    getLines(year) {
        debugLog(4, `LinesStore.getLines() が呼び出されました。year=${year}`);
        try {
            return Array.from(lines.values())
                .map(line => {
                    let properties = null;
                    if (line.properties && Array.isArray(line.properties)) {
                        properties = getPropertiesForYear(line.properties, year);
                    } else {
                        if (line.year !== undefined) {
                            properties = {
                                year: line.year,
                                name: line.name,
                                description: line.description,
                            };
                        } else {
                            properties = {
                                year: 0,
                                name: line.name || '不明な線情報',
                                description: line.description || '',
                            };
                        }
                    }

                    // 頂点ストアから座標取得
                    let coords = [];
                    if (line.vertexIds && Array.isArray(line.vertexIds)) {
                        coords = line.vertexIds.map(vId => {
                            const vertex = VerticesStore.getById(vId);
                            if (vertex) {
                                return { x: vertex.x, y: vertex.y };
                            }
                            return { x: 0, y: 0 };
                        });
                    }

                    if (properties) {
                        return {
                            id: line.id,
                            vertexIds: line.vertexIds,
                            properties: line.properties,
                            originalLine: line,
                            // Renderer等が使うために "points" として展開
                            points: coords,
                            ...properties,
                        };
                    } else {
                        return null;
                    }
                })
                .filter(line => line !== null);
        } catch (error) {
            debugLog(1, `LinesStore.getLines() でエラー発生: ${error}`);
            showNotification('線情報の取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    getAllLines() {
        debugLog(4, `LinesStore.getAllLines() が呼び出されました。`);
        try {
            return Array.from(lines.values());
        } catch (error) {
            debugLog(1, `LinesStore.getAllLines() でエラー発生: ${error}`);
            showNotification('線情報の一覧取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    /**
     * 線を追加
     * - line.vertexIds に頂点が指定されていなければ、
     *   line.points (従来)や line.x,line.y を使い、VerticesStoreへ登録
     */
    addLine(line) {
        debugLog(4, `LinesStore.addLine() が呼び出されました。line.id=${line?.id}`);
        try {
            if (!line.properties || !Array.isArray(line.properties)) {
                line.properties = [];
            }

            if (!line.vertexIds || !Array.isArray(line.vertexIds) || line.vertexIds.length === 0) {
                // fallback: line.pointsから頂点作成
                if (line.points && Array.isArray(line.points) && line.points.length > 0) {
                    line.vertexIds = line.points.map(coord => {
                        const newVid = Date.now() + Math.random();
                        VerticesStore.addVertex({ id: newVid, x: coord.x || 0, y: coord.y || 0 });
                        return newVid;
                    });
                    delete line.points;
                } else {
                    // 空なら とりあえず2頂点の(0,0)を確保などが考えられるが、ここでは省略
                    line.vertexIds = [];
                }
            }

            lines.set(line.id, line);
        } catch (error) {
            debugLog(1, `LinesStore.addLine() でエラー発生: ${error}`);
            showNotification('線情報の追加中にエラーが発生しました。', 'error');
        }
    },

    updateLine(updatedLine) {
        debugLog(4, `LinesStore.updateLine() が呼び出されました。updatedLine.id=${updatedLine?.id}`);
        try {
            const existing = lines.get(updatedLine.id);
            if (!existing) {
                debugLog(3, `LinesStore.updateLine() - 更新対象の線情報が見つかりません。ID: ${updatedLine?.id}`);
                console.warn('更新対象の線情報が見つかりません。ID:', updatedLine.id);
                return;
            }

            // geometry更新 (updatedLine.points → 頂点更新) の例
            if (updatedLine.points && Array.isArray(updatedLine.points)) {
                existing.vertexIds = updatedLine.points.map((coord, idx) => {
                    let vId;
                    if (existing.vertexIds && existing.vertexIds[idx]) {
                        vId = existing.vertexIds[idx];
                        VerticesStore.updateVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
                    } else {
                        vId = Date.now() + Math.random();
                        VerticesStore.addVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
                    }
                    return vId;
                });
                delete updatedLine.points;
            }

            // その他のフィールド上書き
            for (const key in updatedLine) {
                if (key === 'id' || key === 'vertexIds') continue;
                existing[key] = updatedLine[key];
            }

            lines.set(existing.id, existing);
        } catch (error) {
            debugLog(1, `LinesStore.updateLine() でエラー発生: ${error}`);
            showNotification('線情報の更新中にエラーが発生しました。', 'error');
        }
    },

    removeLine(id) {
        debugLog(4, `LinesStore.removeLine() が呼び出されました。id=${id}`);
        try {
            lines.delete(id);
            // 頂点削除は今後の共有機能次第で実装予定
        } catch (error) {
            debugLog(1, `LinesStore.removeLine() でエラー発生: ${error}`);
            showNotification('線情報の削除中にエラーが発生しました。', 'error');
        }
    },

    /**
     * IDを指定してLineオブジェクトを取得
     */
    getById(id) {
        debugLog(4, `LinesStore.getById() が呼び出されました。id=${id}`);
        try {
            if (!lines.has(id)) {
                return null;
            }
            return lines.get(id);
        } catch (error) {
            debugLog(1, `LinesStore.getById() でエラー発生: ${error}`);
            return null;
        }
    },

    clear() {
        debugLog(3, 'LinesStore.clear() が呼び出されました。');
        lines.clear();
    }
};

export default LinesStore;
