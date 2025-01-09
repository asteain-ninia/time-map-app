// src/map/mapRenderer.js

import stateManager from '../state/index.js';
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

// DataStore への参照を保持（ロード後に使う）
let MapModuleDataStore;

/**
 * カラーや太さなどを一括管理するオブジェクト
 */
const colorScheme = {
    // 点データ
    pointFill: 'red',

    // ラインデータ
    lineStroke: 'blue',

    // ポリゴンデータ
    polygonStroke: 'green',
    polygonFill: 'rgba(0,255,0,0.3)',

    // ハイライト（選択中）の枠線やポイント色
    highlightStroke: 'orange',
    highlightStrokeWidth: 4,
    highlightPointFill: 'magenta',

    // 頂点ハンドルの色 (通常 / 選択)
    vertexNormal: 'greenyellow',
    vertexSelected: 'magenta',

    // エッジハンドルの色
    edgeHandleFill: 'yellow',

    // 一時オブジェクト（描画中）の色
    tempLineStroke: 'orange',
    tempPolygonStroke: 'orange',
    tempPolygonFill: 'rgba(255,165,0,0.3)',
    tempPointFill: 'orange',
};

/**
 * 現在のズーム係数を取得するヘルパー
 * @returns {number} 現在のズーム係数 (k)
 */
function getCurrentZoomScale() {
    try {
        if (!svg) return 1;
        const transform = d3.zoomTransform(svg.node());
        return transform.k || 1;
    } catch (error) {
        debugLog(1, `getCurrentZoomScale() でエラー発生: ${error}`);
        return 1;
    }
}

/**
 * 地図を読み込み、マップを横方向に複製
 */
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

                // ズーム設定（最小1・最大50はデフォルト値）
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
                            debugLog(1, `ズームイベント中にエラー発生: ${error}`);
                        }
                    });

                svg.call(zoom);

                const mapSvgUrl = 'map.svg';

                d3.xml(mapSvgUrl).then((xml) => {
                    try {
                        const mapSvg = xml.documentElement;

                        // viewBoxを取得して、mapWidth / mapHeight を上書き
                        const viewBox = mapSvg.getAttribute('viewBox');
                        if (viewBox) {
                            const [, , w, h] = viewBox.split(' ').map(Number);
                            mapWidth = w;
                            mapHeight = h;
                        } else {
                            mapWidth = parseFloat(mapSvg.getAttribute('width')) || mapWidth;
                            mapHeight = parseFloat(mapSvg.getAttribute('height')) || mapHeight;
                        }

                        // 地図を -2～2の範囲で複製し、無限スクロール感を出す
                        for (let i = -2; i <= 2; i++) {
                            // 元のSVGを複製
                            const mapClone = mapSvg.cloneNode(true);

                            // mapClone内の <path> 要素に fill-rule="evenodd" を付与
                            const pathElems = mapClone.querySelectorAll('path');
                            pathElems.forEach(pathEl => {
                                pathEl.setAttribute('fill-rule', 'evenodd');
                            });
                            // これにより、穴を含むパスが正しく透過（穴抜き）される

                            const mapGroup = zoomGroup.append('g')
                                .attr('transform', `translate(${i * mapWidth}, 0)`);
                            mapGroup.node().appendChild(mapClone);
                        }

                        // ビュー設定
                        svg
                            .attr('viewBox', `0 0 ${mapWidth} ${mapHeight}`)
                            .attr('preserveAspectRatio', 'xMidYMid meet');

                        // 初期表示
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

/**
 * 全データを再描画
 */
export function renderData() {
    debugLog(4, 'renderData() が呼び出されました。');
    try {
        const st = stateManager.getState();

        // すでに描画されている要素をクリア
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

        // 2点ポリゴン(ほぼライン)をlinesに加える
        lines.push(...polygonsToLine.map(pg => ({ ...pg, originalLine: pg.originalPolygon || pg })));

        // ズーム係数
        const k = getCurrentZoomScale();

        // 複数のコピー（-2, -1, 0, 1, 2）を合成
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
                return feature; // エラー時はそのまま返す
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
                    return d3.line()
                        .x(p => p.x)
                        .y(p => p.y)
                        .curve(d3.curveLinearClosed)(d.points);
                },
                // stroke-widthは固定し、vector-effect: non-scaling-stroke で拡大・縮小を防ぐ
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
        }, k);

        // ライン描画
        drawFeatures(dataGroup, {
            data: allAdjustedLines,
            className: 'line',
            elementType: 'path',
            attributes: {
                d: d => {
                    if (!d.points || d.points.length < 2) return null;
                    return d3.line()
                        .x(p => p.x)
                        .y(p => p.y)(d.points);
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
        }, k);

        // ポイント描画
        drawFeatures(dataGroup, {
            data: allAdjustedPoints,
            className: 'point',
            elementType: 'circle',
            attributes: {
                cx: d => d.points[0].x,
                cy: d => d.points[0].y,
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
        }, k, /* isPointCircle= */ true);

        // 作図中の一時オブジェクト描画
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
            drawVertexHandles(dataGroup, selectedFeature);
        }

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
 * @param {D3Selection} container - 親コンテナ
 * @param {Object} options
 * @param {number} k - ズーム係数
 * @param {boolean} [isPointCircle=false] - 円を描画するポイントかどうか（半径を調整するため）
 */
function drawFeatures(container, { data, className, elementType, attributes, style, eventHandlers }, k, isPointCircle = false) {
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

        // 属性・イベントの設定
        enterSelection.each(function (d) {
            const element = d3.select(this);

            // SVGの属性を設定
            for (const [attrName, attrValue] of Object.entries(attributes)) {
                if (typeof attrValue === 'function') {
                    element.attr(attrName, attrValue(d));
                } else {
                    element.attr(attrName, attrValue);
                }
            }
            // スタイル設定
            if (style) {
                for (const [styleName, styleValue] of Object.entries(style)) {
                    element.style(styleName, styleValue);
                }
            }
            // イベントハンドラ設定
            for (const [eventName, eventHandler] of Object.entries(eventHandlers)) {
                element.on(eventName, eventHandler);
            }
        });

        // 更新処理
        selection.each(function (d) {
            const element = d3.select(this);

            for (const [attrName, attrValue] of Object.entries(attributes)) {
                if (typeof attrValue === 'function') {
                    element.attr(attrName, attrValue(d));
                } else {
                    element.attr(attrName, attrValue);
                }
            }
            if (style) {
                for (const [styleName, styleValue] of Object.entries(style)) {
                    element.style(styleName, styleValue);
                }
            }
            for (const [eventName, eventHandler] of Object.entries(eventHandlers)) {
                element.on(eventName, eventHandler);
            }
        });

        // 半径をズーム比で調整 (isPointCircleのみ)
        if (isPointCircle) {
            selection.merge(enterSelection)
                // もともと 20 / k
                .attr('r', 20 / k);
        }

        selection.exit().remove();

        // 選択中フィーチャをハイライト（ライン/ポリゴン/ポイント）
        const st = stateManager.getState();
        if (st.selectedFeature && st.selectedFeature.id) {
            container.selectAll(`.${className}`)
                .filter(d => d.id === st.selectedFeature.id)
                .each(function () {
                    try {
                        const element = d3.select(this);
                        if (className === 'line' || className === 'polygon') {
                            element
                                .attr('stroke', colorScheme.highlightStroke)
                                .attr('stroke-width', colorScheme.highlightStrokeWidth)
                                .style('vector-effect', 'non-scaling-stroke');
                        } else if (className === 'point') {
                            // 円の塗り色
                            element.attr('fill', colorScheme.highlightPointFill);
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
        const k = getCurrentZoomScale();

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
                            cx: d => d.x,
                            cy: d => d.y,
                            r: 20 / k,
                            fill: colorScheme.tempPointFill
                        },
                        style: {
                            'vector-effect': 'non-scaling-stroke'
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
                            cx: d => d.x,
                            cy: d => d.y,
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
                            cx: d => d.x,
                            cy: d => d.y,
                            r: 20 / k,
                            fill: colorScheme.tempPointFill
                        },
                        style: {
                            'vector-effect': 'non-scaling-stroke'
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

        elements.each(function (d) {
            const el = d3.select(this);
            // 属性設定
            for (const [attrName, attrValue] of Object.entries(attributes)) {
                if (typeof attrValue === 'function') {
                    el.attr(attrName, attrValue(d));
                } else {
                    el.attr(attrName, attrValue);
                }
            }
            // スタイル設定
            if (style) {
                for (const [styleName, styleValue] of Object.entries(style)) {
                    el.style(styleName, styleValue);
                }
            }
        });
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
        const k = getCurrentZoomScale();

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
                    .attr('r', d => {
                        const isSelected = selectedVertices.some(
                            v => v.featureId === feature.id && v.vertexIndex === d.index
                        );
                        return isSelected ? 28 / k : 20 / k;  // 選択頂点はやや大きく
                    })
                    .attr('fill', d => {
                        const isSelected = selectedVertices.some(
                            v => v.featureId === feature.id && v.vertexIndex === d.index
                        );
                        return isSelected ? colorScheme.vertexSelected : colorScheme.vertexNormal;
                    })
                    .style('pointer-events', 'all')
                    .style('vector-effect', 'non-scaling-stroke')
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

        const k = getCurrentZoomScale();
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
                    .attr('r', 16 / k)
                    .attr('fill', colorScheme.edgeHandleFill)
                    .style('pointer-events', 'all')
                    .style('vector-effect', 'non-scaling-stroke')
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

export function disableMapZoom() {
    try {
        debugLog(4, 'disableMapZoom() が呼び出されました。');
        svg.on('.zoom', null);
    } catch (error) {
        debugLog(1, `disableMapZoom() でエラー発生: ${error}`);
    }
}

export function enableMapZoom() {
    try {
        debugLog(4, 'enableMapZoom() が呼び出されました。');
        svg.call(zoom);
    } catch (error) {
        debugLog(1, `enableMapZoom() でエラー発生: ${error}`);
    }
}

export function getMapWidth() {
    try {
        return mapWidth;
    } catch (error) {
        debugLog(1, `getMapWidth() でエラー発生: ${error}`);
        return 1000;
    }
}

export function getMapHeight() {
    try {
        return mapHeight;
    } catch (error) {
        debugLog(1, `getMapHeight() でエラー発生: ${error}`);
        return 800;
    }
}

export function setZoomScaleExtent(min, max) {
    if (!zoom) return;
    zoom.scaleExtent([min, max]);
}
