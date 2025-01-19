// src/map/mapRenderer/index.js
/****************************************************
 * マップの読み込み、描画、ズーム操作など
 *
 * 修正点:
 *   1) ドラッグ中の循環参照エラーを防ぐため、mapInteraction/drag.js 側と合わせて
 *      originalLine/originalPolygon/originalPoint を扱わないようにする。
 *   2) クリック時に選択されるオブジェクトは「レンダリング用オブジェクト (pointsなどを直接持つ)」。
 *   3) 頂点ハンドルやエッジハンドルが正常に描画されるように調整。
 ****************************************************/

import stateManager from '../../state/index.js';
import uiManager from '../../ui/uiManager.js';
import tooltips from '../../ui/tooltips.js';
import {
    showEditForm,
    showLineEditForm,
    showPolygonEditForm,
    showDetailWindow
} from '../../ui/forms.js';
import { debugLog } from '../../utils/logger.js';
import { drawFeatures } from './drawFeatures.js';
import { drawVertexHandles, drawEdgeHandles } from './drawHandles.js';

let zoom;
let svg;
let zoomGroup;
let mapWidth = 1000;
let mapHeight = 800;
let MapModuleDataStore;

export const colorScheme = {
    pointFill: 'red',
    lineStroke: 'blue',
    polygonStroke: 'green',
    polygonFill: 'rgba(0,255,0,0.3)',
    highlightStroke: 'orange',
    highlightStrokeWidth: 4,
    highlightPointFill: 'magenta',
    vertexNormal: 'greenyellow',
    vertexSelected: 'magenta',
    edgeHandleFill: 'yellow',
    tempLineStroke: 'orange',
    tempPolygonStroke: 'orange',
    tempPolygonFill: 'rgba(255,165,0,0.3)',
    tempPointFill: 'orange',
};

export function getCurrentZoomScale() {
    try {
        if (!svg) return 1;
        const transform = d3.zoomTransform(svg.node());
        return transform.k || 1;
    } catch (error) {
        debugLog(1, `getCurrentZoomScale() でエラー発生: ${error}`);
        return 1;
    }
}

export function loadMap(_DataStore, _UI, renderDataFunc) {
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
                            renderDataFunc();
                        } catch (error) {
                            debugLog(1, `ズームイベント中にエラー: ${error}`);
                        }
                    });

                svg.call(zoom);

                const mapSvgUrl = 'map.svg';
                d3.xml(mapSvgUrl).then((xml) => {
                    try {
                        const mapSvg = xml.documentElement;

                        const viewBox = mapSvg.getAttribute('viewBox');
                        if (viewBox) {
                            const vbVals = viewBox.split(' ').map(Number);
                            if (vbVals.length === 4) {
                                mapWidth = vbVals[2];
                                mapHeight = vbVals[3];
                            }
                        } else {
                            const wAttr = parseFloat(mapSvg.getAttribute('width'));
                            const hAttr = parseFloat(mapSvg.getAttribute('height'));
                            if (!isNaN(wAttr)) mapWidth = wAttr;
                            if (!isNaN(hAttr)) mapHeight = hAttr;
                        }

                        for (let i = -2; i <= 2; i++) {
                            const mapClone = mapSvg.cloneNode(true);
                            mapClone.removeAttribute('width');
                            mapClone.removeAttribute('height');

                            const styleElement = xml.createElement('style');
                            styleElement.textContent = `
                                path {
                                    fill-rule: evenodd !important;
                                    clip-rule: evenodd !important;
                                }
                            `;
                            mapClone.insertBefore(styleElement, mapClone.firstChild);

                            const mapGroup = zoomGroup.append('g')
                                .attr('transform', `translate(${i * mapWidth}, 0)`);
                            mapGroup.node().appendChild(mapClone);
                        }

                        svg
                            .attr('viewBox', `0 0 ${mapWidth} ${mapHeight}`)
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
        return Promise.reject(error);
    }
}

export function renderData() {
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

        points.forEach((p) => {
            if (!p.id) p.id = Date.now() + Math.random();
        });
        lines.forEach((l) => {
            if (!l.id) l.id = Date.now() + Math.random();
        });
        polygons.forEach((pg) => {
            if (!pg.id) pg.id = Date.now() + Math.random();
        });

        // ポリゴンなのに頂点数が2しかない場合 → ラインとして扱う
        const polygonsToLine = polygons.filter((pg) => pg.points && pg.points.length === 2);
        polygons = polygons.filter((pg) => !(pg.points && pg.points.length === 2));

        lines = lines.filter((l) => l.points && l.points.length >= 2);
        polygons = polygons.filter((pg) => pg.points && pg.points.length >= 3);

        // 上記で弾かれたポリゴンをライン扱いに追加
        lines.push(...polygonsToLine.map((pg) => ({
            ...pg,
            // originalLine: pg.originalPolygon || pg  → 循環参照を呼ぶ可能性があるため使用しない
        })));

        const k = getCurrentZoomScale();
        const mapCopies = [-2, -1, 0, 1, 2];

        let allAdjustedPoints = [];
        let allAdjustedLines = [];
        let allAdjustedPolygons = [];

        // 地図を複数横に並べる ( -2~2 )
        mapCopies.forEach((offset) => {
            const offsetX = offset * mapWidth;
            try {
                // Points
                allAdjustedPoints.push(
                    ...points.map((pt) => {
                        const dup = { ...pt };
                        dup.points = (dup.points || []).map((p) => ({
                            x: p.x + offsetX,
                            y: p.y
                        }));
                        return dup;
                    })
                );
                // Lines
                allAdjustedLines.push(
                    ...lines.map((ln) => {
                        const dup = { ...ln };
                        dup.points = (dup.points || []).map((p) => ({
                            x: p.x + offsetX,
                            y: p.y
                        }));
                        return dup;
                    })
                );
                // Polygons
                allAdjustedPolygons.push(
                    ...polygons.map((pg) => {
                        const dup = { ...pg };
                        dup.points = (dup.points || []).map((p) => ({
                            x: p.x + offsetX,
                            y: p.y
                        }));
                        return dup;
                    })
                );
            } catch (error) {
                debugLog(1, `mapCopies offset=${offset} でエラー: ${error}`);
            }
        });

        // 実際の描画処理
        drawPolygons(dataGroup, allAdjustedPolygons, k);
        drawLines(dataGroup, allAdjustedLines, k);
        drawPoints(dataGroup, allAdjustedPoints, k);

        // 追加モードで描画中の要素 (仮線/仮ポリゴンなど)
        if (st.isDrawing) {
            drawTemporaryFeatures(st);
        }

        // 選択中フィーチャに頂点ハンドルを描画 (編集モード時)
        const selectedFeature = st.selectedFeature;
        if (st.isEditMode && selectedFeature && selectedFeature.points && selectedFeature.points.length > 0) {
            if (st.currentTool === 'pointMove' && selectedFeature.points.length === 1) {
                // 単一点 → ドラッグで移動可能
                drawVertexHandles(dataGroup, selectedFeature);
            } else if (
                st.currentTool === 'lineVertexEdit' ||
                st.currentTool === 'polygonVertexEdit'
            ) {
                // 頂点ハンドルとエッジハンドルを表示
                drawVertexHandles(dataGroup, selectedFeature);
                drawEdgeHandles(dataGroup, selectedFeature);
            }
        }
    } catch (error) {
        debugLog(1, `renderData() でエラー: ${error}`);
    }
}

/**
 * ポリゴン描画
 */
function drawPolygons(dataGroup, polygons, k) {
    drawFeatures(
        dataGroup,
        {
            data: polygons,
            className: 'polygon',
            elementType: 'path',
            attributes: {
                d: (d) => {
                    if (!d.points || d.points.length < 3) return null;
                    return d3.line()
                        .x((p) => p.x)
                        .y((p) => p.y)
                        .curve(d3.curveLinearClosed)(d.points);
                },
                stroke: colorScheme.polygonStroke,
                'stroke-width': 2,
                fill: colorScheme.polygonFill,
                'pointer-events': 'all'
            },
            style: {
                'vector-effect': 'non-scaling-stroke'
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
                            // 特に何もしない
                        } else if (cst.isEditMode) {
                            if (cst.currentTool === 'polygonAttributeEdit') {
                                stateManager.setState({ selectedFeature: d });
                                renderData();
                                showPolygonEditForm(d, renderData, false, true, pageX, pageY);
                            } else if (cst.currentTool === 'polygonVertexEdit') {
                                stateManager.setState({ selectedFeature: d, selectedVertices: [] });
                                renderData();
                            }
                        } else {
                            // 閲覧モードの場合 → 詳細ウィンドウ
                            showDetailWindow(d, pageX, pageY);
                        }
                    } catch (error) {
                        debugLog(1, `polygon.click でエラー: ${error}`);
                    }
                }
            }
        },
        k
    );
}

/**
 * ライン描画
 */
function drawLines(dataGroup, lines, k) {
    drawFeatures(
        dataGroup,
        {
            data: lines,
            className: 'line',
            elementType: 'path',
            attributes: {
                d: (d) => {
                    if (!d.points || d.points.length < 2) return null;
                    return d3.line()
                        .x((p) => p.x)
                        .y((p) => p.y)(d.points);
                },
                stroke: colorScheme.lineStroke,
                'stroke-width': 2,
                fill: 'none',
                'pointer-events': 'all'
            },
            style: {
                'vector-effect': 'non-scaling-stroke'
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
                            // 特に何もしない
                        } else if (cst.isEditMode) {
                            if (cst.currentTool === 'lineAttributeEdit') {
                                stateManager.setState({ selectedFeature: d });
                                renderData();
                                showLineEditForm(d, renderData, false, true, pageX, pageY);
                            } else if (cst.currentTool === 'lineVertexEdit') {
                                stateManager.setState({ selectedFeature: d, selectedVertices: [] });
                                renderData();
                            }
                        } else {
                            showDetailWindow(d, pageX, pageY);
                        }
                    } catch (error) {
                        debugLog(1, `line.click でエラー: ${error}`);
                    }
                }
            }
        },
        k
    );
}

/**
 * ポイント描画
 */
function drawPoints(dataGroup, points, k) {
    drawFeatures(
        dataGroup,
        {
            data: points,
            className: 'point',
            elementType: 'circle',
            attributes: {
                cx: (d) => (d.points && d.points[0]) ? d.points[0].x : 0,
                cy: (d) => (d.points && d.points[0]) ? d.points[0].y : 0,
                fill: colorScheme.pointFill,
                'pointer-events': 'all'
            },
            style: {
                'vector-effect': 'non-scaling-stroke'
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
                            // 特に何もしない
                        } else if (cst.isEditMode) {
                            if (cst.currentTool === 'pointAttributeEdit') {
                                stateManager.setState({ selectedFeature: d });
                                renderData();
                                showEditForm(d, renderData, pageX, pageY);
                            } else if (cst.currentTool === 'pointMove') {
                                stateManager.setState({ selectedFeature: d, selectedVertices: [] });
                                renderData();
                            }
                        } else {
                            showDetailWindow(d, pageX, pageY);
                        }
                    } catch (error) {
                        debugLog(1, `point.click でエラー: ${error}`);
                    }
                }
            }
        },
        k,
        true
    );
}

/**
 * 追加モードの際に描画する一時的な
 * ライン／ポリゴン／ポイントなど
 */
function drawTemporaryFeatures(state) {
    debugLog(4, 'drawTemporaryFeatures() が呼び出されました。');
    try {
        let tempGroup = zoomGroup.select('.temp-feature-group');
        if (tempGroup.empty()) {
            tempGroup = zoomGroup.append('g').attr('class', 'temp-feature-group');
        } else {
            tempGroup.selectAll('*').remove();
        }

        const k = getCurrentZoomScale();
        const mapCopies = [-1, 0, 1, 2];

        mapCopies.forEach((offset) => {
            const offsetX = offset * mapWidth;
            try {
                // ライン追加中
                if (state.currentTool === 'line' && state.tempLinePoints && state.tempLinePoints.length > 0) {
                    const arr = state.tempLinePoints.map((p) => ({
                        x: p.x + offsetX,
                        y: p.y
                    }));
                    drawTemporaryFeature(tempGroup, {
                        data: [arr],
                        className: `tempLine-${offset}`,
                        elementType: 'path',
                        attributes: {
                            d: (dd) => d3.line().x((pp) => pp.x).y((pp) => pp.y)(dd)
                        },
                        style: {
                            stroke: colorScheme.tempLineStroke,
                            'stroke-width': 2,
                            fill: 'none',
                            'vector-effect': 'non-scaling-stroke'
                        }
                    });
                    // 頂点の円
                    drawTemporaryFeature(tempGroup, {
                        data: arr,
                        className: `tempPoint-${offset}`,
                        elementType: 'circle',
                        attributes: {
                            cx: (d) => d.x,
                            cy: (d) => d.y,
                            r: 20 / k,
                            fill: colorScheme.tempPointFill
                        },
                        style: {
                            'vector-effect': 'non-scaling-stroke'
                        }
                    });

                    // ポリゴン追加中
                } else if (state.currentTool === 'polygon' && state.tempPolygonPoints && state.tempPolygonPoints.length > 0) {
                    const arr = state.tempPolygonPoints.map((p) => ({
                        x: p.x + offsetX,
                        y: p.y
                    }));
                    drawTemporaryFeature(tempGroup, {
                        data: [arr],
                        className: `tempPolygon-${offset}`,
                        elementType: 'path',
                        attributes: {
                            d: (dd) =>
                                d3.line()
                                    .x((pp) => pp.x)
                                    .y((pp) => pp.y)
                                    .curve(d3.curveLinearClosed)(dd)
                        },
                        style: {
                            stroke: colorScheme.tempPolygonStroke,
                            'stroke-width': 2,
                            fill: colorScheme.tempPolygonFill,
                            'vector-effect': 'non-scaling-stroke'
                        }
                    });
                    drawTemporaryFeature(tempGroup, {
                        data: arr,
                        className: `tempPoint-${offset}`,
                        elementType: 'circle',
                        attributes: {
                            cx: (d) => d.x,
                            cy: (d) => d.y,
                            r: 20 / k,
                            fill: colorScheme.tempPointFill
                        },
                        style: {
                            'vector-effect': 'non-scaling-stroke'
                        }
                    });

                    // ポイント追加中
                } else if (state.currentTool === 'point' && state.tempPoint) {
                    const arr = [{ x: state.tempPoint.x + offsetX, y: state.tempPoint.y }];
                    drawTemporaryFeature(tempGroup, {
                        data: arr,
                        className: `tempPoint-${offset}`,
                        elementType: 'circle',
                        attributes: {
                            cx: (d) => d.x,
                            cy: (d) => d.y,
                            r: 20 / k,
                            fill: colorScheme.tempPointFill
                        },
                        style: {
                            'vector-effect': 'non-scaling-stroke'
                        }
                    });
                }
            } catch (err) {
                debugLog(1, `drawTemporaryFeatures offset=${offset} でエラー: ${err}`);
            }
        });
    } catch (error) {
        debugLog(1, `drawTemporaryFeatures() でエラー: ${error}`);
    }
}

/**
 * 仮描画要素 (ライン・ポリゴン・ポイント) を配置する
 */
function drawTemporaryFeature(group, { data, className, elementType, attributes, style }) {
    debugLog(4, `drawTemporaryFeature() が呼び出されました。className=${className}`);
    try {
        const tempGroup = group.append('g').attr('class', 'temp-feature');
        const elements = tempGroup.selectAll(`.${className}`)
            .data(data)
            .enter()
            .append(elementType)
            .attr('class', className);

        elements.each(function (dd) {
            const el = d3.select(this);
            for (const [attrName, attrValue] of Object.entries(attributes)) {
                if (typeof attrValue === 'function') {
                    el.attr(attrName, attrValue(dd));
                } else {
                    el.attr(attrName, attrValue);
                }
            }
            if (style) {
                for (const [stName, stVal] of Object.entries(style)) {
                    el.style(stName, stVal);
                }
            }
        });
    } catch (error) {
        debugLog(1, `drawTemporaryFeature() でエラー: ${error}`);
    }
}

export function disableMapZoom() {
    debugLog(4, 'disableMapZoom() が呼び出されました。');
    try {
        svg.on('.zoom', null);
    } catch (error) {
        debugLog(1, `disableMapZoom() でエラー発生: ${error}`);
    }
}

export function enableMapZoom() {
    debugLog(4, 'enableMapZoom() が呼び出されました。');
    try {
        svg.call(zoom);
    } catch (error) {
        debugLog(1, `enableMapZoom() でエラー発生: ${error}`);
    }
}

export function getMapWidth() {
    debugLog(4, 'getMapWidth() が呼び出されました。');
    try {
        return mapWidth;
    } catch (error) {
        debugLog(1, `getMapWidth() でエラー発生: ${error}`);
        return 1000;
    }
}

export function getMapHeight() {
    debugLog(4, 'getMapHeight() が呼び出されました。');
    try {
        return mapHeight;
    } catch (error) {
        debugLog(1, `getMapHeight() でエラー発生: ${error}`);
        return 800;
    }
}

export function setZoomScaleExtent(min, max) {
    debugLog(4, 'setZoomScaleExtent() が呼び出されました。');
    try {
        if (!zoom) return;
        zoom.scaleExtent([min, max]);
    } catch (error) {
        debugLog(1, `setZoomScaleExtent() でエラー発生: ${error}`);
    }
}
