// src/utils/timeUtils.js

/**
 * 複数のプロパティ配列から「指定年以下」のうち最も近い年のプロパティを取得する
 * @param {Array} propertiesArray - {year, name, description, ...}などを持つオブジェクト配列
 * @param {number} year - 取得したい時点の年
 * @returns {Object|null} - year が該当するプロパティオブジェクト、または null
 */
export function getPropertiesForYear(propertiesArray, year) {
    try {
        if (!propertiesArray || propertiesArray.length === 0) return null;

        // 数値 year を持つものだけに限定
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
        return null;
    }
}
