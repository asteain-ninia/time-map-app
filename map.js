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

                            let dx = x % (mapWidth * k);
                            if (dx > 0) dx -= mapWidth * k;

                            zoomGroup.attr('transform', `translate(${dx}, ${y}) scale(${k})`);
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

                        for (let i = -2; i <= 2; i++) {
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
            zoomGroup.selectAll('.temp-feature-group').remove();

            const dataGroup = zoomGroup.append('g')
                .attr('class', 'data-group');

            const currentYear = state.currentYear || 0;

            const points = DataStore.getPoints(currentYear);
            const lines = DataStore.getLines(currentYear);
            const polygons = DataStore.getPolygons(currentYear);

            const mapCopies = [-2, -1, 0, 1, 2];

            function duplicateFeature(feature, offsetX) {
                const duplicatedFeature = { ...feature };
                if (duplicatedFeature.x !== undefined) {
                    duplicatedFeature.x += offsetX;
                } else {
                    duplicatedFeature.points = duplicatedFeature.points.map(p => ({ x: p.x + offsetX, y: p.y }));
                }
                return duplicatedFeature;
            }

            let allAdjustedPoints = [];
            let allAdjustedLines = [];
            let allAdjustedPolygons = [];

            mapCopies.forEach(offset => {
                try {
                    const offsetX = offset * mapWidth;

                    allAdjustedPoints.push(...points.map(point => {
                        const adjustedPoint = duplicateFeature(point, offsetX);
                        adjustedPoint.originalPoint = point;
                        return adjustedPoint;
                    }));
                    allAdjustedLines.push(...lines.map(line => {
                        const adjustedLine = duplicateFeature(line, offsetX);
                        adjustedLine.originalLine = line;
                        return adjustedLine;
                    }));
                    allAdjustedPolygons.push(...polygons.map(polygon => {
                        const adjustedPolygon = duplicateFeature(polygon, offsetX);
                        adjustedPolygon.originalPolygon = polygon;
                        return adjustedPolygon;
                    }));
                } catch (error) {
                    console.error(`mapCopies のループ内でエラーが発生しました（オフセット: ${offset}）:`, error);
                }
            });

            // ポイントの描画
            drawFeatures(dataGroup, {
                data: allAdjustedPoints,
                className: `point`,
                elementType: 'circle',
                attributes: {
                    cx: d => d.x,
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
                        if (currentState.isAddMode) {
                            // 追加モードでの処理
                        } else if (currentState.isEditMode && currentState.currentTool === 'pointAttributeEdit') {
                            stateManager.setState({ selectedFeature: d.originalPoint });
                            renderData(); // 選択状態を反映
                            UI.showEditForm(d.originalPoint, DataStore, renderData);
                        } else if (currentState.isEditMode && currentState.currentTool === 'pointMove') {
                            // ポイント移動ツールでは何もしない
                        } else {
                            UI.showDetailWindow(d);
                        }
                    }
                },
                draggable: state.isEditMode && state.currentTool === 'pointMove' // ポイント移動ツールでドラッグ可能
            });

            // ラインの描画
            drawFeatures(dataGroup, {
                data: allAdjustedLines,
                className: `line`,
                elementType: 'path',
                attributes: {
                    d: d => {
                        return d3.line()
                            .x(p => p.x)
                            .y(p => p.y)(d.points);
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
                        if (currentState.isAddMode) {
                            // 追加モードでの処理
                        } else if (currentState.isEditMode && currentState.currentTool === 'lineAttributeEdit') {
                            stateManager.setState({ selectedFeature: d.originalLine });
                            renderData(); // 選択状態を反映
                            UI.showLineEditForm(d.originalLine, DataStore, renderData);
                        } else if (currentState.isEditMode && currentState.currentTool === 'lineVertexEdit') {
                            stateManager.setState({ selectedFeature: d.originalLine });
                            renderData(); // 選択状態を反映
                        } else {
                            UI.showDetailWindow(d);
                        }
                    }
                }
            });

            // ポリゴンの描画
            drawFeatures(dataGroup, {
                data: allAdjustedPolygons,
                className: `polygon`,
                elementType: 'path',
                attributes: {
                    d: d => {
                        return d3.line()
                            .x(p => p.x)
                            .y(p => p.y)
                            .curve(d3.curveLinearClosed)(d.points);
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
                        if (currentState.isAddMode) {
                            // 追加モードでの処理
                        } else if (currentState.isEditMode && currentState.currentTool === 'polygonAttributeEdit') {
                            stateManager.setState({ selectedFeature: d.originalPolygon });
                            renderData(); // 選択状態を反映
                            UI.showPolygonEditForm(d.originalPolygon, DataStore, renderData);
                        } else if (currentState.isEditMode && currentState.currentTool === 'polygonVertexEdit') {
                            stateManager.setState({ selectedFeature: d.originalPolygon });
                            renderData(); // 選択状態を反映
                        } else {
                            UI.showDetailWindow(d);
                        }
                    }
                }
            });

            if (state.isDrawing || (state.currentTool === 'point' && state.tempPoint)) {
                drawTemporaryFeatures();
            }

            if (state.isEditMode && (state.currentTool === 'lineVertexEdit' || state.currentTool === 'polygonVertexEdit') && state.selectedFeature) {
                drawVertexHandles(dataGroup, state.selectedFeature);
            }

        } catch (error) {
            console.error('renderData 関数内でエラーが発生しました:', error);
        }
    }

    function drawFeatures(dataGroup, { data, className, elementType, attributes, eventHandlers, draggable = false }) {
        try {
            const state = stateManager.getState();

            const selection = dataGroup.selectAll(`.${className}`)
                .data(data, d => `${d.id}-${Math.floor(d.points ? d.points[0].x / mapWidth : d.x / mapWidth)}`);

            const enterSelection = selection.enter()
                .append(elementType)
                .attr('class', className);

            enterSelection.each(function (d) {
                const element = d3.select(this);
                for (const [attrName, attrValue] of Object.entries(attributes)) {
                    element.attr(attrName, typeof attrValue === 'function' ? attrValue(d) : attrValue);
                }
                for (const [eventName, eventHandler] of Object.entries(eventHandlers)) {
                    element.on(eventName, eventHandler);
                }

                // 選択状態のフィーチャーを強調表示
                if (state.selectedFeature && state.selectedFeature.id === d.id) {
                    element.classed('selected', true);
                } else {
                    element.classed('selected', false);
                }

                // ドラッグイベントの設定
                if (draggable) {
                    element.call(d3.drag()
                        .on('start', dragStarted)
                        .on('drag', dragged)
                        .on('end', dragEnded));
                }
            });

            function dragStarted(event, d) {
                stateManager.setState({ isDragging: true });
                d3.select(this).raise().classed('active', true);

                const transform = d3.zoomTransform(svg.node());
                const [mouseX, mouseY] = d3.pointer(event, svg.node());
                const transformedMouseX = transform.invertX(mouseX);
                const transformedMouseY = transform.invertY(mouseY);
                d.dragOffsetX = d.x - transformedMouseX;
                d.dragOffsetY = d.y - transformedMouseY;
            }

            function dragged(event, d) {
                const transform = d3.zoomTransform(svg.node());
                const [mouseX, mouseY] = d3.pointer(event, svg.node());
                const transformedMouseX = transform.invertX(mouseX);
                const transformedMouseY = transform.invertY(mouseY);

                d.x = transformedMouseX + d.dragOffsetX;
                d.y = transformedMouseY + d.dragOffsetY;

                d3.select(this)
                    .attr('cx', d.x)
                    .attr('cy', d.y);

                // ポイントの位置を更新
                if (d.originalPoint) {
                    d.originalPoint.x = d.x % mapWidth;
                    d.originalPoint.y = d.y;
                } else {
                    d.x = d.x % mapWidth;
                }

                // リアルタイムで再描画
                renderData();
            }

            function dragEnded(event, d) {
                stateManager.setState({ isDragging: false });
                d3.select(this).classed('active', false);

                delete d.dragOffsetX;
                delete d.dragOffsetY;

                // データストアに更新を保存
                if (d.originalPoint) {
                    DataStore.updatePoint(d.originalPoint);
                } else {
                    DataStore.updatePoint(d);
                }

                renderData();
            }

            selection.exit().remove();

        } catch (error) {
            console.error(`drawFeatures 関数内でエラーが発生しました（クラス名: ${className}）:`, error);
        }
    }

    function drawTemporaryFeatures() {
        try {
            const state = stateManager.getState();
            let tempGroup = zoomGroup.select('.temp-feature-group');
            if (tempGroup.empty()) {
                tempGroup = zoomGroup.append('g').attr('class', 'temp-feature-group');
            } else {
                tempGroup.selectAll('*').remove();
            }
            const mapCopies = [-1, 0, 1, 2];
            mapCopies.forEach(offset => {
                try {
                    const offsetX = offset * mapWidth;
                    if (state.currentTool === 'point' && state.tempPoint) {
                        drawTemporaryFeature(tempGroup, {
                            data: [{ x: state.tempPoint.x + offsetX, y: state.tempPoint.y }],
                            className: `tempPoint-${offset}`,
                            elementType: 'circle',
                            attributes: {
                                cx: d => d.x,
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
                        drawTemporaryFeature(tempGroup, {
                            data: [tempLinePointsWithOffset],
                            className: `tempLine-${offset}`,
                            elementType: 'path',
                            attributes: {
                                d: d => d3.line()
                                    .x(p => p.x)
                                    .y(p => p.y)(d)
                            },
                            style: {
                                stroke: 'orange',
                                'stroke-width': 2,
                                fill: 'none'
                            }
                        });
                        drawTemporaryFeature(tempGroup, {
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
                        drawTemporaryFeature(tempGroup, {
                            data: [tempPolygonPointsWithOffset],
                            className: `tempPolygon-${offset}`,
                            elementType: 'path',
                            attributes: {
                                d: d => d3.line()
                                    .x(p => p.x)
                                    .y(p => p.y)
                                    .curve(d3.curveLinearClosed)(d)
                            },
                            style: {
                                stroke: 'orange',
                                'stroke-width': 2,
                                fill: 'rgba(255, 165, 0, 0.3)'
                            }
                        });
                        drawTemporaryFeature(tempGroup, {
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
                    elements.attr(attrName, typeof attrValue === 'function' ? attrValue : attrValue);
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

    function drawVertexHandles(dataGroup, feature) {
        try {
            const state = stateManager.getState();
            let handleGroup = dataGroup.select('.vertex-handle-group');

            if (handleGroup.empty()) {
                handleGroup = dataGroup.append('g').attr('class', 'vertex-handle-group');
            } else {
                handleGroup.selectAll('*').remove();
            }

            const offsetXValues = [-2, -1, 0, 1, 2].map(offset => offset * mapWidth);

            offsetXValues.forEach(offsetX => {
                const adjustedFeature = { ...feature };
                adjustedFeature.points = adjustedFeature.points.map((p, i) => ({ x: p.x + offsetX, y: p.y, index: i }));

                const offsetXClass = offsetX.toString().replace('.', '_');

                handleGroup.selectAll(`.vertex-handle-${offsetXClass}`)
                    .data(adjustedFeature.points)
                    .enter()
                    .append('circle')
                    .attr('class', `vertex-handle vertex-handle-${offsetXClass}`)
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y)
                    .attr('r', 5)
                    .attr('fill', 'orange')
                    .call(d3.drag()
                        .on('start', function (event, d) { dragStarted.call(this, event, d, offsetX); })
                        .on('drag', function (event, d) { dragged.call(this, event, d, offsetX); })
                        .on('end', function (event, d) { dragEnded.call(this, event, d); }));

                function dragStarted(event, d, offsetX) {
                    stateManager.setState({ isDragging: true });
                    d3.select(this).raise().classed('active', true);

                    const transform = d3.zoomTransform(svg.node());
                    const [mouseX, mouseY] = d3.pointer(event, svg.node());
                    const transformedMouseX = transform.invertX(mouseX);
                    const transformedMouseY = transform.invertY(mouseY);
                    d.dragOffsetX = d.x - transformedMouseX;
                    d.dragOffsetY = d.y - transformedMouseY;
                }

                function dragged(event, d, offsetX) {
                    const transform = d3.zoomTransform(svg.node());
                    const [mouseX, mouseY] = d3.pointer(event, svg.node());
                    const transformedMouseX = transform.invertX(mouseX);
                    const transformedMouseY = transform.invertY(mouseY);

                    d.x = transformedMouseX + d.dragOffsetX;
                    d.y = transformedMouseY + d.dragOffsetY;

                    d3.select(this)
                        .attr('cx', d.x)
                        .attr('cy', d.y);

                    // フィーチャーのポイントを更新
                    feature.points[d.index] = { x: (d.x - offsetX) % mapWidth, y: d.y };

                    // リアルタイムで再描画
                    renderData();
                }

                function dragEnded(event, d) {
                    stateManager.setState({ isDragging: false });
                    d3.select(this).classed('active', false);

                    delete d.dragOffsetX;
                    delete d.dragOffsetY;

                    // フィーチャーをデータストアに保存
                    if (state.currentTool === 'lineVertexEdit') {
                        DataStore.updateLine(feature);
                    } else if (state.currentTool === 'polygonVertexEdit') {
                        DataStore.updatePolygon(feature);
                    }

                    renderData();
                }
            });

        } catch (error) {
            console.error('drawVertexHandles 関数内でエラーが発生しました:', error);
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
