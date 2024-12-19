// map.js

import stateManager from './stateManager.js';
import DataStore from './dataStore.js';
import UI from './ui.js';

let svg;
let zoomGroup;
let mapWidth = 1000;
let mapHeight = 800;

let MapModuleDataStore;
let MapModuleUI;

let dragStartPositions = [];
let draggingVertexData = null;
let zoom; // 後で再有効化に使うため、外で参照する

function updateSelectionForFeature(feature, vertexIndex, shiftKey) {
    const state = stateManager.getState();
    const selectedVertices = stateManager.getState().selectedVertices || [];
    let newSelectedFeature = stateManager.getState().selectedFeature;

    if (!feature.id) {
        feature.id = Date.now() + Math.random();
    }

    if (!newSelectedFeature) {
        newSelectedFeature = feature;
        stateManager.setState({
            selectedFeature: newSelectedFeature,
            selectedVertices: vertexIndex !== undefined ? [{ featureId: feature.id, vertexIndex }] : []
        });
        renderData();
        return;
    }

    if (newSelectedFeature.id !== feature.id) {
        newSelectedFeature = feature;
        stateManager.setState({
            selectedFeature: newSelectedFeature,
            selectedVertices: vertexIndex !== undefined ? [{ featureId: feature.id, vertexIndex }] : []
        });
        renderData();
        return;
    }

    if (vertexIndex === undefined) {
        // 頂点以外（ポイント）選択は単純選択
        stateManager.setState({
            selectedFeature: newSelectedFeature,
            selectedVertices: []
        });
        renderData();
        return;
    }

    // 頂点の場合はシフトキーで複数選択トグル
    const exists = selectedVertices.some(v => v.featureId === feature.id && v.vertexIndex === vertexIndex);
    let newSelection;
    if (shiftKey) {
        if (exists) {
            newSelection = selectedVertices.filter(v => !(v.featureId === feature.id && v.vertexIndex === vertexIndex));
            if (newSelection.length === 0) {
                newSelectedFeature = null;
            }
        } else {
            newSelection = [...selectedVertices, { featureId: feature.id, vertexIndex }];
        }
    } else {
        newSelection = [{ featureId: feature.id, vertexIndex }];
    }

    stateManager.setState({
        selectedFeature: newSelectedFeature,
        selectedVertices: newSelection || []
    });
    renderData();
}

function isVertexSelected(feature, vertexIndex) {
    const state = stateManager.getState();
    const selectedVertices = state.selectedVertices || [];
    return selectedVertices.some(v => v.featureId === feature.id && v.vertexIndex === vertexIndex);
}

function disableMapZoom() {
    svg.on('.zoom', null);
}

function enableMapZoom() {
    svg.call(zoom);
}

function vertexDragStarted(event, d, offsetX, feature) {
    if (event.sourceEvent) event.sourceEvent.stopPropagation();
    stateManager.setState({ isDragging: true });
    d3.select(this).raise().classed('active', true);
    disableMapZoom();

    // 頂点を確実に選択状態にしてマゼンタ化
    updateSelectionForFeature(feature, d.index, false);

    // ドラッグ開始時にツールチップを消す
    UI.hideTooltip();

    d._dragged = false;

    const transform = d3.zoomTransform(svg.node());
    const [mouseX, mouseY] = d3.pointer(event, svg.node());
    d.dragStartX = transform.invertX(mouseX);
    d.dragStartY = transform.invertY(mouseY);

    const state = stateManager.getState();
    const { selectedVertices } = state;

    if (isVertexSelected(feature, d.index)) {
        const allSelectedPositions = selectedVertices
            .filter(v => v.featureId === feature.id)
            .map(v => ({
                featureId: feature.id,
                vertexIndex: v.vertexIndex,
                startX: feature.points[v.vertexIndex].x,
                startY: feature.points[v.vertexIndex].y
            }));
        dragStartPositions = allSelectedPositions;
    } else {
        dragStartPositions = [{
            featureId: feature.id,
            vertexIndex: d.index,
            startX: feature.points[d.index].x,
            startY: feature.points[d.index].y
        }];
    }

    draggingVertexData = { feature, offsetX };
}

function vertexDragged(event, d) {
    d._dragged = true;
    if (!draggingVertexData || dragStartPositions.length === 0) return;

    const transform = d3.zoomTransform(svg.node());
    const [mouseX, mouseY] = d3.pointer(event, svg.node());
    const transformedMouseX = transform.invertX(mouseX);
    const transformedMouseY = transform.invertY(mouseY);

    const dx = transformedMouseX - d.dragStartX;
    const dy = transformedMouseY - d.dragStartY;

    const { feature, offsetX } = draggingVertexData;

    for (const pos of dragStartPositions) {
        feature.points[pos.vertexIndex].x = pos.startX + dx;
        feature.points[pos.vertexIndex].y = pos.startY + dy;
    }

    // ポイントの場合はpath更新不要
    if (feature.points.length > 1) {
        updateFeaturePath(d3.select('.data-group'), feature, offsetX);
    }

    const dataGroup = svg.select('.data-group');
    drawVertexHandles(dataGroup, feature);
    // エッジハンドルはライン・ポリゴンのみ
    if (feature.points.length > 1) {
        drawEdgeHandles(dataGroup, feature);
    }
}

function vertexDragEnded(event, d, feature) {
    stateManager.setState({ isDragging: false });
    d3.select(this).classed('active', false);
    enableMapZoom();

    // ドラッグ終了時、ツールチップを再表示
    // マウスは依然として頂点ハンドル上にあるため、featureの情報を用いてツールチップ再表示
    if (event.sourceEvent) {
        UI.showTooltip(event.sourceEvent, feature);
        UI.moveTooltip(event.sourceEvent);
    }

    const shift = event.sourceEvent && event.sourceEvent.shiftKey;
    if (!d._dragged) {
        updateSelectionForFeature(feature, d.index, shift);
    } else {
        const state = stateManager.getState();
        if (state.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(feature);
        } else if (state.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(feature);
        } else if (state.currentTool === 'pointMove' && feature.points.length === 1) {
            // 単頂点の場合＝ポイント
            DataStore.updatePoint(feature);
        }
        renderData();
    }

    dragStartPositions = [];
    draggingVertexData = null;
    delete d.dragStartX;
    delete d.dragStartY;
    delete d._dragged;
}

function edgeDragStarted(event, d, offsetX, feature) {
    if (event.sourceEvent) event.sourceEvent.stopPropagation();
    stateManager.setState({ isDragging: true });
    d3.select(this).raise().classed('active', true);
    disableMapZoom();

    // ドラッグ開始時にツールチップを消す
    UI.hideTooltip();

    d._dragged = false;

    const transform = d3.zoomTransform(svg.node());
    const [mouseX, mouseY] = d3.pointer(event, svg.node());
    d.dragStartX = transform.invertX(mouseX);
    d.dragStartY = transform.invertY(mouseY);

    const newX = d.dragStartX;
    const newY = d.dragStartY;
    feature.points.splice(d.endIndex, 0, { x: newX, y: newY });

    if (!feature.id) {
        feature.id = Date.now() + Math.random();
    }

    const state = stateManager.getState();
    if (state.currentTool === 'lineVertexEdit') {
        feature.type = 'line';
        DataStore.updateLine(feature);
    } else if (state.currentTool === 'polygonVertexEdit') {
        feature.type = 'polygon';
        DataStore.updatePolygon(feature);
    }

    d._dragged = true;
    draggingVertexData = { feature, offsetX };

    dragStartPositions = [{
        featureId: feature.id,
        vertexIndex: d.endIndex,
        startX: newX,
        startY: newY
    }];

    stateManager.setState({ selectedFeature: feature });
    renderData();
    const shift = event.sourceEvent && event.sourceEvent.shiftKey;
    updateSelectionForFeature(feature, d.endIndex, shift);
}

function edgeDragged(event, d) {
    if (!draggingVertexData || dragStartPositions.length === 0) return;
    d._dragged = true;

    const transform = d3.zoomTransform(svg.node());
    const [mouseX, mouseY] = d3.pointer(event, svg.node());
    const transformedMouseX = transform.invertX(mouseX);
    const transformedMouseY = transform.invertY(mouseY);

    const dx = transformedMouseX - d.dragStartX;
    const dy = transformedMouseY - d.dragStartY;

    const { feature, offsetX } = draggingVertexData;
    for (const pos of dragStartPositions) {
        feature.points[pos.vertexIndex].x = pos.startX + dx;
        feature.points[pos.vertexIndex].y = pos.startY + dy;
    }

    updateFeaturePath(svg.select('.data-group'), feature, offsetX);
    const dataGroup = svg.select('.data-group');
    drawVertexHandles(dataGroup, feature);
    drawEdgeHandles(dataGroup, feature);
}

function edgeDragEnded(event, d, feature) {
    stateManager.setState({ isDragging: false });
    d3.select(this).classed('active', false);
    enableMapZoom();

    // ドラッグ終了時、ツールチップを再表示
    if (event.sourceEvent) {
        UI.showTooltip(event.sourceEvent, feature);
        UI.moveTooltip(event.sourceEvent);
    }

    const state = stateManager.getState();
    if (state.currentTool === 'lineVertexEdit') {
        DataStore.updateLine(feature);
    } else if (state.currentTool === 'polygonVertexEdit') {
        DataStore.updatePolygon(feature);
    }
    renderData();

    dragStartPositions = [];
    draggingVertexData = null;
    delete d.dragStartX;
    delete d.dragStartY;
    delete d._dragged;
}

function loadMap(_DataStore, _UI, renderDataFunc) {
    return new Promise((resolve, reject) => {
        try {
            MapModuleDataStore = _DataStore;
            MapModuleUI = _UI;

            svg = d3.select('#map')
                .append('svg')
                .attr('width', '100%')
                .attr('height', '100%');

            zoomGroup = svg.append('g');

            zoom = d3.zoom()
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

                    renderDataFunc();

                    if (stateManager.getState().debugMode) {
                        console.info('地図が正常に読み込まれました。');
                    }

                    resolve();
                } catch (error) {
                    console.error('地図の初期化中にエラーが発生しました:', error);
                    MapModuleUI.showNotification('地図の初期化中にエラーが発生しました。', 'error');
                    reject(error);
                }
            }).catch((error) => {
                console.error('SVGファイルの読み込みエラー:', error);
                MapModuleUI.showNotification('地図の読み込み中にエラーが発生しました。', 'error');
                reject(error);
            });
        } catch (error) {
            console.error('loadMap 関数内でエラーが発生しました:', error);
            MapModuleUI.showNotification('地図の読み込み中にエラーが発生しました。', 'error');
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

        const points = MapModuleDataStore.getPoints(currentYear);
        const lines = MapModuleDataStore.getLines(currentYear);
        const polygons = MapModuleDataStore.getPolygons(currentYear);

        points.forEach(p => { if (!p.id) p.id = Date.now() + Math.random(); });
        lines.forEach(l => { if (!l.id) l.id = Date.now() + Math.random(); });
        polygons.forEach(pg => { if (!pg.id) pg.id = Date.now() + Math.random(); });

        const mapCopies = [-2, -1, 0, 1, 2];

        function duplicateFeature(feature, offsetX) {
            const duplicatedFeature = { ...feature };
            duplicatedFeature.points = duplicatedFeature.points.map(p => ({ x: p.x + offsetX, y: p.y }));
            return duplicatedFeature;
        }

        let allAdjustedPoints = [];
        let allAdjustedLines = [];
        let allAdjustedPolygons = [];

        mapCopies.forEach(offset => {
            try {
                const offsetX = offset * mapWidth;
                allAdjustedPolygons.push(...polygons.map(polygon => {
                    const adjustedPolygon = duplicateFeature(polygon, offsetX);
                    adjustedPolygon.originalPolygon = polygon;
                    return adjustedPolygon;
                }));
                allAdjustedLines.push(...lines.map(line => {
                    const adjustedLine = duplicateFeature(line, offsetX);
                    adjustedLine.originalLine = line;
                    return adjustedLine;
                }));
                allAdjustedPoints.push(...points.map(point => {
                    const adjustedPoint = duplicateFeature(point, offsetX);
                    adjustedPoint.originalPoint = point;
                    return adjustedPoint;
                }));
            } catch (error) {
                console.error(`mapCopies のループ内でエラーが発生しました（オフセット: ${offset}）:`, error);
            }
        });

        const st = stateManager.getState();
        const selectedFeature = st.selectedFeature;

        drawFeatures(dataGroup, {
            data: allAdjustedPolygons,
            className: 'polygon',
            elementType: 'path',
            attributes: {
                d: d => d3.line().x(p => p.x).y(p => p.y).curve(d3.curveLinearClosed)(d.points),
                stroke: 'green',
                'stroke-width': 2,
                fill: 'rgba(0, 255, 0, 0.3)',
                'pointer-events': 'all'
            },
            eventHandlers: {
                mouseover: (event, d) => UI.showTooltip(event, d),
                mousemove: UI.moveTooltip,
                mouseout: UI.hideTooltip,
                click: (event, d) => {
                    event.stopPropagation();
                    const currentState = stateManager.getState();
                    if (currentState.isAddMode) {
                        // do nothing
                    } else if (currentState.isEditMode && currentState.currentTool === 'polygonAttributeEdit') {
                        if (!d.originalPolygon.id) d.originalPolygon.id = d.id;
                        stateManager.setState({ selectedFeature: d.originalPolygon });
                        renderData();
                        UI.showPolygonEditForm(d.originalPolygon, DataStore, renderData, false, true);
                    } else if (currentState.isEditMode && currentState.currentTool === 'polygonVertexEdit') {
                        if (!d.originalPolygon.id) d.originalPolygon.id = d.id;
                        stateManager.setState({ selectedFeature: d.originalPolygon, selectedVertices: [] });
                        renderData();
                    } else if (!currentState.isEditMode) {
                        UI.showDetailWindow(d);
                    }
                }
            }
        });

        drawFeatures(dataGroup, {
            data: allAdjustedLines,
            className: 'line',
            elementType: 'path',
            attributes: {
                d: d => d3.line().x(p => p.x).y(p => p.y)(d.points),
                stroke: 'blue',
                'stroke-width': 2,
                fill: 'none',
                'pointer-events': 'all'
            },
            eventHandlers: {
                mouseover: (event, d) => UI.showTooltip(event, d),
                mousemove: UI.moveTooltip,
                mouseout: UI.hideTooltip,
                click: (event, d) => {
                    event.stopPropagation();
                    const currentState = stateManager.getState();
                    if (currentState.isAddMode) {
                        // do nothing
                    } else if (currentState.isEditMode && currentState.currentTool === 'lineAttributeEdit') {
                        if (!d.originalLine.id) d.originalLine.id = d.id;
                        stateManager.setState({ selectedFeature: d.originalLine });
                        renderData();
                        UI.showLineEditForm(d.originalLine, DataStore, renderData, false, true);
                    } else if (currentState.isEditMode && currentState.currentTool === 'lineVertexEdit') {
                        if (!d.originalLine.id) d.originalLine.id = d.id;
                        stateManager.setState({ selectedFeature: d.originalLine, selectedVertices: [] });
                        renderData();
                    } else if (!currentState.isEditMode) {
                        UI.showDetailWindow(d);
                    }
                }
            }
        });

        // ポイントを表示するが、pointMove中かつ選択済みのポイントは頂点ハンドルで移動するため非表示
        let filteredPoints = allAdjustedPoints;
        if (st.isEditMode && st.currentTool === 'pointMove' && selectedFeature && selectedFeature.points && selectedFeature.points.length === 1) {
            filteredPoints = allAdjustedPoints.filter(p => p.id !== selectedFeature.id);
        }

        drawFeatures(dataGroup, {
            data: filteredPoints,
            className: 'point',
            elementType: 'circle',
            attributes: {
                cx: d => d.points[0].x,
                cy: d => d.points[0].y,
                r: 5,
                fill: 'red',
                'pointer-events': 'all'
            },
            eventHandlers: {
                mouseover: (event, d) => UI.showTooltip(event, d),
                mousemove: UI.moveTooltip,
                mouseout: UI.hideTooltip,
                click: (event, d) => {
                    event.stopPropagation();
                    const currentState = stateManager.getState();
                    if (currentState.isAddMode) {
                        // do nothing
                    } else {
                        if (currentState.isEditMode && currentState.currentTool === 'pointAttributeEdit') {
                            if (!d.originalPoint.id) d.originalPoint.id = d.id;
                            stateManager.setState({ selectedFeature: d.originalPoint });
                            renderData();
                            UI.showEditForm(d.originalPoint, DataStore, renderData);
                        } else if (!currentState.isEditMode) {
                            UI.showDetailWindow(d);
                        } else if (currentState.isEditMode && currentState.currentTool === 'pointMove') {
                            if (!d.originalPoint.id) d.originalPoint.id = d.id;
                            stateManager.setState({ selectedFeature: d.originalPoint, selectedVertices: [] });
                            renderData();
                        }
                    }
                }
            }
        });

        if (st.isDrawing) {
            drawTemporaryFeatures();
        }

        // pointMoveでポイントが選択されている場合、頂点ハンドルで移動
        if (st.isEditMode && st.currentTool === 'pointMove' && selectedFeature && selectedFeature.points && selectedFeature.points.length === 1) {
            drawVertexHandles(dataGroup, selectedFeature);
        }

        if (st.isEditMode && (st.currentTool === 'lineVertexEdit' || st.currentTool === 'polygonVertexEdit') && st.selectedFeature) {
            drawVertexHandles(dataGroup, st.selectedFeature);
            drawEdgeHandles(dataGroup, st.selectedFeature);
        }

    } catch (error) {
        console.error('renderData 関数内でエラーが発生しました:', error);
    }
}

function drawFeatures(container, { data, className, elementType, attributes, eventHandlers, draggable, dragStart, drag, dragEnd, clickDistance = 0 }) {
    try {
        const selection = container.selectAll(`.${className}`)
            .data(data, d => d.id ? `${d.id}-${Math.floor(d.points[0].x / mapWidth)}` : Date.now() + Math.random());

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
        });

        selection.each(function (d) {
            const element = d3.select(this);
            for (const [attrName, attrValue] of Object.entries(attributes)) {
                element.attr(attrName, typeof attrValue === 'function' ? attrValue(d) : attrValue);
            }
            for (const [eventName, eventHandler] of Object.entries(eventHandlers)) {
                element.on(eventName, eventHandler);
            }
        });

        selection.exit().remove();

        const st = stateManager.getState();
        if (st.selectedFeature && st.selectedFeature.id) {
            container.selectAll(`.${className}`)
                .filter(d => d.id === st.selectedFeature.id)
                .each(function (d) {
                    const element = d3.select(this);
                    if (className === 'line' || className === 'polygon') {
                        element.attr('stroke', 'orange').attr('stroke-width', 4);
                    } else if (className === 'point') {
                        element.attr('fill', 'magenta');
                    }
                });
        }

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
                if (state.currentTool === 'line' && state.tempLinePoints && state.tempLinePoints.length > 0) {
                    const tempLinePointsWithOffset = state.tempLinePoints.map(p => ({
                        x: p.x + offsetX,
                        y: p.y
                    }));
                    drawTemporaryFeature(tempGroup, {
                        data: [tempLinePointsWithOffset],
                        className: `tempLine-${offset}`,
                        elementType: 'path',
                        attributes: {
                            d: d => d3.line().x(p => p.x).y(p => p.y)(d)
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
                } else if (state.currentTool === 'polygon' && state.tempPolygonPoints && state.tempPolygonPoints.length > 0) {
                    const tempPolygonPointsWithOffset = state.tempPolygonPoints.map(p => ({
                        x: p.x + offsetX,
                        y: p.y
                    }));
                    drawTemporaryFeature(tempGroup, {
                        data: [tempPolygonPointsWithOffset],
                        className: `tempPolygon-${offset}`,
                        elementType: 'path',
                        attributes: {
                            d: d => d3.line().x(p => p.x).y(p => p.y).curve(d3.curveLinearClosed)(d)
                        },
                        style: {
                            stroke: 'orange',
                            'stroke-width': 2,
                            fill: 'rgba(255,165,0,0.3)'
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
                } else if (state.currentTool === 'point' && state.tempPoint) {
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
        if (!feature.id) {
            feature.id = Date.now() + Math.random();
        }

        dataGroup.selectAll('.vertex-handle-group').remove();
        let handleGroup = dataGroup.append('g').attr('class', 'vertex-handle-group');

        const offsetXValues = [-2, -1, 0, 1, 2].map(offset => offset * mapWidth);

        offsetXValues.forEach(offsetX => {
            const adjustedFeature = { ...feature };
            adjustedFeature.points = adjustedFeature.points.map((p, i) => ({ x: p.x + offsetX, y: p.y, index: i }));

            const offsetXClass = 'offset_' + Math.round(offsetX);

            const vertices = handleGroup.selectAll(`.vertex-handle-${offsetXClass}`)
                .data(adjustedFeature.points, d => d.index);

            const enterVertices = vertices.enter().append('circle');
            vertices.merge(enterVertices)
                .attr('class', `vertex-handle vertex-handle-${offsetXClass}`)
                .attr('cx', d => d.x)
                .attr('cy', d => d.y)
                .attr('r', 5)
                .attr('fill', d => isVertexSelected(feature, d.index) ? 'magenta' : 'orange')
                .style('pointer-events', 'all')
                // 頂点ハンドル上でツールチップを表示できるようにする
                .on('mouseover', (event, dData) => UI.showTooltip(event, feature))
                .on('mousemove', UI.moveTooltip)
                .on('mouseout', UI.hideTooltip)
                .call(d3.drag()
                    .clickDistance(0)
                    .on('start', function (event, dData) {
                        // ドラッグ開始時にツールチップを消す
                        UI.hideTooltip();
                        vertexDragStarted.call(this, event, dData, offsetX, feature);
                    })
                    .on('drag', function (event, dData) {
                        vertexDragged.call(this, event, dData);
                    })
                    .on('end', function (event, dData) {
                        // ドラッグ終了時、ツールチップ再表示
                        if (event.sourceEvent) {
                            UI.showTooltip(event.sourceEvent, feature);
                            UI.moveTooltip(event.sourceEvent);
                        }
                        vertexDragEnded.call(this, event, dData, feature);
                    })
                );

            vertices.exit().remove();
        });

    } catch (error) {
        console.error('drawVertexHandles 関数内でエラーが発生しました:', error);
    }
}

function updateFeaturePath(dataGroup, feature, offsetX) {
    try {
        if (feature.points.length <= 1) {
            // ポイントはパス不要
            return;
        }

        const adjustedFeature = { ...feature };
        adjustedFeature.points = adjustedFeature.points.map(p => ({ x: p.x + offsetX, y: p.y }));

        const state = stateManager.getState();
        const isLine = state.currentTool === 'lineVertexEdit';
        const isPolygon = state.currentTool === 'polygonVertexEdit';

        let className = '';
        if (isLine) className = 'line';
        if (isPolygon) className = 'polygon';
        if (!className) return;

        dataGroup.selectAll(`.${className}`)
            .filter(d => d.id === feature.id && Math.floor(d.points[0].x / mapWidth) === offsetX / mapWidth)
            .attr('d', () => {
                if (className === 'line') {
                    return d3.line().x(p => p.x).y(p => p.y)(adjustedFeature.points);
                } else {
                    return d3.line().x(p => p.x).y(p => p.y).curve(d3.curveLinearClosed)(adjustedFeature.points);
                }
            });
    } catch (error) {
        console.error('updateFeaturePath 関数内でエラーが発生しました:', error);
    }
}

function drawEdgeHandles(dataGroup, feature) {
    try {
        if (feature.points.length <= 1) {
            // ポイントはエッジハンドル不要
            return;
        }

        dataGroup.selectAll('.edge-handle-group').remove();
        let edgeHandleGroup = dataGroup.append('g').attr('class', 'edge-handle-group');

        const offsetXValues = [-2, -1, 0, 1, 2].map(offset => offset * mapWidth);
        const state = stateManager.getState();
        const isPolygon = state.currentTool === 'polygonVertexEdit';
        const requiredMin = isPolygon ? 3 : 2;

        if (feature.points.length < requiredMin) return;

        offsetXValues.forEach(offsetX => {
            const adjustedFeature = { ...feature };
            adjustedFeature.points = adjustedFeature.points.map((p, i) => ({ x: p.x + offsetX, y: p.y, index: i }));

            const offsetXClass = 'offset_' + Math.round(offsetX);

            const edges = [];
            for (let i = 0; i < adjustedFeature.points.length - (isPolygon ? 0 : 1); i++) {
                const start = adjustedFeature.points[i];
                const end = adjustedFeature.points[(i + 1) % adjustedFeature.points.length];
                edges.push({
                    x: (start.x + end.x) / 2,
                    y: (start.y + end.y) / 2,
                    startIndex: i,
                    endIndex: (i + 1) % adjustedFeature.points.length
                });
            }

            edgeHandleGroup.selectAll(`.edge-handle-${offsetXClass}`)
                .data(edges)
                .enter()
                .append('circle')
                .attr('class', `edge-handle edge-handle-${offsetXClass}`)
                .attr('cx', d => d.x)
                .attr('cy', d => d.y)
                .attr('r', 4)
                .attr('fill', 'yellow')
                .style('pointer-events', 'all')
                // エッジハンドル上でもツールチップを表示
                .on('mouseover', (event, dData) => UI.showTooltip(event, feature))
                .on('mousemove', UI.moveTooltip)
                .on('mouseout', UI.hideTooltip)
                .call(d3.drag()
                    .clickDistance(0)
                    .on('start', function (event, dData) {
                        // ドラッグ開始時にツールチップを消す
                        UI.hideTooltip();
                        edgeDragStarted.call(this, event, dData, offsetX, feature);
                    })
                    .on('drag', function (event, dData) {
                        edgeDragged.call(this, event, dData);
                    })
                    .on('end', function (event, dData) {
                        // ドラッグ終了時、ツールチップ再表示
                        if (event.sourceEvent) {
                            UI.showTooltip(event.sourceEvent, feature);
                            UI.moveTooltip(event.sourceEvent);
                        }
                        edgeDragEnded.call(this, event, dData, feature);
                    })
                );
        });
    } catch (error) {
        console.error('drawEdgeHandles 関数内でエラーが発生しました:', error);
    }
}

function removeSelectedVertices() {
    const state = stateManager.getState();
    const { selectedFeature, selectedVertices } = state;

    if (!selectedFeature || !selectedVertices || selectedVertices.length === 0) {
        return;
    }

    if (!selectedFeature.id) {
        selectedFeature.id = Date.now() + Math.random();
    }

    const sortedIndices = selectedVertices.map(v => v.vertexIndex).sort((a, b) => b - a);
    sortedIndices.forEach(idx => {
        if (selectedFeature.points && selectedFeature.points.length > idx) {
            selectedFeature.points.splice(idx, 1);
        }
    });

    if (state.currentTool === 'lineVertexEdit') {
        DataStore.updateLine(selectedFeature);
    } else if (state.currentTool === 'polygonVertexEdit') {
        DataStore.updatePolygon(selectedFeature);
    } else if (state.currentTool === 'pointMove' && selectedFeature.points.length === 1) {
        DataStore.updatePoint(selectedFeature);
    }

    stateManager.setState({ selectedVertices: [] });
    renderData();
}

export default {
    loadMap,
    renderData,
    getMapWidth: () => mapWidth,
    getMapHeight: () => mapHeight,
    removeSelectedVertices
};
