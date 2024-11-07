// utils.js

export function getPropertiesForYear(propertiesArray, year) {
    try {
        if (!propertiesArray || propertiesArray.length === 0) return null;
        const validProperties = propertiesArray.filter(prop => typeof prop.year === 'number' && !isNaN(prop.year));
        if (validProperties.length === 0) return null;
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
        console.error('getPropertiesForYear 関数内でエラーが発生しました:', error);
        return null;
    }
}
