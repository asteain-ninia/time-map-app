// src/dataStore/linesStore.js

import { getPropertiesForYear } from '../../utils.js';
import stateManager from '../../stateManager.js';

const lines = new Map();

const LinesStore = {
    getLines(year) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('LinesStore.getLines() 年:', year);
            }

            return Array.from(lines.values())
                .map(line => {
                    console.log('処理中のライン:', line);

                    let properties = null;
                    if (line.properties && Array.isArray(line.properties)) {
                        properties = getPropertiesForYear(line.properties, year);
                    } else {
                        // 直接 year, name, description を持つ従来形式
                        if (line.year !== undefined) {
                            properties = {
                                year: line.year,
                                name: line.name,
                                description: line.description,
                            };
                        } else {
                            properties = {
                                year: 0,
                                name: line.name || '不明なライン',
                                description: line.description || '',
                            };
                        }
                    }

                    console.log('取得されたプロパティ:', properties);

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
            return [];
        }
    },

    getAllLines() {
        try {
            if (stateManager.getState().debugMode) {
                console.info('LinesStore.getAllLines() が呼び出されました。');
            }
            return Array.from(lines.values());
        } catch (error) {
            console.error('LinesStore.getAllLines エラー:', error);
            return [];
        }
    },

    addLine(line) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('LinesStore.addLine() ラインID:', line.id);
            }
            lines.set(line.id, line);
        } catch (error) {
            console.error('LinesStore.addLine エラー:', error);
        }
    },

    updateLine(updatedLine) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('LinesStore.updateLine() ラインID:', updatedLine.id);
            }
            if (lines.has(updatedLine.id)) {
                lines.set(updatedLine.id, updatedLine);
            } else {
                console.warn('更新対象のラインが見つかりません。ID:', updatedLine.id);
            }
        } catch (error) {
            console.error('LinesStore.updateLine エラー:', error);
        }
    },

    removeLine(id) {
        try {
            if (stateManager.getState().debugMode) {
                console.info('LinesStore.removeLine() ID:', id);
            }
            lines.delete(id);
        } catch (error) {
            console.error('LinesStore.removeLine エラー:', error);
        }
    },

    clear() {
        lines.clear();
    }
};

export default LinesStore;
