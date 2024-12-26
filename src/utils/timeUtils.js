// src/utils/timeUtils.js

import { showNotification } from '../ui/forms.js';
import { debugLog } from './logger.js';

/**
 * 複数のプロパティ配列から「指定年以下」のうち最も近い年のプロパティを取得する
 * @param {Array} propertiesArray - {year, name, description, ...}を持つオブジェクト配列
 * @param {number} year - 取得したい時点の年
 * @returns {Object|null} - year が該当するプロパティオブジェクト、または null
 */
export function getPropertiesForYear(propertiesArray, year) {
    try {
        debugLog(4, 'getPropertiesForYear 関数が呼び出されました。');
        if (!propertiesArray || propertiesArray.length === 0) return null;

        const validProperties = propertiesArray.filter(prop => typeof prop.year === 'number' && !isNaN(prop.year));
        if (validProperties.length === 0) return null;

        // 昇順ソート
        const sortedProperties = validProperties.sort((a, b) => a.year - b.year);

        let currentProperties = null;
        for (const prop of sortedProperties) {
            if (prop.year <= year) {
                currentProperties = prop;
            } else {
                break;
            }
        }
        return currentProperties;
    } catch (error) {
        console.error('getPropertiesForYear 関数内でエラー:', error);
        showNotification('プロパティ取得中にエラーが発生しました。', 'error');
        return null;
    }
}
