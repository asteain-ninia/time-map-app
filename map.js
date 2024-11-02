// map.js

import stateManager from './stateManager.js'; // 追加

const MapModule = (() => {
    let svg;
    let zoomGroup;
    let mapWidth = 1000;
    let mapHeight = 800;

    // モジュールスコープで保持する変数
    let DataStore;
    let UI;

    function loadMap(_DataStore, _UI, renderData) {
        return new Promise((resolve, reject) => {
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
                    const { x, y, k } = event.transform;

                    let dx = ((x % (mapWidth * k)) + (mapWidth * k)) % (mapWidth * k);

                    const minY = - (mapHeight * (k - 1));
                    const maxY = 0;
                    let dy = Math.max(Math.min(y, maxY), minY);

                    zoomGroup.attr('transform', `translate(${dx}, ${dy}) scale(${k})`);
                });

            svg.call(zoom);

            const mapSvgUrl = 'map.svg';

            d3.xml(mapSvgUrl).then((xml) => {
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

                // 成功時に resolve を呼び出す
                resolve();
            }).catch((error) => {
                console.error('SVGファイルの読み込みエラー:', error);
                UI.showNotification('地図の読み込み中にエラーが発生しました。', 'error');
                // エラー時に reject を呼び出す
                reject(error);
            });
        });
    }

    function renderData() {
        const state = stateManager.getState();

        // 既存のデータと一時的な描画を削除
        zoomGroup.selectAll('.data-group').remove();
        zoomGroup.selectAll('.temp-feature').remove();

        const dataGroup = zoomGroup.append('g')
            .attr('class', 'data-group');

        const currentYear = state.currentYear || 0;
        const mapCopies = [-1, 0, 1];

        mapCopies.forEach(offset => {
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
        });

        // 仮のフィーチャーの描画
        if (state.isDrawing || (state.currentTool === 'point' && state.tempPoint)) {
            drawTemporaryFeatures();
        }
    }

    function drawFeatures(dataGroup, { data, className, elementType, attributes, eventHandlers }) {
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
    }

    function drawTemporaryFeatures() {
        const state = stateManager.getState();
        zoomGroup.selectAll('.temp-feature').remove();

        const mapCopies = [-1, 0, 1, 2];

        mapCopies.forEach(offset => {
            const offsetX = offset * mapWidth;

            if (state.currentTool === 'point' && state.tempPoint) {
                // 仮のポイントの描画
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
                // 仮のラインの描画
                const tempLinePointsWithOffset = state.tempLinePoints.map(p => ({
                    x: p.x + offsetX,
                    y: p.y
                }));

                // 仮のラインを描画
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

                // 仮のポイントを各頂点に描画
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
                // 仮のポリゴンの描画
                const tempPolygonPointsWithOffset = state.tempPolygonPoints.map(p => ({
                    x: p.x + offsetX,
                    y: p.y
                }));

                // 仮のポリゴンを描画
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

                // 仮のポイントを各頂点に描画
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
        });
    }

    function drawTemporaryFeature(group, { data, className, elementType, attributes, style }) {
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
    }

    return {
        loadMap,
        renderData,
        getMapWidth: () => mapWidth,
        getMapHeight: () => mapHeight,
    };
})();

export default MapModule;
