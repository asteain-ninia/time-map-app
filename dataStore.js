// dataStore.js

const DataStore = (() => {
    const points = [];
    const lines = [];
    const polygons = [];

    return {
        getPoints: () => points,
        getLines: () => lines,
        getPolygons: () => polygons,

        addPoint: (point) => points.push(point),
        addLine: (line) => lines.push(line),
        addPolygon: (polygon) => polygons.push(polygon),

        updatePoint: (updatedPoint) => {
            const index = points.findIndex(p => p.id === updatedPoint.id);
            if (index !== -1) points[index] = updatedPoint;
        },
        updateLine: (updatedLine) => {
            const index = lines.findIndex(l => l.id === updatedLine.id);
            if (index !== -1) lines[index] = updatedLine;
        },
        updatePolygon: (updatedPolygon) => {
            const index = polygons.findIndex(p => p.id === updatedPolygon.id);
            if (index !== -1) polygons[index] = updatedPolygon;
        },

        removePoint: (id) => {
            const index = points.findIndex(p => p.id === id);
            if (index !== -1) points.splice(index, 1);
        },
        removeLine: (id) => {
            const index = lines.findIndex(l => l.id === id);
            if (index !== -1) lines.splice(index, 1);
        },
        removePolygon: (id) => {
            const index = polygons.findIndex(p => p.id === id);
            if (index !== -1) polygons.splice(index, 1);
        },
    };
})();

module.exports = DataStore;
