// src/dataStore/linesStore.js

import { getPropertiesForYear } from '../utils/index.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';
import VerticesStore from './verticesStore.js';

const lines = new Map();

const LinesStore = {

    /**
     * 年指定でラインリストを取得
     * 返却形: [ { id, points: [{x,y},..], properties, ... } ]
     */
    getLines(year) {
        debugLog(4, `LinesStore.getLines() が呼び出されました。year=${year}`);
        try {
            return Array.from(lines.values())
                .map(line => {
                    // 年に応じたproperties
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

                    // 頂点配列を構築
                    let pts = [];
                    if (line.vertexIds && Array.isArray(line.vertexIds)) {
                        pts = line.vertexIds.map(vId => {
                            const v = VerticesStore.getById(vId);
                            if (v) {
                                return { x: v.x, y: v.y };
                            } else {
                                return null;
                            }
                        }).filter(p => p !== null);
                    }

                    if (properties) {
                        return {
                            id: line.id,
                            points: pts,
                            properties: line.properties,
                            originalLine: line,
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
     * addLine
     * @param {object} line { id, vertexIds, properties, ... } 
     *  もし従来の line.points が来たら対応不可(後方互換切った)
     */
    addLine(line) {
        debugLog(4, `LinesStore.addLine() が呼び出されました。line.id=${line?.id}`);
        try {
            if (!line.vertexIds || !Array.isArray(line.vertexIds)) {
                line.vertexIds = [];
            }
            lines.set(line.id, line);
        } catch (error) {
            debugLog(1, `LinesStore.addLine() でエラー発生: ${error}`);
            showNotification('線情報の追加中にエラーが発生しました。', 'error');
        }
    },

    /**
     * updateLine
     * @param {object} updatedLine { id, vertexIds, properties, ... }
     *  もし頂点座標を直接(updatedLine.points)で持ち込まれても対応しない方針
     */
    updateLine(updatedLine) {
        debugLog(4, `LinesStore.updateLine() が呼び出されました。updatedLine.id=${updatedLine?.id}`);
        try {
            if (lines.has(updatedLine.id)) {
                const existing = lines.get(updatedLine.id);
                // merge
                Object.assign(existing, updatedLine);
                lines.set(updatedLine.id, existing);
            } else {
                debugLog(3, `LinesStore.updateLine() - 更新対象の線情報が見つかりません。ID: ${updatedLine?.id}`);
                console.warn('更新対象の線情報が見つかりません。ID:', updatedLine.id);
            }
        } catch (error) {
            debugLog(1, `LinesStore.updateLine() でエラー発生: ${error}`);
            showNotification('線情報の更新中にエラーが発生しました。', 'error');
        }
    },

    removeLine(id) {
        debugLog(4, `LinesStore.removeLine() が呼び出されました。id=${id}`);
        try {
            if (lines.has(id)) {
                const obj = lines.get(id);
                // 頂点を一括削除（完全に消す）
                if (obj.vertexIds && Array.isArray(obj.vertexIds)) {
                    obj.vertexIds.forEach(vId => {
                        // Lineから参照している頂点を削除
                        VerticesStore.removeVertex(vId);
                    });
                }
                lines.delete(id);
            }
        } catch (error) {
            debugLog(1, `LinesStore.removeLine() でエラー発生: ${error}`);
            showNotification('線情報の削除中にエラーが発生しました。', 'error');
        }
    },

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
