// src/dataStore/linesStore.js

import { getPropertiesForYear } from '../utils/index.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';

const lines = new Map();

const LinesStore = {
    getLines(year) {
        try {
            debugLog(4, '線情報を年に応じて取得します。');
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
            console.error('LinesStore.getLines エラー:', error);
            showNotification('線情報の取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    getAllLines() {
        try {
            debugLog(4, 'すべての線情報を取得します。');
            return Array.from(lines.values());
        } catch (error) {
            console.error('LinesStore.getAllLines エラー:', error);
            showNotification('線情報の一覧取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    addLine(line) {
        try {
            debugLog(3, '線情報を追加します。');
            lines.set(line.id, line);
        } catch (error) {
            console.error('LinesStore.addLine エラー:', error);
            showNotification('線情報の追加中にエラーが発生しました。', 'error');
        }
    },

    updateLine(updatedLine) {
        try {
            debugLog(4, '線情報を更新します。');
            if (lines.has(updatedLine.id)) {
                lines.set(updatedLine.id, updatedLine);
            } else {
                console.warn('更新対象の線情報が見つかりません。ID:', updatedLine.id);
            }
        } catch (error) {
            console.error('LinesStore.updateLine エラー:', error);
            showNotification('線情報の更新中にエラーが発生しました。', 'error');
        }
    },

    removeLine(id) {
        try {
            debugLog(3, '線情報を削除します。');
            lines.delete(id);
        } catch (error) {
            console.error('LinesStore.removeLine エラー:', error);
            showNotification('線情報の削除中にエラーが発生しました。', 'error');
        }
    },

    clear() {
        lines.clear();
    }
};

export default LinesStore;
