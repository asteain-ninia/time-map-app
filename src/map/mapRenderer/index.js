// src/map/mapRenderer/index.js

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

        // ID付与
        points.forEach((p) => {
            if (!p.id) p.id = Date.now() + Math.random();
        });
        lines.forEach((l) => {
            if (!l.id) l.id = Date.now() + Math.random();
        });
        polygons.forEach((pg) => {
            if (!pg.id) pg.id = Date.now() + Math.random();
        });

        // ポリゴンが2頂点しかない場合をライン化するロジック
        const polygonsToLine = polygons.filter((pg) => pg.points && pg.points.length === 2);
        polygons = polygons.filter((pg) => !(pg.points && pg.points.length === 2));

        lines = lines.filter((l) => l.points && l.points.length >= 2);
        polygons = polygons.filter((pg) => pg.points && pg.points.length >= 3);

        lines.push(...polygonsToLine.map((pg) => ({
            ...pg,
            originalLine: pg.originalPolygon || pg
        })));

        const k = getCurrentZoomScale();
        const mapCopies = [-2, -1, 0, 1, 2];

        let allAdjustedPoints = [];
        let allAdjustedLines = [];
        let allAdjustedPolygons = [];

        mapCopies.forEach((offset) => {
            const offsetX = offset * mapWidth;
            try {
                allAdjustedPoints.push(
                    ...points.map((pt) => {
                        const dup = { ...pt };
                        if (dup.x !== undefined && dup.y !== undefined) {
                            dup.x = dup.x + offsetX;
                        }
                        return dup;
                    })
                );
                allAdjustedLines.push(
                    ...lines.map((ln) => {
                        const dup = { ...ln };
                        if (dup.points) {
                            dup.points = dup.points.map((p) => ({
                                x: p.x + offsetX,
                                y: p.y
                            }));
                        }
                        return dup;
                    })
                );
                allAdjustedPolygons.push(
                    ...polygons.map((pg) => {
                        const dup = { ...pg };
                        if (dup.points) {
                            dup.points = dup.points.map((p) => ({
                                x: p.x + offsetX,
                                y: p.y
                            }));
                        }
                        return dup;
                    })
                );
            } catch (error) {
                debugLog(1, `mapCopies offset=${offset} でエラー: ${error}`);
            }
        });

        // ポリゴン描画
        drawFeatures(
            dataGroup,
            {
                data: allAdjustedPolygons,
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
                                // 追加モード時は無視
                            } else if (cst.isEditMode) {
                                if (cst.currentTool === 'polygonAttributeEdit') {
                                    // 属性編集 → Storeオブジェクトをフォームに渡す
                                    // d.originalPolygon にストアオブジェクト
                                    if (!d.originalPolygon.id) d.originalPolygon.id = d.id;
                                    stateManager.setState({ selectedFeature: d });
                                    renderData();
                                    // フォームはストアオブジェクトへ編集を加える
                                    showPolygonEditForm(d.originalPolygon, renderData, false, true, pageX, pageY);

                                } else if (cst.currentTool === 'polygonVertexEdit') {
                                    // 頂点編集 → selectedFeature = d (描画用)
                                    if (!d.originalPolygon.id) d.originalPolygon.id = d.id;
                                    stateManager.setState({ selectedFeature: d, selectedVertices: [] });
                                    renderData();
                                }
                            } else {
                                // 詳細ウィンドウ
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

        // ライン描画
        drawFeatures(
            dataGroup,
            {
                data: allAdjustedLines,
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
                                // 無視
                            } else if (cst.isEditMode) {
                                if (cst.currentTool === 'lineAttributeEdit') {
                                    // 属性編集
                                    if (!d.originalLine.id) d.originalLine.id = d.id;
                                    stateManager.setState({ selectedFeature: d });
                                    renderData();
                                    showLineEditForm(d.originalLine, renderData, false, true, pageX, pageY);

                                } else if (cst.currentTool === 'lineVertexEdit') {
                                    if (!d.originalLine.id) d.originalLine.id = d.id;
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

        // ポイント描画
        drawFeatures(
            dataGroup,
            {
                data: allAdjustedPoints,
                className: 'point',
                elementType: 'circle',
                attributes: {
                    cx: (d) => d.x,
                    cy: (d) => d.y,
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
                                // 無視
                            } else if (cst.isEditMode) {
                                if (cst.currentTool === 'pointAttributeEdit') {
                                    // 属性編集
                                    if (!d.originalPoint.id) d.originalPoint.id = d.id;
                                    stateManager.setState({ selectedFeature: d });
                                    renderData();
                                    showEditForm(d.originalPoint, renderData, pageX, pageY);

                                } else if (cst.currentTool === 'pointMove') {
                                    // 頂点移動用
                                    if (!d.originalPoint.id) d.originalPoint.id = d.id;
                                    stateManager.setState({ selectedFeature: d, selectedVertices: [] });
                                    renderData();
                                }
                            } else {
                                // 詳細ウィンドウ
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

        if (st.isDrawing) {
            drawTemporaryFeatures(st);
        }

        const selectedFeature = st.selectedFeature;
        if (
            st.isEditMode &&
            st.currentTool === 'pointMove' &&
            selectedFeature &&
            selectedFeature.points &&
            selectedFeature.points.length === 1
        ) {
            // pointMove で頂点ハンドル表示
            drawVertexHandles(dataGroup, selectedFeature);
        }

        if (
            st.isEditMode &&
            (st.currentTool === 'lineVertexEdit' || st.currentTool === 'polygonVertexEdit') &&
            st.selectedFeature
        ) {
            // lineVertexEdit / polygonVertexEdit で頂点ハンドル
            drawVertexHandles(dataGroup, selectedFeature);
            drawEdgeHandles(dataGroup, selectedFeature);
        }
    } catch (error) {
        debugLog(1, `renderData() でエラー: ${error}`);
    }
}

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
