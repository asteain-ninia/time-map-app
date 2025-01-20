// src/map/mapInteraction/drag.js
/****************************************************
 * 頂点ドラッグ処理
 *
 * 修正点:
 *   - ドラッグ中もリアルタイムで selectedFeature を再同期する:
 *     "reSyncDuringDrag()" を呼び出して store -> renderer の座標を更新し、
 *     移動している様子を目視できるようにした。
 *   - 保存などのトラブルを起こさないよう
 *     originalLine/polygon/point は一切付与しない。
 ****************************************************/

import stateManager from '../../state/index.js';
import DataStore from '../../dataStore/index.js';
import tooltips from '../../ui/tooltips.js';
import { debugLog } from '../../utils/logger.js';
import UndoRedoManager from '../../utils/undoRedoManager.js';
import { getFeatureTooltipData } from './selection.js';

/**
 * ドラッグ中に「元の形状」を保持するための変数
 */
let dragOriginalShape = null;
let isDraggingFeature = false;

/**
 * ドラッグ中に描画を間引く
 */
let dragRenderTimeout = null;
const DRAG_RENDER_DELAY = 50;

/**
 * 地図ズーム無効化・有効化のコールバック
 */
let disableMapZoomCallback = null;
let enableMapZoomCallback = null;

/**
 * 再描画用コールバック
 */
let renderDataCallback = null;

/**
 * originalLine / originalPolygon / originalPoint など除去したディープコピー
 */
function safeDeepCopy(obj) {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (
            key === 'originalLine' ||
            key === 'originalPolygon' ||
            key === 'originalPoint'
        ) {
            return undefined;
        }
        return value;
    }));
}

function throttledRenderDuringDrag() {
    try {
        if (!renderDataCallback) return;
        if (!dragRenderTimeout) {
            dragRenderTimeout = setTimeout(() => {
                debugLog(4, 'throttledRenderDuringDrag - 描画実行');
                renderDataCallback();
                dragRenderTimeout = null;
            }, DRAG_RENDER_DELAY);
        }
    } catch (error) {
        debugLog(1, `throttledRenderDuringDrag() でエラー発生: ${error}`);
    }
}

/**
 * ドラッグ中も partialUpdate 後に store から再取得し、selectedFeatureを更新
 * -> リアルタイムに頂点移動を視覚反映
 */
function reSyncDuringDrag(feature) {
    const st = stateManager.getState();
    let storeObj = null;
    if (st.currentTool === 'pointMove') {
        storeObj = DataStore.getPoints(st.currentYear).find(p => p.id === feature.id);
    } else if (st.currentTool === 'lineVertexEdit') {
        storeObj = DataStore.getLines(st.currentYear).find(l => l.id === feature.id);
    } else if (st.currentTool === 'polygonVertexEdit') {
        storeObj = DataStore.getPolygons(st.currentYear).find(pg => pg.id === feature.id);
    }
    if (storeObj) {
        stateManager.setState({ selectedFeature: storeObj });
    }
}

export function disableInteractionDragState(disableMapZoom, renderData) {
    if (disableMapZoom) disableMapZoomCallback = disableMapZoom;
    if (renderData) renderDataCallback = renderData;
}

export function enableInteractionDragState(enableMapZoom, renderData) {
    if (enableMapZoom) enableMapZoomCallback = enableMapZoom;
    if (renderData) renderDataCallback = renderData;
}

/**
 * 頂点ドラッグ開始
 */
export function vertexDragStarted(event, dData, offsetX, feature) {
    debugLog(4, `vertexDragStarted() が呼び出されました。feature.id=${feature?.id}, offsetX=${offsetX}`);
    try {
        if (event.sourceEvent) event.sourceEvent.stopPropagation();
        stateManager.setState({ isDragging: true });
        d3.select(event.sourceEvent.target).raise().classed('active', true);

        if (disableMapZoomCallback) disableMapZoomCallback();

        tooltips.hideTooltip();
        dData._dragged = false;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);

        dragOriginalShape = safeDeepCopy(feature);
        isDraggingFeature = true;

        if (dragRenderTimeout) {
            clearTimeout(dragRenderTimeout);
            dragRenderTimeout = null;
        }
    } catch (error) {
        debugLog(1, `vertexDragStarted() でエラー発生: ${error}`);
    }
}

/**
 * 頂点ドラッグ中
 */
export function vertexDragged(event, dData) {
    debugLog(4, 'vertexDragged() が呼び出されました。');
    try {
        dData._dragged = true;
        if (!isDraggingFeature) return;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        const transformedMouseX = transform.invertX(mouseX);
        const transformedMouseY = transform.invertY(mouseY);

        const dx = transformedMouseX - dData.dragStartX;
        const dy = transformedMouseY - dData.dragStartY;
        dData.dragStartX = transformedMouseX;
        dData.dragStartY = transformedMouseY;

        const st = stateManager.getState();
        const { selectedFeature, selectedVertices } = st;
        if (!selectedFeature || !selectedFeature.points) return;

        let allSelected = selectedVertices.filter(v => v.featureId === selectedFeature.id);
        if (allSelected.length === 0) {
            allSelected = [{ featureId: selectedFeature.id, vertexIndex: dData.index }];
        }

        for (const pos of allSelected) {
            const pt = selectedFeature.points[pos.vertexIndex];
            if (pt) {
                pt.x += dx;
                pt.y += dy;
            }
        }

        // 中間更新
        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(selectedFeature, false);
            reSyncDuringDrag(selectedFeature);
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(selectedFeature, false);
            reSyncDuringDrag(selectedFeature);
        } else if (st.currentTool === 'pointMove') {
            if (selectedFeature.points.length === 1) {
                DataStore.updatePoint(selectedFeature, false);
                reSyncDuringDrag(selectedFeature);
            }
        }

        throttledRenderDuringDrag();
    } catch (error) {
        debugLog(1, `vertexDragged() でエラー発生: ${error}`);
    }
}

/**
 * 頂点ドラッグ終了
 */
export function vertexDragEnded(event, dData, feature) {
    debugLog(4, `vertexDragEnded() が呼び出されました。feature.id=${feature?.id}`);
    try {
        stateManager.setState({ isDragging: false });
        d3.select(event.sourceEvent.target).classed('active', false);

        if (enableMapZoomCallback) enableMapZoomCallback();

        if (!isDraggingFeature) return;
        isDraggingFeature = false;

        if (event.sourceEvent) {
            const tooltipData = getFeatureTooltipData(feature);
            tooltips.showTooltip(event.sourceEvent, tooltipData);
            tooltips.moveTooltip(event.sourceEvent);
        }

        const st = stateManager.getState();
        if (!feature.points) return;

        if (dData._dragged) {
            if (st.currentTool === 'lineVertexEdit') {
                DataStore.updateLine(feature, false);
                const action = UndoRedoManager.makeAction('updateLine', dragOriginalShape, safeDeepCopy(feature));
                UndoRedoManager.record(action);
                reSyncDuringDrag(feature);

            } else if (st.currentTool === 'polygonVertexEdit') {
                DataStore.updatePolygon(feature, false);
                const action = UndoRedoManager.makeAction('updatePolygon', dragOriginalShape, safeDeepCopy(feature));
                UndoRedoManager.record(action);
                reSyncDuringDrag(feature);

            } else if (st.currentTool === 'pointMove') {
                if (feature.points.length === 1) {
                    DataStore.updatePoint(feature, false);
                    const action = UndoRedoManager.makeAction('updatePoint', dragOriginalShape, safeDeepCopy(feature));
                    UndoRedoManager.record(action);
                    reSyncDuringDrag(feature);
                }
            }
        }

        if (renderDataCallback) {
            renderDataCallback();
        }

        if (dragRenderTimeout) {
            clearTimeout(dragRenderTimeout);
            dragRenderTimeout = null;
        }

        delete dData.dragStartX;
        delete dData.dragStartY;
        delete dData._dragged;
        dragOriginalShape = null;

    } catch (error) {
        debugLog(1, `vertexDragEnded() でエラー発生: ${error}`);
    }
}

/**
 * エッジドラッグ開始 (新頂点追加)
 */
export function edgeDragStarted(event, dData, offsetX, feature) {
    debugLog(4, `edgeDragStarted() が呼び出されました。feature.id=${feature?.id}, offsetX=${offsetX}`);
    try {
        if (event.sourceEvent) event.sourceEvent.stopPropagation();
        stateManager.setState({ isDragging: true });
        d3.select(event.sourceEvent.target).raise().classed('active', true);

        if (disableMapZoomCallback) disableMapZoomCallback();

        tooltips.hideTooltip();
        dData._dragged = false;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);

        dragOriginalShape = safeDeepCopy(feature);

        if (!feature.points) feature.points = [];
        feature.points.splice(dData.endIndex, 0, {
            x: dData.dragStartX,
            y: dData.dragStartY
        });

        isDraggingFeature = true;
        dData._dragged = true;

        if (dragRenderTimeout) {
            clearTimeout(dragRenderTimeout);
            dragRenderTimeout = null;
        }
    } catch (error) {
        debugLog(1, `edgeDragStarted() でエラー発生: ${error}`);
    }
}

/**
 * エッジドラッグ中
 */
export function edgeDragged(event, dData) {
    debugLog(4, 'edgeDragged() が呼び出されました。');
    try {
        if (!isDraggingFeature) return;
        dData._dragged = true;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        const transformedMouseX = transform.invertX(mouseX);
        const transformedMouseY = transform.invertY(mouseY);

        const dx = transformedMouseX - dData.dragStartX;
        const dy = transformedMouseY - dData.dragStartY;
        dData.dragStartX = transformedMouseX;
        dData.dragStartY = transformedMouseY;

        const st = stateManager.getState();
        const feature = st.selectedFeature;
        if (!feature || !feature.points) return;

        const pt = feature.points[dData.endIndex];
        if (pt) {
            pt.x += dx;
            pt.y += dy;
        }

        // 中間update
        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(feature, false);
            reSyncDuringDrag(feature);
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(feature, false);
            reSyncDuringDrag(feature);
        }

        throttledRenderDuringDrag();
    } catch (error) {
        debugLog(1, `edgeDragged() でエラー発生: ${error}`);
    }
}

/**
 * エッジドラッグ終了
 */
export function edgeDragEnded(event, dData, feature) {
    debugLog(4, `edgeDragEnded() が呼び出されました。feature.id=${feature?.id}`);
    try {
        stateManager.setState({ isDragging: false });
        d3.select(event.sourceEvent.target).classed('active', false);

        if (enableMapZoomCallback) enableMapZoomCallback();

        if (!isDraggingFeature) return;
        isDraggingFeature = false;

        if (event.sourceEvent) {
            const tooltipData = getFeatureTooltipData(feature);
            tooltips.showTooltip(event.sourceEvent, tooltipData);
            tooltips.moveTooltip(event.sourceEvent);
        }

        const st = stateManager.getState();
        if (!feature.points) return;

        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(feature, false);
            const action = UndoRedoManager.makeAction('updateLine', dragOriginalShape, safeDeepCopy(feature));
            UndoRedoManager.record(action);
            reSyncDuringDrag(feature);

        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(feature, false);
            const action = UndoRedoManager.makeAction('updatePolygon', dragOriginalShape, safeDeepCopy(feature));
            UndoRedoManager.record(action);
            reSyncDuringDrag(feature);
        }

        if (renderDataCallback) {
            renderDataCallback();
        }

        if (dragRenderTimeout) {
            clearTimeout(dragRenderTimeout);
            dragRenderTimeout = null;
        }

        delete dData.dragStartX;
        delete dData.dragStartY;
        delete dData._dragged;
        dragOriginalShape = null;

    } catch (error) {
        debugLog(1, `edgeDragEnded() でエラー発生: ${error}`);
    }
}
