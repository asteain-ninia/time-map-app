// src/dataStore/linesStore.js

import { getPropertiesForYear } from '../utils/index.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';

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
                    if (properties) {
                        return {
                            id: line.id,
                            points: line.points,
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

    addLine(line) {
        debugLog(4, `LinesStore.addLine() が呼び出されました。line.id=${line?.id}`);
        try {
            lines.set(line.id, line);
        } catch (error) {
            debugLog(1, `LinesStore.addLine() でエラー発生: ${error}`);
            showNotification('線情報の追加中にエラーが発生しました。', 'error');
        }
    },

    updateLine(updatedLine) {
        debugLog(4, `LinesStore.updateLine() が呼び出されました。updatedLine.id=${updatedLine?.id}`);
        try {
            if (lines.has(updatedLine.id)) {
                lines.set(updatedLine.id, updatedLine);
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
            lines.delete(id);
        } catch (error) {
            debugLog(1, `LinesStore.removeLine() でエラー発生: ${error}`);
            showNotification('線情報の削除中にエラーが発生しました。', 'error');
        }
    },

    clear() {
        debugLog(3, 'LinesStore.clear() が呼び出されました。');
        lines.clear();
    }
};

export default LinesStore;
