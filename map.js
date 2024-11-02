// map.js

import stateManager from './stateManager.js';

const MapModule = (() => {
    let svg;
    let zoomGroup;
    let mapWidth = 1000;
    let mapHeight = 800;

    let DataStore;
    let UI;

    function loadMap(_DataStore, _UI, renderData) {
        return new Promise((resolve, reject) => {
            try {
                DataStore = _DataStore;
                UI = _UI;

                svg = d3.select('#map')
                    .append('svg')
                    .attr('width', '100%')
                    .attr('height', '100%');

                zoomGroup = svg.append('g');

                const zoom = d3.zoom()
                    .scaleExtent([1, 50])
                    .on('zoom', (event) => {
                        try {
                            if (stateManager.getState().debugMode) {
                                console.info('ズームイベントが発生しました。');
                            }

                            const { x, y, k } = event.transform;

                            let dx = ((x % (mapWidth * k)) + (mapWidth * k)) % (mapWidth * k);

                            const minY = - (mapHeight * (k - 1));
                            const maxY = 0;
                            let dy = Math.max(Math.min(y, maxY), minY);

                            zoomGroup.attr('transform', `translate(${dx}, ${dy}) scale(${k})`);
                        } catch (error) {
                            console.error('ズームイベント中にエラーが発生しました:', error);
                        }
                    });

                svg.call(zoom);

                const mapSvgUrl = 'map.svg';

                d3.xml(mapSvgUrl).then((xml) => {
                    try {
                        const mapSvg = xml.documentElement;

                        const viewBox = mapSvg.getAttribute('viewBox');
                        if (viewBox) {
                            const viewBoxValues = viewBox.split(' ').map(Number);
                            if (viewBoxValues.length === 4) {
                                mapWidth = viewBoxValues[2];
                                mapHeight = viewBoxValues[3];
                            }
                        } else {
                            mapWidth = parseFloat(mapSvg.getAttribute('width')) || mapWidth;
                            mapHeight = parseFloat(mapSvg.getAttribute('height')) || mapHeight;
                        }

                        for (let i = -1; i <= 2; i++) {
                            const mapClone = mapSvg.cloneNode(true);
                            const mapGroup = zoomGroup.append('g')
                                .attr('transform', `translate(${i * mapWidth}, 0)`);
                            mapGroup.node().appendChild(mapClone);
                        }

                        svg.attr('viewBox', `0 0 ${mapWidth} ${mapHeight}`)
                            .attr('preserveAspectRatio', 'xMidYMid meet');

                        renderData();

                        if (stateManager.getState().debugMode) {
                            console.info('地図が正常に読み込まれました。');
                        }

                        resolve();
                    } catch (error) {
                        console.error('地図の初期化中にエラーが発生しました:', error);
                        UI.showNotification('地図の初期化中にエラーが発生しました。', 'error');
                        reject(error);
                    }
                }).catch((error) => {
                    console.error('SVGファイルの読み込みエラー:', error);
                    UI.showNotification('地図の読み込み中にエラーが発生しました。', 'error');
                    reject(error);
                });
            } catch (error) {
                console.error('loadMap 関数内でエラーが発生しました:', error);
                UI.showNotification('地図の読み込み中にエラーが発生しました。', 'error');
                reject(error);
            }
        });
    }

    function renderData() {
        try {
            const state = stateManager.getState();

            if (state.debugMode) {
                console.info('renderData() が呼び出されました。');
            }

            zoomGroup.selectAll('.data-group').remove();
            zoomGroup.selectAll('.temp-feature').remove();

            const dataGroup = zoomGroup.append('g')
                .attr('class', 'data-group');

            const currentYear = state.currentYear || 0;
            const mapCopies = [-1, 0, 1];

            mapCopies.forEach(offset => {
                try {
                    const offsetX = offset * mapWidth;

                    // ポイントの描画
                    drawFeatures(dataGroup, {
                        data: DataStore.getPoints(currentYear),
                        className: `point-${offset}`,
                        elementType: 'circle',
                        attributes: {
                            cx: d => d.x + offsetX,
                            cy: d => d.y,
                            r: 5,
                            fill: 'red'
                        },
                        eventHandlers: {
                            mouseover: (event, d) => UI.showTooltip(event, d),
                            mousemove: UI.moveTooltip,
                            mouseout: UI.hideTooltip,
                            click: (event, d) => {
                                event.stopPropagation();
                                const currentState = stateManager.getState();
                                if (currentState.isEditMode) {
                                    UI.showEditForm(d, DataStore, renderData);
                                } else {
                                    UI.showDetailWindow(d);
                                }
                            }
                        }
                    });

                    // ラインの描画
                    drawFeatures(dataGroup, {
                        data: DataStore.getLines(currentYear),
                        className: `line-${offset}`,
                        elementType: 'path',
                        attributes: {
                            d: d => {
                                const linePoints = d.points.map(p => ({
                                    x: p.x + offsetX,
                                    y: p.y
                                }));
                                return d3.line()
                                    .x(p => p.x)
                                    .y(p => p.y)(linePoints);
                            },
                            stroke: 'blue',
                            'stroke-width': 2,
                            fill: 'none'
                        },
                        eventHandlers: {
                            mouseover: (event, d) => UI.showTooltip(event, d),
                            mousemove: UI.moveTooltip,
                            mouseout: UI.hideTooltip,
                            click: (event, d) => {
                                event.stopPropagation();
                                const currentState = stateManager.getState();
                                if (currentState.isEditMode) {
                                    UI.showLineEditForm(d, DataStore, renderData);
                                } else {
                                    UI.showDetailWindow(d);
                                }
                            }
                        }
                    });

                    // ポリゴンの描画
                    drawFeatures(dataGroup, {
                        data: DataStore.getPolygons(currentYear),
                        className: `polygon-${offset}`,
                        elementType: 'path',
                        attributes: {
                            d: d => {
                                const polygonPoints = d.points.map(p => ({
                                    x: p.x + offsetX,
                                    y: p.y
                                }));
                                return d3.line()
                                    .x(p => p.x)
                                    .y(p => p.y)
                                    .curve(d3.curveLinearClosed)(polygonPoints);
                            },
                            stroke: 'green',
                            'stroke-width': 2,
                            fill: 'rgba(0, 255, 0, 0.3)'
                        },
                        eventHandlers: {
                            mouseover: (event, d) => UI.showTooltip(event, d),
                            mousemove: UI.moveTooltip,
                            mouseout: UI.hideTooltip,
                            click: (event, d) => {
                                event.stopPropagation();
                                const currentState = stateManager.getState();
                                if (currentState.isEditMode) {
                                    UI.showPolygonEditForm(d, DataStore, renderData);
                                } else {
                                    UI.showDetailWindow(d);
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.error(`mapCopies のループ内でエラーが発生しました（オフセット: ${offset}）:`, error);
                }
            });

            if (state.isDrawing || (state.currentTool === 'point' && state.tempPoint)) {
                drawTemporaryFeatures();
            }
        } catch (error) {
            console.error('renderData 関数内でエラーが発生しました:', error);
        }
    }

    function drawFeatures(dataGroup, { data, className, elementType, attributes, eventHandlers }) {
        try {
            if (stateManager.getState().debugMode) {
                console.info(`drawFeatures() が呼び出されました。クラス名: ${className}`);
            }

            dataGroup.selectAll(`.${className}`)
                .data(data, d => d.id)
                .join(
                    enter => {
                        const elements = enter.append(elementType)
                            .attr('class', className);

                        for (const [attrName, attrValue] of Object.entries(attributes)) {
                            elements.attr(attrName, attrValue);
                        }

                        for (const [eventName, eventHandler] of Object.entries(eventHandlers)) {
                            elements.on(eventName, eventHandler);
                        }

                        return elements;
                    },
                    update => {
                        for (const [attrName, attrValue] of Object.entries(attributes)) {
                            update.attr(attrName, attrValue);
                        }
                        return update;
                    },
                    exit => exit.remove()
                );
        } catch (error) {
            console.error(`drawFeatures 関数内でエラーが発生しました（クラス名: ${className}）:`, error);
        }
    }

    function drawTemporaryFeatures() {
        try {
            const state = stateManager.getState();
            zoomGroup.selectAll('.temp-feature').remove();

            const mapCopies = [-1, 0, 1, 2];

            mapCopies.forEach(offset => {
                try {
                    const offsetX = offset * mapWidth;

                    if (state.currentTool === 'point' && state.tempPoint) {
                        drawTemporaryFeature(zoomGroup, {
                            data: [state.tempPoint],
                            className: `tempPoint-${offset}`,
                            elementType: 'circle',
                            attributes: {
                                cx: d => d.x + offsetX,
                                cy: d => d.y,
                                r: 5,
                                fill: 'orange'
                            }
                        });
                    } else if (state.currentTool === 'line' && state.tempLinePoints.length > 0) {
                        const tempLinePointsWithOffset = state.tempLinePoints.map(p => ({
                            x: p.x + offsetX,
                            y: p.y
                        }));

                        drawTemporaryFeature(zoomGroup, {
                            data: [tempLinePointsWithOffset],
                            className: `tempLine-${offset}`,
                            elementType: 'path',
                            attributes: {
                                d: d3.line()
                                    .x(d => d.x)
                                    .y(d => d.y)
                            },
                            style: {
                                stroke: 'orange',
                                'stroke-width': 2,
                                fill: 'none'
                            }
                        });

                        drawTemporaryFeature(zoomGroup, {
                            data: tempLinePointsWithOffset,
                            className: `tempPoint-${offset}`,
                            elementType: 'circle',
                            attributes: {
                                cx: d => d.x,
                                cy: d => d.y,
                                r: 5,
                                fill: 'orange'
                            }
                        });
                    } else if (state.currentTool === 'polygon' && state.tempPolygonPoints.length > 0) {
                        const tempPolygonPointsWithOffset = state.tempPolygonPoints.map(p => ({
                            x: p.x + offsetX,
                            y: p.y
                        }));

                        drawTemporaryFeature(zoomGroup, {
                            data: [tempPolygonPointsWithOffset],
                            className: `tempPolygon-${offset}`,
                            elementType: 'path',
                            attributes: {
                                d: d3.line()
                                    .x(d => d.x)
                                    .y(d => d.y)
                                    .curve(d3.curveLinearClosed)
                            },
                            style: {
                                stroke: 'orange',
                                'stroke-width': 2,
                                fill: 'rgba(255, 165, 0, 0.3)'
                            }
                        });

                        drawTemporaryFeature(zoomGroup, {
                            data: tempPolygonPointsWithOffset,
                            className: `tempPoint-${offset}`,
                            elementType: 'circle',
                            attributes: {
                                cx: d => d.x,
                                cy: d => d.y,
                                r: 5,
                                fill: 'orange'
                            }
                        });
                    }
                } catch (error) {
                    console.error(`drawTemporaryFeatures のループ内でエラーが発生しました（オフセット: ${offset}）:`, error);
                }
            });
        } catch (error) {
            console.error('drawTemporaryFeatures 関数内でエラーが発生しました:', error);
        }
    }

    function drawTemporaryFeature(group, { data, className, elementType, attributes, style }) {
        try {
            if (stateManager.getState().debugMode) {
                console.info(`drawTemporaryFeature() が呼び出されました。クラス名: ${className}`);
            }

            const tempGroup = group.append('g')
                .attr('class', 'temp-feature');

            const elements = tempGroup.selectAll(`.${className}`)
                .data(data)
                .enter()
                .append(elementType)
                .attr('class', className);

            if (elementType === 'path') {
                elements.attr('d', d => attributes.d(d));
            } else {
                for (const [attrName, attrValue] of Object.entries(attributes)) {
                    elements.attr(attrName, attrValue);
                }
            }

            if (style) {
                for (const [styleName, styleValue] of Object.entries(style)) {
                    elements.style(styleName, styleValue);
                }
            }
        } catch (error) {
            console.error(`drawTemporaryFeature 関数内でエラーが発生しました（クラス名: ${className}）:`, error);
        }
    }

    return {
        loadMap,
        renderData,
        getMapWidth: () => mapWidth,
        getMapHeight: () => mapHeight,
    };
})();

export default MapModule;
