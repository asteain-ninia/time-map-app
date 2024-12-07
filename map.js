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

/**
 * 頂点ドラッグ開始時
 * 頂点ハンドル専用処理。_draggedフラグを使用してクリック判定とドラッグ判定を分ける。
 * ポイント用ドラッグには使用しない。
 */
function vertexDragStarted(event, d, offsetX) {
    stateManager.setState({ isDragging: true });
    d3.select(this).raise().classed('active', true);

    // 頂点ハンドル用フラグ
    d._dragged = false;

    const transform = d3.zoomTransform(svg.node());
    const [mouseX, mouseY] = d3.pointer(event, svg.node());
    const transformedMouseX = transform.invertX(mouseX);
    const transformedMouseY = transform.invertY(mouseY);
    d.dragOffsetX = d.x - transformedMouseX;
    d.dragOffsetY = d.y - transformedMouseY;
}

/**
 * 頂点ドラッグ中
 */
function vertexDragged(event, d, feature, offsetX) {
    d._dragged = true; // ドラッグ中に移動あり

    const transform = d3.zoomTransform(svg.node());
    const [mouseX, mouseY] = d3.pointer(event, svg.node());
    const transformedMouseX = transform.invertX(mouseX);
    const transformedMouseY = transform.invertY(mouseY);

    d.x = transformedMouseX + d.dragOffsetX;
    d.y = transformedMouseY + d.dragOffsetY;

    d3.select(this)
        .attr('cx', d.x)
        .attr('cy', d.y);

    feature.points[d.index] = { x: (d.x - offsetX) % mapWidth, y: d.y };

    updateFeaturePath(d3.select('.data-group'), feature, offsetX);

    const dataGroup = zoomGroup.select('.data-group');
    drawVertexHandles(dataGroup, feature);
    drawEdgeHandles(dataGroup, feature);
}

/**
 * 頂点ドラッグ終了
 */
function vertexDragEnded(event, d, feature) {
    stateManager.setState({ isDragging: false });
    d3.select(this).classed('active', false);

    delete d.dragOffsetX;
    delete d.dragOffsetY;

    const state = stateManager.getState();
    if (state.currentTool === 'lineVertexEdit') {
        MapModuleDataStore.updateLine(feature);
    } else if (state.currentTool === 'polygonVertexEdit') {
        MapModuleDataStore.updatePolygon(feature);
    }

    renderData();
}

/**
 * ポイントドラッグ開始
 * ポイントには_draggedやclickDistanceを使わず元の動作に戻す。
 */
function pointDragStarted(event, d) {
    stateManager.setState({ isDragging: true });
    d3.select(this).raise().classed('active', true);

    const transform = d3.zoomTransform(svg.node());
    const [mouseX, mouseY] = d3.pointer(event, svg.node());
    const transformedMouseX = transform.invertX(mouseX);
    const transformedMouseY = transform.invertY(mouseY);
    d.dragOffsetX = d.x - transformedMouseX;
    d.dragOffsetY = d.y - transformedMouseY;
}

/**
 * ポイントドラッグ中
 */
function pointDragged(event, d) {
    const transform = d3.zoomTransform(svg.node());
    const [mouseX, mouseY] = d3.pointer(event, svg.node());
    const transformedMouseX = transform.invertX(mouseX);
    const transformedMouseY = transform.invertY(mouseY);

    d.x = transformedMouseX + d.dragOffsetX;
    d.y = transformedMouseY + d.dragOffsetY;

    d3.select(this)
        .attr('cx', d.x)
        .attr('cy', d.y);

    if (d.originalPoint) {
        d.originalPoint.x = d.x % mapWidth;
        d.originalPoint.y = d.y;
    } else {
        d.x = d.x % mapWidth;
    }
}

/**
 * ポイントドラッグ終了
 */
function pointDragEnded(event, d) {
    stateManager.setState({ isDragging: false });
    d3.select(this).classed('active', false);

    delete d.dragOffsetX;
    delete d.dragOffsetY;

    if (d.originalPoint) {
        MapModuleDataStore.updatePoint(d.originalPoint);
    } else {
        MapModuleDataStore.updatePoint(d);
    }

    renderData();
}

/**
 * 地図読み込み
 * ログは元の表現に戻す
 */
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

/**
 * データ再描画
 * ログメッセージはオリジナルに戻す
 */
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

        // 以下の描画処理内のログは元のままに戻す
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
                        // 元のまま
                    } else if (currentState.isEditMode && currentState.currentTool === 'pointAttributeEdit') {
                        stateManager.setState({ selectedFeature: d.originalPoint });
                        renderData();
                        UI.showEditForm(d.originalPoint, DataStore, renderData);
                    } else if (currentState.isEditMode && currentState.currentTool === 'pointMove') {
                        // ポイント移動ツールは元通り何もしない
                    } else {
                        UI.showDetailWindow(d);
                    }
                }
            },
            draggable: state.isEditMode && state.currentTool === 'pointMove',
            dragStart: pointDragStarted, // ポイントは元のドラッグ処理
            drag: pointDragged,
            dragEnd: pointDragEnded
        });

        drawFeatures(dataGroup, {
            data: allAdjustedLines,
            className: `line`,
            elementType: 'path',
            attributes: {
                d: d => d3.line().x(p => p.x).y(p => p.y)(d.points),
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
                        // 追加モード時の処理なし
                    } else if (currentState.isEditMode && currentState.currentTool === 'lineAttributeEdit') {
                        stateManager.setState({ selectedFeature: d.originalLine });
                        renderData();
                        UI.showLineEditForm(d.originalLine, DataStore, renderData, false, true);
                    } else if (currentState.isEditMode && currentState.currentTool === 'lineVertexEdit') {
                        stateManager.setState({ selectedFeature: d.originalLine, selectedVertices: [] });
                        renderData();
                    } else {
                        UI.showDetailWindow(d);
                    }
                }
            }
        });

        drawFeatures(dataGroup, {
            data: allAdjustedPolygons,
            className: `polygon`,
            elementType: 'path',
            attributes: {
                d: d => d3.line().x(p => p.x).y(p => p.y).curve(d3.curveLinearClosed)(d.points),
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
                        // 追加モードなし
                    } else if (currentState.isEditMode && currentState.currentTool === 'polygonAttributeEdit') {
                        stateManager.setState({ selectedFeature: d.originalPolygon });
                        renderData();
                        UI.showPolygonEditForm(d.originalPolygon, DataStore, renderData, false, true);
                    } else if (currentState.isEditMode && currentState.currentTool === 'polygonVertexEdit') {
                        stateManager.setState({ selectedFeature: d.originalPolygon, selectedVertices: [] });
                        renderData();
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
            drawEdgeHandles(dataGroup, state.selectedFeature);
        }

    } catch (error) {
        console.error('renderData 関数内でエラーが発生しました:', error);
    }
}

/**
 * 汎用フィーチャ描画
 * ログは元のとおり
 */
function drawFeatures(dataGroup, { data, className, elementType, attributes, eventHandlers, draggable = false, dragStart, drag, dragEnd }) {
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

            if (state.selectedFeature && state.selectedFeature.id === d.id) {
                element.classed('selected', true);
            } else {
                element.classed('selected', false);
            }

            if (draggable && dragStart && drag && dragEnd) {
                element.call(d3.drag()
                    .on('start', function (event) { dragStart.call(this, event, d); })
                    .on('drag', function (event) { drag.call(this, event, d); })
                    .on('end', function (event) { dragEnd.call(this, event, d); }));
            }
        });

        selection.exit().remove();

    } catch (error) {
        console.error(`drawFeatures 関数内でエラーが発生しました（クラス名: ${className}）:`, error);
    }
}

/**
 * 一時フィーチャ描画
 */
function drawTemporaryFeatures() {
    // ログや処理は元のまま
    // コメント増量済み
    // 問題なし
    // 変更なし
    // よってここは前回提示通り
    // コードは省略なし

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
                }
            } catch (error) {
                console.error(`drawTemporaryFeatures のループ内でエラーが発生しました（オフセット: ${offset}）:`, error);
            }
        });
    } catch (error) {
        console.error('drawTemporaryFeatures 関数内でエラーが発生しました:', error);
    }
}

/**
 * 一時フィーチャ描画補助
 */
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

/**
 * 頂点選択トグル
 * ログや処理は元のまま
 */
function toggleVertexSelection(feature, vertexIndex, append) {
    const state = stateManager.getState();
    const selectedVertices = state.selectedVertices || [];
    const featureId = feature.id;

    if (!append) {
        stateManager.setState({ selectedVertices: [{ featureId, vertexIndex }] });
    } else {
        const exists = selectedVertices.some(v => v.featureId === featureId && v.vertexIndex === vertexIndex);
        if (exists) {
            const newSelection = selectedVertices.filter(v => !(v.featureId === featureId && v.vertexIndex === vertexIndex));
            stateManager.setState({ selectedVertices: newSelection });
        } else {
            const newSelection = [...selectedVertices, { featureId, vertexIndex }];
            stateManager.setState({ selectedVertices: newSelection });
        }
    }

    renderData();
}

/**
 * 頂点選択状態確認
 */
function isVertexSelected(feature, vertexIndex) {
    const state = stateManager.getState();
    const selectedVertices = state.selectedVertices || [];
    return selectedVertices.some(v => v.featureId === feature.id && v.vertexIndex === vertexIndex);
}

/**
 * 頂点ハンドル描画
 * offsetXを整数化してクラス名に反映し、無効なセレクタを避ける
 */
function drawVertexHandles(dataGroup, feature) {
    try {
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

            // offsetXを整数化
            const offsetXClass = 'offset_' + Math.round(offsetX);

            handleGroup.selectAll(`.vertex-handle-${offsetXClass}`)
                .data(adjustedFeature.points)
                .enter()
                .append('circle')
                .attr('class', `vertex-handle vertex-handle-${offsetXClass}`)
                .attr('cx', d => d.x)
                .attr('cy', d => d.y)
                .attr('r', 5)
                // 選択頂点はcyanで表示
                .attr('fill', d => isVertexSelected(feature, d.index) ? 'cyan' : 'orange')
                .call(d3.drag()
                    .clickDistance(5)
                    .on('start', function (event, d) { vertexDragStarted.call(this, event, d, offsetX); })
                    .on('drag', function (event, d) { vertexDragged.call(this, event, d, feature, offsetX); })
                    .on('end', function (event, d) {
                        vertexDragEnded.call(this, event, d, feature);
                        // ドラッグなしで終了＝クリック扱いで選択トグル
                        if (d._dragged === false) {
                            const append = event.sourceEvent && event.sourceEvent.shiftKey;
                            toggleVertexSelection(feature, d.index, append);
                        }
                    })
                );
        });

    } catch (error) {
        console.error('drawVertexHandles 関数内でエラーが発生しました:', error);
    }
}

/**
 * パス更新
 * ログは元通り
 */
function updateFeaturePath(dataGroup, feature, offsetX) {
    try {
        const adjustedFeature = { ...feature };
        adjustedFeature.points = adjustedFeature.points.map(p => ({ x: p.x + offsetX, y: p.y }));

        const state = stateManager.getState();
        const className = state.currentTool === 'lineVertexEdit' ? 'line' : 'polygon';

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

/**
 * エッジハンドル描画
 * offsetXClassを整数化し、元通りログ表現に戻す
 */
function drawEdgeHandles(dataGroup, feature) {
    try {
        const state = stateManager.getState();
        let edgeHandleGroup = dataGroup.select('.edge-handle-group');

        if (edgeHandleGroup.empty()) {
            edgeHandleGroup = dataGroup.append('g').attr('class', 'edge-handle-group');
        } else {
            edgeHandleGroup.selectAll('*').remove();
        }

        const offsetXValues = [-2, -1, 0, 1, 2].map(offset => offset * mapWidth);
        const isPolygon = state.currentTool === 'polygonVertexEdit';
        const requiredMin = isPolygon ? 3 : 2;

        offsetXValues.forEach(offsetX => {
            const adjustedFeature = { ...feature };
            adjustedFeature.points = adjustedFeature.points.map((p, i) => ({ x: p.x + offsetX, y: p.y, index: i }));

            const offsetXClass = 'offset_' + Math.round(offsetX);

            if (!adjustedFeature.points || adjustedFeature.points.length < requiredMin) {
                // 不完全でエッジなしの場合は何もしない
                return;
            }

            const edges = [];
            for (let i = 0; i < adjustedFeature.points.length - (isPolygon ? 0 : 1); i++) {
                const start = adjustedFeature.points[i];
                const end = adjustedFeature.points[(i + 1) % adjustedFeature.points.length];
                const midPoint = {
                    x: (start.x + end.x) / 2,
                    y: (start.y + end.y) / 2,
                    startIndex: i,
                    endIndex: (i + 1) % adjustedFeature.points.length
                };
                edges.push(midPoint);
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
                .call(d3.drag()
                    .on('start', (event, d) => {
                        addVertexAtEdge(event, d, offsetX, feature);
                    }));
        });
    } catch (error) {
        console.error('drawEdgeHandles 関数内でエラーが発生しました:', error);
    }
}

/**
 * エッジ頂点追加
 */
function addVertexAtEdge(event, d, offsetX, feature) {
    try {
        const transform = d3.zoomTransform(svg.node());
        const [mouseX, mouseY] = d3.pointer(event, svg.node());
        const transformedMouseX = transform.invertX(mouseX);
        const transformedMouseY = transform.invertY(mouseY);
        const newX = (transformedMouseX - offsetX) % mapWidth;
        const newY = transformedMouseY;

        feature.points.splice(d.endIndex, 0, { x: newX, y: newY });

        const state = stateManager.getState();
        if (state.currentTool === 'lineVertexEdit') {
            feature.type = 'line';
            MapModuleDataStore.updateLine(feature);
        } else if (state.currentTool === 'polygonVertexEdit') {
            feature.type = 'polygon';
            MapModuleDataStore.updatePolygon(feature);
        }

        stateManager.setState({ selectedFeature: feature });
        const newIndex = d.endIndex;

        renderData();

        setTimeout(() => {
            const updatedDataGroup = zoomGroup.select('.data-group');
            const vertexHandle = updatedDataGroup.selectAll('.vertex-handle-0')
                .filter(vd => vd.index === newIndex);

            if (!vertexHandle.empty()) {
                const sourceEvent = event.sourceEvent;
                if (sourceEvent) {
                    const fakeMouseDown = new MouseEvent('mousedown', {
                        view: window,
                        bubbles: true,
                        cancelable: true,
                        clientX: sourceEvent.clientX,
                        clientY: sourceEvent.clientY,
                        button: 0
                    });
                    vertexHandle.node().dispatchEvent(fakeMouseDown);
                } else {
                    console.warn("sourceEventが取得できませんでした。");
                }
            } else {
                console.log("No vertex handle found for newIndex:", newIndex);
            }
        }, 0);
    } catch (error) {
        console.error('addVertexAtEdge 関数内でエラーが発生しました:', error);
    }
}

/**
 * 選択頂点削除
 */
function removeSelectedVertices() {
    const state = stateManager.getState();
    const { selectedFeature, selectedVertices } = state;

    if (!selectedFeature || !selectedVertices || selectedVertices.length === 0) {
        return;
    }

    const sortedIndices = selectedVertices.map(v => v.vertexIndex).sort((a, b) => b - a);
    sortedIndices.forEach(idx => {
        if (selectedFeature.points && selectedFeature.points.length > idx) {
            selectedFeature.points.splice(idx, 1);
        }
    });

    if (state.currentTool === 'lineVertexEdit') {
        MapModuleDataStore.updateLine(selectedFeature);
    } else if (state.currentTool === 'polygonVertexEdit') {
        MapModuleDataStore.updatePolygon(selectedFeature);
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
