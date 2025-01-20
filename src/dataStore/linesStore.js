// src/dataStore/linesStore.js
/****************************************************
 * 線情報ストア
 *
 * 修正点:
 *   - getAllLinesWithCoords() 追加
 *   - addLine, updateLine 時にも "points" を同期保持
 ****************************************************/

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
                    let props = null;
                    if (line.properties && Array.isArray(line.properties)) {
                        props = getPropertiesForYear(line.properties, year);
                    } else {
                        props = {
                            year: line.year || 0,
                            name: line.name || '不明な線情報',
                            description: line.description || '',
                        };
                    }

                    let coords = [];
                    if (line.vertexIds && Array.isArray(line.vertexIds)) {
                        coords = line.vertexIds.map(vId => {
                            const vx = VerticesStore.getById(vId);
                            return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
                        });
                    }

                    if (!props) return null;
                    return {
                        id: line.id,
                        vertexIds: line.vertexIds,
                        properties: line.properties,
                        points: coords,
                        ...props
                    };
                })
                .filter(l => l !== null);
        } catch (error) {
            debugLog(1, `LinesStore.getLines() でエラー発生: ${error}`);
            showNotification('線情報の取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    /**
     * 保存用などで、すべてのラインを points付きで返す
     */
    getAllLinesWithCoords() {
        debugLog(4, 'LinesStore.getAllLinesWithCoords() が呼び出されました。');
        try {
            return Array.from(lines.values()).map(ln => {
                let coords = [];
                if (ln.vertexIds) {
                    coords = ln.vertexIds.map(vId => {
                        const vx = VerticesStore.getById(vId);
                        return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
                    });
                }
                return {
                    ...ln,
                    points: coords
                };
            });
        } catch (error) {
            debugLog(1, `LinesStore.getAllLinesWithCoords() でエラー発生: ${error}`);
            return [];
        }
    },

    addLine(line) {
        debugLog(4, `LinesStore.addLine() が呼び出されました。line.id=${line?.id}`);
        try {
            if (!line.properties) {
                line.properties = [];
            }

            if (!line.vertexIds || !Array.isArray(line.vertexIds) || line.vertexIds.length === 0) {
                if (line.points && line.points.length > 0) {
                    line.vertexIds = line.points.map(coord => {
                        const vid = Date.now() + Math.random();
                        VerticesStore.addVertex({ id: vid, x: coord.x || 0, y: coord.y || 0 });
                        return vid;
                    });
                } else {
                    line.vertexIds = [];
                }
            }

            // points フィールドも同期
            if (!line.points || !Array.isArray(line.points)) {
                line.points = line.vertexIds.map(vid => {
                    const vx = VerticesStore.getById(vid);
                    return vx ? { x: vx.x, y: vx.y } : { x: 0, y: 0 };
                });
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
                debugLog(3, `LinesStore.updateLine() - 更新対象が見つかりません。ID: ${updatedLine?.id}`);
                return;
            }

            if (updatedLine.points && Array.isArray(updatedLine.points)) {
                existing.vertexIds = updatedLine.points.map((coord, idx) => {
                    let vId = existing.vertexIds[idx];
                    if (!vId) {
                        vId = Date.now() + Math.random();
                        existing.vertexIds.push(vId);
                    }
                    VerticesStore.updateVertex({ id: vId, x: coord.x || 0, y: coord.y || 0 });
                    return vId;
                });
                existing.points = updatedLine.points;
            }

            if (updatedLine.properties) {
                existing.properties = updatedLine.properties;
            }
            if (updatedLine.name !== undefined) existing.name = updatedLine.name;
            if (updatedLine.description !== undefined) existing.description = updatedLine.description;
            if (updatedLine.year !== undefined) existing.year = updatedLine.year;

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

    getById(id) {
        debugLog(4, `LinesStore.getById() が呼び出されました。id=${id}`);
        try {
            return lines.get(id) || null;
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
