// src/map/mapRenderer.js

import stateManager from '../state/index.js';

import {
    vertexDragStarted,
    vertexDragged,
    vertexDragEnded,
    edgeDragStarted,
    edgeDragged,
    edgeDragEnded
} from './mapInteraction.js';

import uiManager from '../ui/uiManager.js';
import tooltips from '../ui/tooltips.js';
import {
    showEditForm,
    showLineEditForm,
    showPolygonEditForm,
    showDetailWindow
} from '../ui/forms.js';
import { debugLog } from '../utils/logger.js';

let svg;
let zoomGroup;
let mapWidth = 1000;
let mapHeight = 800;
let zoom;

let MapModuleDataStore;

/**
 * 地図を読み込み、マップを横方向に複製
 */
function loadMap(_DataStore, _UI, renderDataFunc) {
    debugLog(4, 'loadMap() が呼び出されました。');
    try {
        return new Promise((resolve, reject) => {
            try {
                MapModuleDataStore = _DataStore;

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
                            debugLog(1, `ズームイベント中にエラー発生: ${error}`);
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
                        debugLog(1, `地図の初期化中にエラー発生: ${error}`);
                        uiManager.hideAllForms();
                        reject(error);
                    }
                }).catch((error) => {
                    debugLog(1, `SVGファイル読み込みエラー: ${error}`);
                    uiManager.hideAllForms();
                    reject(error);
                });
            } catch (error) {
                debugLog(1, `loadMap() 内部でエラー発生: ${error}`);
                uiManager.hideAllForms();
                reject(error);
            }
        });
    } catch (error) {
        debugLog(1, `loadMap() 外枠でエラー発生: ${error}`);
        // ここでは return しないまま、内部の Promise も正しく機能しないため
        // 必要なら `return Promise.reject(error)` などの処理をしても良い
        return Promise.reject(error);
    }
}

/**
 * 全データを再描画
 */
function renderData() {
    debugLog(4, 'renderData() が呼び出されました。');
    try {
        const st = stateManager.getState();

        zoomGroup.selectAll('.data-group').remove();
        zoomGroup.selectAll('.temp-feature-group').remove();

        const dataGroup = zoomGroup.append('g').attr('class', 'data-group');

        const currentYear = st.currentYear || 0;

        let points = MapModuleDataStore.getPoints(currentYear);
        let lines = MapModuleDataStore.getLines(currentYear);
        let polygons = MapModuleDataStore.getPolygons(currentYear);

        points.forEach(p => { if (!p.id) p.id = Date.now() + Math.random(); });
        lines.forEach(l => { if (!l.id) l.id = Date.now() + Math.random(); });
        polygons.forEach(pg => { if (!pg.id) pg.id = Date.now() + Math.random(); });

        // 頂点が2点しかないポリゴンは一時的にライン扱い
        const polygonsToLine = polygons.filter(pg => pg.points && pg.points.length === 2);
        polygons = polygons.filter(pg => !(pg.points && pg.points.length === 2));

        lines = lines.filter(l => l.points && l.points.length >= 2);
        polygons = polygons.filter(pg => pg.points && pg.points.length >= 3);

        lines.push(...polygonsToLine.map(pg => ({ ...pg, originalLine: pg.originalPolygon || pg })));

        const mapCopies = [-2, -1, 0, 1, 2];

        function duplicateFeature(feature, offsetX) {
            debugLog(4, `duplicateFeature() を呼び出します。feature.id=${feature?.id}, offsetX=${offsetX}`);
            try {
                const duplicated = { ...feature };
                duplicated.points = duplicated.points.map(p => ({
                    x: p.x + offsetX,
                    y: p.y
                }));
                return duplicated;
            } catch (error) {
                debugLog(1, `duplicateFeature() でエラー発生: ${error}`);
                return feature; // エラー時はそのまま返しておく
            }
        }

        let allAdjustedPoints = [];
        let allAdjustedLines = [];
        let allAdjustedPolygons = [];

        mapCopies.forEach(offset => {
            const offsetX = offset * mapWidth;
            try {
                allAdjustedPoints.push(...points.map(pt => {
                    const dup = duplicateFeature(pt, offsetX);
                    dup.originalPoint = pt;
                    return dup;
                }));
                allAdjustedLines.push(...lines.map(ln => {
                    const dup = duplicateFeature(ln, offsetX);
                    dup.originalLine = ln.originalLine || ln;
                    return dup;
                }));
                allAdjustedPolygons.push(...polygons.map(pg => {
                    const dup = duplicateFeature(pg, offsetX);
                    dup.originalPolygon = pg.originalPolygon || pg;
                    return dup;
                }));
            } catch (error) {
                debugLog(1, `mapCopies のループ内でエラーが発生しました（offset=${offset}）: ${error}`);
            }
        });

        // ポリゴン描画
        drawFeatures(dataGroup, {
            data: allAdjustedPolygons,
            className: 'polygon',
            elementType: 'path',
            attributes: {
                d: d => {
                    if (!d.points || d.points.length < 3) return null;
                    return d3.line().x(p => p.x).y(p => p.y).curve(d3.curveLinearClosed)(d.points);
                },
                stroke: 'green',
                'stroke-width': 2,
                fill: 'rgba(0,255,0,0.3)',
                'pointer-events': 'all'
            },
            eventHandlers: {
                mouseover: (event, d) => tooltips.showTooltip(event, d),
                mousemove: tooltips.moveTooltip,
                mouseout: tooltips.hideTooltip,
                click: (event, d) => {
                    try {
                        event.stopPropagation();
                        debugLog(4, `polygon click: polygon.id=${d?.id}`);
                        const cst = stateManager.getState();

                        const pageX = event.sourceEvent ? event.sourceEvent.pageX : event.pageX;
                        const pageY = event.sourceEvent ? event.sourceEvent.pageY : event.pageY;

                        if (cst.isAddMode) {
                            // 追加モード中は無視
                        } else if (cst.isEditMode && cst.currentTool === 'polygonAttributeEdit') {
                            if (!d.originalPolygon.id) d.originalPolygon.id = d.id;
                            stateManager.setState({ selectedFeature: d.originalPolygon });
                            renderData();
                            showPolygonEditForm(d.originalPolygon, renderData, false, true, pageX, pageY);
                        } else if (cst.isEditMode && cst.currentTool === 'polygonVertexEdit') {
                            if (!d.originalPolygon.id) d.originalPolygon.id = d.id;
                            stateManager.setState({ selectedFeature: d.originalPolygon, selectedVertices: [] });
                            renderData();
                        } else if (!cst.isEditMode) {
                            showDetailWindow(d, pageX, pageY);
                        }
                    } catch (error) {
                        debugLog(1, `polygon.click ハンドラでエラー発生: ${error}`);
                    }
                }
            }
        });

        // ライン描画
        drawFeatures(dataGroup, {
            data: allAdjustedLines,
            className: 'line',
            elementType: 'path',
            attributes: {
                d: d => {
                    if (!d.points || d.points.length < 2) return null;
                    return d3.line().x(p => p.x).y(p => p.y)(d.points);
                },
                stroke: 'blue',
                'stroke-width': 2,
                fill: 'none',
                'pointer-events': 'all'
            },
            eventHandlers: {
                mouseover: (event, d) => tooltips.showTooltip(event, d),
                mousemove: tooltips.moveTooltip,
                mouseout: tooltips.hideTooltip,
                click: (event, d) => {
                    try {
                        event.stopPropagation();
                        debugLog(4, `line click: line.id=${d?.id}`);
                        const cst = stateManager.getState();

                        const pageX = event.sourceEvent ? event.sourceEvent.pageX : event.pageX;
                        const pageY = event.sourceEvent ? event.sourceEvent.pageY : event.pageY;

                        if (cst.isAddMode) {
                            // 追加モード中は無視
                        } else if (cst.isEditMode && cst.currentTool === 'lineAttributeEdit') {
                            if (!d.originalLine.id) d.originalLine.id = d.id;
                            stateManager.setState({ selectedFeature: d.originalLine });
                            renderData();
                            showLineEditForm(d.originalLine, renderData, false, true, pageX, pageY);
                        } else if (cst.isEditMode && cst.currentTool === 'lineVertexEdit') {
                            if (!d.originalLine.id) d.originalLine.id = d.id;
                            stateManager.setState({ selectedFeature: d.originalLine, selectedVertices: [] });
                            renderData();
                        } else if (!cst.isEditMode) {
                            showDetailWindow(d, pageX, pageY);
                        }
                    } catch (error) {
                        debugLog(1, `line.click ハンドラでエラー発生: ${error}`);
                    }
                }
            }
        });

        // ポイント描画
        drawFeatures(dataGroup, {
            data: allAdjustedPoints,
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
                mouseover: (event, d) => tooltips.showTooltip(event, d),
                mousemove: tooltips.moveTooltip,
                mouseout: tooltips.hideTooltip,
                click: (event, d) => {
                    try {
                        event.stopPropagation();
                        debugLog(4, `point click: point.id=${d?.id}`);
                        const cst = stateManager.getState();

                        const pageX = event.sourceEvent ? event.sourceEvent.pageX : event.pageX;
                        const pageY = event.sourceEvent ? event.sourceEvent.pageY : event.pageY;

                        if (cst.isAddMode) {
                            // 追加モード中は無視
                        } else {
                            if (cst.isEditMode && cst.currentTool === 'pointAttributeEdit') {
                                if (!d.originalPoint.id) d.originalPoint.id = d.id;
                                stateManager.setState({ selectedFeature: d.originalPoint });
                                renderData();
                                showEditForm(d.originalPoint, renderData, pageX, pageY);
                            } else if (!cst.isEditMode) {
                                showDetailWindow(d, pageX, pageY);
                            } else if (cst.isEditMode && cst.currentTool === 'pointMove') {
                                if (!d.originalPoint.id) d.originalPoint.id = d.id;
                                stateManager.setState({ selectedFeature: d.originalPoint, selectedVertices: [] });
                                renderData();
                            }
                        }
                    } catch (error) {
                        debugLog(1, `point.click ハンドラでエラー発生: ${error}`);
                    }
                }
            }
        });

        // 作図中の一時オブジェクト描画
        if (st.isDrawing) {
            drawTemporaryFeatures(st);
        }

        // 単頂点ポイントの頂点ハンドル (pointMoveTool)
        const selectedFeature = st.selectedFeature;
        if (
            st.isEditMode &&
            st.currentTool === 'pointMove' &&
            selectedFeature &&
            selectedFeature.points &&
            selectedFeature.points.length === 1
        ) {
            drawVertexHandles(dataGroup, selectedFeature);
        }

        // ライン/ポリゴン頂点編集
        if (
            st.isEditMode &&
            (st.currentTool === 'lineVertexEdit' || st.currentTool === 'polygonVertexEdit') &&
            st.selectedFeature
        ) {
            drawVertexHandles(dataGroup, st.selectedFeature);
            drawEdgeHandles(dataGroup, st.selectedFeature);
        }
    } catch (error) {
        debugLog(1, `renderData() でエラー発生: ${error}`);
    }
}

/**
 * 汎用的にフィーチャを描画
 */
function drawFeatures(container, { data, className, elementType, attributes, eventHandlers }) {
    try {
        debugLog(4, `drawFeatures() が呼び出されました。className=${className}`);
        const selection = container.selectAll(`.${className}`)
            .data(data, d => {
                if (!d.points || !d.points[0]) {
                    return `empty-${Math.random()}`;
                }
                return `${d.id || Math.random()}-${Math.floor(d.points[0].x / mapWidth)}`;
            });

        const enterSelection = selection.enter()
            .append(elementType)
            .attr('class', className);

        enterSelection.each(function (d) {
            try {
                const element = d3.select(this);
                for (const [attrName, attrValue] of Object.entries(attributes)) {
                    if (typeof attrValue === 'function') {
                        element.attr(attrName, attrValue(d));
                    } else {
                        element.attr(attrName, attrValue);
                    }
                }
                for (const [eventName, eventHandler] of Object.entries(eventHandlers)) {
                    element.on(eventName, eventHandler);
                }
            } catch (innerError) {
                debugLog(1, `drawFeatures enterSelection.each() でエラー発生: ${innerError}`);
            }
        });

        selection.each(function (d) {
            try {
                const element = d3.select(this);
                for (const [attrName, attrValue] of Object.entries(attributes)) {
                    if (typeof attrValue === 'function') {
                        element.attr(attrName, attrValue(d));
                    } else {
                        element.attr(attrName, attrValue);
                    }
                }
                for (const [eventName, eventHandler] of Object.entries(eventHandlers)) {
                    element.on(eventName, eventHandler);
                }
            } catch (innerError) {
                debugLog(1, `drawFeatures selection.each() でエラー発生: ${innerError}`);
            }
        });

        selection.exit().remove();

        // 選択中フィーチャをハイライト
        const st = stateManager.getState();
        if (st.selectedFeature && st.selectedFeature.id) {
            container.selectAll(`.${className}`)
                .filter(d => d.id === st.selectedFeature.id)
                .each(function () {
                    try {
                        const element = d3.select(this);
                        if (className === 'line' || className === 'polygon') {
                            element.attr('stroke', 'orange').attr('stroke-width', 4);
                        } else if (className === 'point') {
                            element.attr('fill', 'magenta');
                        }
                    } catch (innerError) {
                        debugLog(1, `drawFeatures ハイライト処理中にエラー: ${innerError}`);
                    }
                });
        }
    } catch (error) {
        debugLog(1, `drawFeatures() のtry-catch外枠でエラー発生（クラス名: ${className}）: ${error}`);
    }
}

/**
 * 作図中の一時オブジェクトを描画
 */
function drawTemporaryFeatures(state) {
    try {
        debugLog(4, 'drawTemporaryFeatures() が呼び出されました。');
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
                    const arr = state.tempLinePoints.map(p => ({ x: p.x + offsetX, y: p.y }));
                    drawTemporaryFeature(tempGroup, {
                        data: [arr],
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
                        data: arr,
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
                    const arr = state.tempPolygonPoints.map(p => ({ x: p.x + offsetX, y: p.y }));
                    drawTemporaryFeature(tempGroup, {
                        data: [arr],
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
                        data: arr,
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
                    const arr = [{ x: state.tempPoint.x + offsetX, y: state.tempPoint.y }];
                    drawTemporaryFeature(tempGroup, {
                        data: arr,
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
            } catch (innerError) {
                debugLog(1, `drawTemporaryFeatures ループ内 (offset=${offset}) でエラー発生: ${innerError}`);
            }
        });
    } catch (error) {
        debugLog(1, `drawTemporaryFeatures() 外枠でエラー発生: ${error}`);
    }
}

function drawTemporaryFeature(group, { data, className, elementType, attributes, style }) {
    try {
        debugLog(4, `drawTemporaryFeature() が呼び出されました。className=${className}`);
        const tempGroup = group.append('g').attr('class', 'temp-feature');
        const elements = tempGroup.selectAll(`.${className}`)
            .data(data)
            .enter()
            .append(elementType)
            .attr('class', className);

        if (elementType === 'path') {
            elements.attr('d', d => attributes.d(d));
        } else {
            for (const [attrName, attrValue] of Object.entries(attributes)) {
                elements.attr(attrName, typeof attrValue === 'function' ? (dd => attrValue(dd)) : attrValue);
            }
        }

        if (style) {
            for (const [styleName, styleValue] of Object.entries(style)) {
                elements.style(styleName, styleValue);
            }
        }
    } catch (error) {
        debugLog(1, `drawTemporaryFeature() でエラー発生 (className=${className}): ${error}`);
    }
}

/**
 * ライン/ポリゴン頂点編集時の頂点ハンドル表示
 */
function drawVertexHandles(dataGroup, feature) {
    try {
        debugLog(4, `drawVertexHandles() が呼び出されました。feature.id=${feature?.id}`);
        if (!feature.id) {
            feature.id = Date.now() + Math.random();
        }

        dataGroup.selectAll('.vertex-handle-group').remove();
        const handleGroup = dataGroup.append('g').attr('class', 'vertex-handle-group');

        const st = stateManager.getState();
        const selectedVertices = st.selectedVertices || [];

        const offsetXValues = [-2, -1, 0, 1, 2].map(offset => offset * mapWidth);
        offsetXValues.forEach(offsetX => {
            try {
                const adjustedFeature = { ...feature };
                adjustedFeature.points = adjustedFeature.points.map((p, i) => ({
                    x: p.x + offsetX,
                    y: p.y,
                    index: i
                }));

                const offsetXClass = 'offset_' + Math.round(offsetX);

                const vertices = handleGroup.selectAll(`.vertex-handle-${offsetXClass}`)
                    .data(adjustedFeature.points, d => d.index);

                const enterVertices = vertices.enter().append('circle');
                enterVertices.merge(vertices)
                    .attr('class', `vertex-handle vertex-handle-${offsetXClass}`)
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y)
                    .attr('r', 5)
                    .attr('fill', d => {
                        const isSelected = selectedVertices.some(
                            v => v.featureId === feature.id && v.vertexIndex === d.index
                        );
                        return isSelected ? 'magenta' : 'orange';
                    })
                    .style('pointer-events', 'all')
                    .call(d3.drag()
                        .on('start', (event, dData) => {
                            vertexDragStarted(event, dData, offsetX, feature);
                        })
                        .on('drag', (event, dData) => {
                            vertexDragged(event, dData);
                        })
                        .on('end', (event, dData) => {
                            vertexDragEnded(event, dData, feature);
                        })
                    );

                vertices.exit().remove();
            } catch (innerError) {
                debugLog(1, `drawVertexHandles() offsetXループ内でエラー発生: ${innerError}`);
            }
        });
    } catch (error) {
        debugLog(1, `drawVertexHandles() 外枠でエラー発生: ${error}`);
    }
}

/**
 * ライン/ポリゴン頂点編集時のエッジハンドル描画
 */
function drawEdgeHandles(dataGroup, feature) {
    try {
        debugLog(4, `drawEdgeHandles() が呼び出されました。feature.id=${feature?.id}`);
        if (!feature.points || feature.points.length <= 1) {
            return;
        }

        dataGroup.selectAll('.edge-handle-group').remove();
        const edgeHandleGroup = dataGroup.append('g').attr('class', 'edge-handle-group');

        const st = stateManager.getState();
        const isPolygon = st.currentTool === 'polygonVertexEdit';
        const requiredMin = isPolygon ? 3 : 2;
        if (feature.points.length < requiredMin) {
            return;
        }

        const offsetXValues = [-2, -1, 0, 1, 2].map(offset => offset * mapWidth);
        offsetXValues.forEach(offsetX => {
            try {
                const adjustedFeature = { ...feature };
                adjustedFeature.points = adjustedFeature.points.map((p, i) => ({
                    x: p.x + offsetX,
                    y: p.y,
                    index: i
                }));

                const offsetXClass = 'offset_' + Math.round(offsetX);

                const edges = [];
                // ポリゴンの場合は「最終点→先頭点」も繋ぐ
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
                    .call(d3.drag()
                        .on('start', (event, dData) => {
                            edgeDragStarted(event, dData, offsetX, feature);
                        })
                        .on('drag', (event, dData) => {
                            edgeDragged(event, dData);
                        })
                        .on('end', (event, dData) => {
                            edgeDragEnded(event, dData, feature);
                        })
                    );
            } catch (innerError) {
                debugLog(1, `drawEdgeHandles() offsetXループ内でエラー発生: ${innerError}`);
            }
        });
    } catch (error) {
        debugLog(1, `drawEdgeHandles() 外枠でエラー発生: ${error}`);
    }
}

function disableMapZoom() {
    try {
        debugLog(4, 'disableMapZoom() が呼び出されました。');
        svg.on('.zoom', null);
    } catch (error) {
        debugLog(1, `disableMapZoom() でエラー発生: ${error}`);
    }
}

function enableMapZoom() {
    try {
        debugLog(4, 'enableMapZoom() が呼び出されました。');
        svg.call(zoom);
    } catch (error) {
        debugLog(1, `enableMapZoom() でエラー発生: ${error}`);
    }
}

function getMapWidth() {
    try {
        return mapWidth;
    } catch (error) {
        debugLog(1, `getMapWidth() でエラー発生: ${error}`);
        return 1000; // デフォルト値
    }
}

function getMapHeight() {
    try {
        return mapHeight;
    } catch (error) {
        debugLog(1, `getMapHeight() でエラー発生: ${error}`);
        return 800; // デフォルト値
    }
}

export {
    loadMap,
    renderData,
    getMapWidth,
    getMapHeight,
    disableMapZoom,
    enableMapZoom
};
