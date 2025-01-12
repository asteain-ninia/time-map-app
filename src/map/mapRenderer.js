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

/**
 * ズーム用の変数
 */
let zoom;

/**
 * マップ全体の <svg> と、ズーム用 <g>
 */
let svg;
let zoomGroup;

/**
 * 地図の幅・高さ
 */
let mapWidth = 1000;
let mapHeight = 800;

/**
 * データストア参照
 */
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
 * 背景地図 (map.svg) を読み込み、横方向に複製して表示する関数
 * @param {Object} _DataStore - データストア
 * @param {Object} _UI - UIモジュール(使わないこともある)
 * @param {Function} renderDataFunc - 地図の再描画関数
 */
export function loadMap(_DataStore, _UI, renderDataFunc) {
    debugLog(4, 'loadMap() が呼び出されました。');
    try {
        return new Promise((resolve, reject) => {
            try {
                MapModuleDataStore = _DataStore;

                // #map の中に <svg> 要素を作成
                svg = d3.select('#map')
                    .append('svg')
                    .attr('width', '100%')
                    .attr('height', '100%');

                // ズーム用のグループ
                zoomGroup = svg.append('g');

                // ズーム設定
                zoom = d3.zoom()
                    .scaleExtent([1, 50]) // デフォルト：最小1,最大50
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

                // ズーム呼び出し
                svg.call(zoom);

                const mapSvgUrl = 'map.svg';

                // SVGファイルを読み込み
                d3.xml(mapSvgUrl).then((xml) => {
                    try {
                        const mapSvg = xml.documentElement;

                        // viewBoxがあれば取得して mapWidth/mapHeight を上書き
                        const viewBox = mapSvg.getAttribute('viewBox');
                        if (viewBox) {
                            const vbVals = viewBox.split(' ').map(Number);
                            if (vbVals.length === 4) {
                                mapWidth = vbVals[2];
                                mapHeight = vbVals[3];
                            }
                        } else {
                            // それ以外の場合はwidth/height属性から取得
                            const wAttr = parseFloat(mapSvg.getAttribute('width'));
                            const hAttr = parseFloat(mapSvg.getAttribute('height'));
                            if (!isNaN(wAttr)) mapWidth = wAttr;
                            if (!isNaN(hAttr)) mapHeight = hAttr;
                        }

                        // -2～2の範囲で地図を横に複製
                        for (let i = -2; i <= 2; i++) {
                            // 元の <svg> 内の要素を複製
                            const mapClone = mapSvg.cloneNode(true);

                            mapClone.removeAttribute('width');
                            mapClone.removeAttribute('height');

                            // <style>を挿入して、すべての path に対して fill-rule & clip-rule=evenodd を強制
                            const styleElement = xml.createElement('style');
                            // fill-rule と clip-rule を同時に指定
                            styleElement.textContent = `
                                path {
                                    fill-rule: evenodd !important;
                                    clip-rule: evenodd !important;
                                }
                            `;
                            // <svg>直下に挿入
                            mapClone.insertBefore(styleElement, mapClone.firstChild);

                            // g要素を作成して複製を貼り付け
                            const mapGroup = zoomGroup.append('g')
                                .attr('transform', `translate(${i * mapWidth}, 0)`);

                            // DOMで追加
                            mapGroup.node().appendChild(mapClone);
                        }

                        // この <svg> 自身にも viewBox を設定
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
 * 地図上のオブジェクト（Points/Lines/Polygons）を再描画する
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
                const dup = { ...feature };
                dup.points = dup.points.map(p => ({
                    x: p.x + offsetX,
                    y: p.y
                }));
                return dup;
            } catch (err) {
                debugLog(1, `duplicateFeature() でエラー発生: ${err}`);
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
                    return d3.line().x(p => p.x).y(p => p.y).curve(d3.curveLinearClosed)(d.points);
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
                    return d3.line().x(p => p.x).y(p => p.y)(d.points);
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

        // 頂点編集など
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
            drawVertexHandles(dataGroup, selectedFeature);
            drawEdgeHandles(dataGroup, selectedFeature);
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
    debugLog(4, `drawFeatures() が呼び出されました。className=${className}`);
    try {
        const selection = container.selectAll(`.${className}`)
            .data(data, d => {
                if (!d.points || !d.points[0]) return `empty-${Math.random()}`;
                return `${d.id || Math.random()}-${Math.floor(d.points[0].x / mapWidth)}`;
            });

        const enterSelection = selection.enter()
            .append(elementType)
            .attr('class', className);

        // Enter
        enterSelection.each(function (d) {
            const el = d3.select(this);
            // 属性
            for (const [attrName, attrValue] of Object.entries(attributes)) {
                if (typeof attrValue === 'function') {
                    el.attr(attrName, attrValue(d));
                } else {
                    el.attr(attrName, attrValue);
                }
            }
            // スタイル
            if (style) {
                for (const [sName, sValue] of Object.entries(style)) {
                    el.style(sName, sValue);
                }
            }
            // イベント
            for (const [eName, eHandler] of Object.entries(eventHandlers)) {
                el.on(eName, eHandler);
            }
        });

        // Update
        selection.each(function (d) {
            const el = d3.select(this);
            for (const [attrName, attrValue] of Object.entries(attributes)) {
                if (typeof attrValue === 'function') {
                    el.attr(attrName, attrValue(d));
                } else {
                    el.attr(attrName, attrValue);
                }
            }
            if (style) {
                for (const [sName, sValue] of Object.entries(style)) {
                    el.style(sName, sValue);
                }
            }
            for (const [eName, eHandler] of Object.entries(eventHandlers)) {
                el.on(eName, eHandler);
            }
        });

        // ポイントなら半径を調整
        if (isPointCircle) {
            selection.merge(enterSelection)
                .attr('r', 20 / k);
        }

        selection.exit().remove();

        // 選択中フィーチャをハイライト
        const st = stateManager.getState();
        if (st.selectedFeature && st.selectedFeature.id) {
            container.selectAll(`.${className}`)
                .filter(d => d.id === st.selectedFeature.id)
                .each(function () {
                    try {
                        const el = d3.select(this);
                        if (className === 'line' || className === 'polygon') {
                            el.attr('stroke', colorScheme.highlightStroke)
                                .attr('stroke-width', colorScheme.highlightStrokeWidth)
                                .style('vector-effect', 'non-scaling-stroke');
                        } else if (className === 'point') {
                            // 円をハイライト色に
                            el.attr('fill', colorScheme.highlightPointFill);
                        }
                    } catch (err) {
                        debugLog(1, `drawFeatures ハイライト処理中にエラー: ${err}`);
                    }
                });
        }
    } catch (error) {
        debugLog(1, `drawFeatures() のtry-catch外枠でエラー発生（クラス名: ${className}）: ${error}`);
    }
}

/**
 * 作図中の一時オブジェクトを描画（tempLine, tempPolygon, tempPoint）
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

        const mapCopies = [-1, 0, 1, 2];
        const k = getCurrentZoomScale();

        mapCopies.forEach(offset => {
            const offsetX = offset * mapWidth;
            try {
                if (state.currentTool === 'line' && state.tempLinePoints && state.tempLinePoints.length > 0) {
                    const arr = state.tempLinePoints.map(p => ({ x: p.x + offsetX, y: p.y }));
                    // ライン
                    drawTemporaryFeature(tempGroup, {
                        data: [arr],
                        className: `tempLine-${offset}`,
                        elementType: 'path',
                        attributes: {
                            d: dd => d3.line().x(pp => pp.x).y(pp => pp.y)(dd)
                        },
                        style: {
                            stroke: colorScheme.tempLineStroke,
                            'stroke-width': 2,
                            fill: 'none',
                            'vector-effect': 'non-scaling-stroke'
                        }
                    });
                    // 頂点（circle）
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
                    // ポリゴン path
                    drawTemporaryFeature(tempGroup, {
                        data: [arr],
                        className: `tempPolygon-${offset}`,
                        elementType: 'path',
                        attributes: {
                            d: dd => d3.line().x(pp => pp.x).y(pp => pp.y).curve(d3.curveLinearClosed)(dd)
                        },
                        style: {
                            stroke: colorScheme.tempPolygonStroke,
                            'stroke-width': 2,
                            fill: colorScheme.tempPolygonFill,
                            'vector-effect': 'non-scaling-stroke'
                        }
                    });
                    // 頂点（circle）
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
            } catch (err) {
                debugLog(1, `drawTemporaryFeatures ループ内 (offset=${offset}) でエラー発生: ${innerError}`);
            }
        });
    } catch (error) {
        debugLog(1, `drawTemporaryFeatures() 外枠でエラー発生: ${error}`);
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
        debugLog(1, `drawTemporaryFeature() でエラー発生 (className=${className}): ${error}`);
    }
}

/**
 * ライン/ポリゴン頂点編集時の頂点ハンドル表示
 */
function drawVertexHandles(dataGroup, feature) {
    debugLog(4, `drawVertexHandles() が呼び出されました。feature.id=${feature?.id}`);
    try {
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
                        return isSelected ? 28 / k : 20 / k;
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
    debugLog(4, `drawEdgeHandles() が呼び出されました。feature.id=${feature?.id}`);
    try {
        if (!feature.points || feature.points.length <= 1) {
            return;
        }

        dataGroup.selectAll('.edge-handle-group').remove();
        const edgeHandleGroup = dataGroup.append('g').attr('class', 'edge-handle-group');

        const st = stateManager.getState();
        const isPolygon = st.currentTool === 'polygonVertexEdit';
        const requiredMin = isPolygon ? 3 : 2;
        if (feature.points.length < requiredMin) return;

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

/**
 * ズームを一時的に無効化する（頂点ドラッグなどの操作時に呼ばれる）
 */
export function disableMapZoom() {
    debugLog(4, 'disableMapZoom() が呼び出されました。');
    try {
        svg.on('.zoom', null);
    } catch (error) {
        debugLog(1, `disableMapZoom() でエラー発生: ${error}`);
    }
}

/**
 * ズーム再有効化
 */
export function enableMapZoom() {
    debugLog(4, 'enableMapZoom() が呼び出されました。');
    try {
        svg.call(zoom);
    } catch (error) {
        debugLog(1, `enableMapZoom() でエラー発生: ${error}`);
    }
}

/**
 * 現在の地図幅を返す
 */
export function getMapWidth() {
    debugLog(4, 'getMapWidth() が呼び出されました。');
    try {
        return mapWidth;
    } catch (error) {
        debugLog(1, `getMapWidth() でエラー発生: ${error}`);
        return 1000;
    }
}

/**
 * 現在の地図高さを返す
 */
export function getMapHeight() {
    debugLog(4, 'getMapHeight() が呼び出されました。');
    try {
        return mapHeight;
    } catch (error) {
        debugLog(1, `getMapHeight() でエラー発生: ${error}`);
        return 800;
    }
}

/**
 * ズーム倍率を動的に設定
 */
export function setZoomScaleExtent(min, max) {
    debugLog(4, 'setZoomScaleExtent() が呼び出されました。');
    try {
        if (!zoom) return;
        zoom.scaleExtent([min, max]);
    } catch (error) {
        debugLog(1, `setZoomScaleExtent() でエラー発生: ${error}`);
    }
}

/**
 * 頂点ドラッグ開始
 */
function vertexDragStarted(event, dData, offsetX, feature) {
    debugLog(4, `vertexDragStarted()が呼び出されました。: feature.id=${feature?.id}, offsetX=${offsetX}`);
    try {
        event.sourceEvent.stopPropagation();
        stateManager.setState({ isDragging: true });

        d3.select(event.sourceEvent.target).raise().classed('active', true);
        disableMapZoom();

        tooltips.hideTooltip();

        dData._dragged = false;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);
    } catch (error) {
        debugLog(1, `vertexDragStarted() でエラー発生: ${error}`);
    }
}

/**
 * 頂点ドラッグ中
 */
function vertexDragged(event, dData) {
    debugLog(4, 'vertexDragged() が呼び出されました。');
    try {
        dData._dragged = true;
        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        const transformedMouseX = transform.invertX(mouseX);
        const transformedMouseY = transform.invertY(mouseY);

        const dx = transformedMouseX - dData.dragStartX;
        const dy = transformedMouseY - dData.dragStartY;

        const st = stateManager.getState();
        const { selectedFeature, selectedVertices } = st;
        if (!selectedFeature) return;

        let allSelected = selectedVertices.filter(v => v.featureId === selectedFeature.id);
        if (allSelected.length === 0) {
            allSelected = [{ featureId: selectedFeature.id, vertexIndex: dData.index }];
        }

        for (const pos of allSelected) {
            selectedFeature.points[pos.vertexIndex].x += dx;
            selectedFeature.points[pos.vertexIndex].y += dy;
        }

        dData.dragStartX = transformedMouseX;
        dData.dragStartY = transformedMouseY;

        if (st.currentTool === 'lineVertexEdit') {
            MapModuleDataStore.updateLine(selectedFeature, false);
        } else if (st.currentTool === 'polygonVertexEdit') {
            MapModuleDataStore.updatePolygon(selectedFeature, false);
        } else if (st.currentTool === 'pointMove') {
            if (selectedFeature.points && selectedFeature.points.length === 1) {
                MapModuleDataStore.updatePoint(selectedFeature, false);
            }
        }
    } catch (error) {
        debugLog(1, `vertexDragged() でエラーが発生しました: ${error}`);
    }
}

/**
 * 頂点ドラッグ終了
 */
function vertexDragEnded(event, dData, feature) {
    debugLog(4, `vertexDragEnded()が呼び出されました。: feature.id=${feature?.id}`);
    try {
        stateManager.setState({ isDragging: false });
        d3.select(event.sourceEvent.target).classed('active', false);
        enableMapZoom();

        if (dData._dragged) {
            const st = stateManager.getState();
            if (st.currentTool === 'lineVertexEdit') {
                MapModuleDataStore.updateLine(feature, true);
            } else if (st.currentTool === 'polygonVertexEdit') {
                MapModuleDataStore.updatePolygon(feature, true);
            } else if (st.currentTool === 'pointMove') {
                if (feature.points && feature.points.length === 1) {
                    MapModuleDataStore.updatePoint(feature, true);
                }
            }
        }
    } catch (error) {
        debugLog(1, `vertexDragEnded() でエラーが発生しました: ${error}`);
    }
}

/**
 * エッジドラッグ開始
 */
function edgeDragStarted(event, dData, offsetX, feature) {
    debugLog(4, `edgeDragStarted(): feature.id=${feature?.id}, offsetX=${offsetX}`);
    try {
        event.sourceEvent.stopPropagation();
        stateManager.setState({ isDragging: true });
        d3.select(event.sourceEvent.target).raise().classed('active', true);
        disableMapZoom();

        tooltips.hideTooltip();

        dData._dragged = false;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);

        // エッジに新頂点を挿入
        const newX = dData.dragStartX;
        const newY = dData.dragStartY;
        feature.points.splice(dData.endIndex, 0, { x: newX, y: newY });

        if (stateManager.getState().currentTool === 'lineVertexEdit') {
            MapModuleDataStore.updateLine(feature, false);
        } else if (stateManager.getState().currentTool === 'polygonVertexEdit') {
            MapModuleDataStore.updatePolygon(feature, false);
        }

        dData._dragged = true;
    } catch (error) {
        debugLog(1, `edgeDragStarted() でエラーが発生しました: ${error}`);
    }
}

/**
 * エッジドラッグ中
 */
function edgeDragged(event, dData) {
    debugLog(4, 'edgeDragged() が呼び出されました。');
    try {
        dData._dragged = true;
        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        const transformedMouseX = transform.invertX(mouseX);
        const transformedMouseY = transform.invertY(mouseY);

        const dx = transformedMouseX - dData.dragStartX;
        const dy = transformedMouseY - dData.dragStartY;

        const st = stateManager.getState();
        const feature = st.selectedFeature;
        if (!feature) return;

        // 追加した頂点 (endIndex) を動かす
        feature.points[dData.endIndex].x += dx;
        feature.points[dData.endIndex].y += dy;

        dData.dragStartX = transformedMouseX;
        dData.dragStartY = transformedMouseY;

        if (st.currentTool === 'lineVertexEdit') {
            MapModuleDataStore.updateLine(feature, false);
        } else if (st.currentTool === 'polygonVertexEdit') {
            MapModuleDataStore.updatePolygon(feature, false);
        }
    } catch (error) {
        debugLog(1, `edgeDragged() でエラーが発生しました: ${error}`);
    }
}

/**
 * エッジドラッグ終了
 */
function edgeDragEnded(event, dData, feature) {
    debugLog(4, `edgeDragEnded():が呼び出されました。 feature.id=${feature?.id}`);
    try {
        stateManager.setState({ isDragging: false });
        d3.select(event.sourceEvent.target).classed('active', false);
        enableMapZoom();

        if (dData._dragged) {
            const st = stateManager.getState();
            if (st.currentTool === 'lineVertexEdit') {
                MapModuleDataStore.updateLine(feature, true);
            } else if (st.currentTool === 'polygonVertexEdit') {
                MapModuleDataStore.updatePolygon(feature, true);
            }
        }
    } catch (error) {
        debugLog(1, `edgeDragEnded() でエラーが発生しました: ${error}`);
    }
}
