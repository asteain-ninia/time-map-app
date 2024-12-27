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
    debugLog(4, 'getPropertiesForYear() が呼び出されました。');
    try {
        if (!propertiesArray || propertiesArray.length === 0) {
            return null;
        }

        const validProperties = propertiesArray.filter(prop => typeof prop.year === 'number' && !isNaN(prop.year));
        if (validProperties.length === 0) {
            return null;
        }

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
        debugLog(1, `getPropertiesForYear() でエラー発生: ${error}`);
        showNotification('プロパティ取得中にエラーが発生しました。', 'error');
        return null;
    }
}
