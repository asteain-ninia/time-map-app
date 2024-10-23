// dataStore.js

const DataStore = (() => {
    let points = [];
    let lines = [];
    let polygons = [];

    // 年次に応じたポイントの取得
    function getPoints(year) {
        return points
            .map(point => {
                const properties = getPropertiesForYear(point.properties, year);
                if (properties) {
                    return { ...point, ...properties };
                } else {
                    return null;
                }
            })
            .filter(point => point !== null);
    }

    // 年次に応じたラインの取得
    function getLines(year) {
        return lines
            .map(line => {
                const properties = getPropertiesForYear(line.properties, year);
                if (properties) {
                    return { ...line, ...properties };
                } else {
                    return null;
                }
            })
            .filter(line => line !== null);
    }

    // 年次に応じたポリゴンの取得
    function getPolygons(year) {
        return polygons
            .map(polygon => {
                const properties = getPropertiesForYear(polygon.properties, year);
                if (properties) {
                    return { ...polygon, ...properties };
                } else {
                    return null;
                }
            })
            .filter(polygon => polygon !== null);
    }

    // 指定された年のプロパティを取得
    function getPropertiesForYear(propertiesArray, year) {
        if (!propertiesArray || propertiesArray.length === 0) return null;
        const sortedProperties = propertiesArray.sort((a, b) => a.year - b.year);
        let currentProperties = null;
        for (const prop of sortedProperties) {
            if (prop.year <= year) {
                currentProperties = prop;
            } else {
                break;
            }
        }
        return currentProperties;
    }

    // 新しいポイントを追加
    function addPoint(point) {
        if (!point.properties) {
            point.properties = [];
        }
        points.push(point);
    }

    // ポイントを更新（新しいプロパティを追加）
    function updatePoint(updatedPoint) {
        const index = points.findIndex(point => point.id === updatedPoint.id);
        if (index !== -1) {
            points[index] = updatedPoint;
        }
    }

    // 新しいラインを追加
    function addLine(line) {
        lines.push(line);
    }

    // ラインを更新
    function updateLine(updatedLine) {
        const index = lines.findIndex(line => line.id === updatedLine.id);
        if (index !== -1) {
            lines[index] = updatedLine;
        }
    }

    // 新しいポリゴンを追加
    function addPolygon(polygon) {
        polygons.push(polygon);
    }

    // ポリゴンを更新
    function updatePolygon(updatedPolygon) {
        const index = polygons.findIndex(polygon => polygon.id === updatedPolygon.id);
        if (index !== -1) {
            polygons[index] = updatedPolygon;
        }
    }

    // ポイントを削除
    function removePoint(id) {
        const index = points.findIndex(point => point.id === id);
        if (index !== -1) points.splice(index, 1);
    }

    // ラインを削除
    function removeLine(id) {
        const index = lines.findIndex(line => line.id === id);
        if (index !== -1) lines.splice(index, 1);
    }

    // ポリゴンを削除
    function removePolygon(id) {
        const index = polygons.findIndex(polygon => polygon.id === id);
        if (index !== -1) polygons.splice(index, 1);
    }

    return {
        getPoints,
        getLines,
        getPolygons,

        addPoint,
        addLine,
        addPolygon,

        updatePoint,
        updateLine,
        updatePolygon,

        removePoint,
        removeLine,
        removePolygon,
    };
})();

module.exports = DataStore;
