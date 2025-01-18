// src/map/mapInteraction/drag.js

import stateManager from '../../state/index.js';
import DataStore from '../../dataStore/index.js';
import tooltips from '../../ui/tooltips.js';
import { debugLog } from '../../utils/logger.js';
import UndoRedoManager from '../../utils/undoRedoManager.js';
import { getFeatureTooltipData } from './selection.js';

/**
 * ドラッグ中に「元の形状」を保持するための変数。
 * - 頂点編集・ポイント移動などの操作前の状態を保存しておく。
 */
let dragOriginalShape = null;
let isDraggingFeature = false;

/**
 * ドラッグ中に連続で再描画を走らせないためのタイマー
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
 * 外部から disableMapZoom() を受け取り、当モジュールで保持する
 * @param {Function} disableMapZoom
 * @param {Function} [renderData] - 任意でrenderDataをセット
 */
export function disableInteractionDragState(disableMapZoom, renderData) {
    if (disableMapZoom) {
        disableMapZoomCallback = disableMapZoom;
    }
    if (renderData) {
        renderDataCallback = renderData;
    }
}

/**
 * 外部から enableMapZoom() を受け取り、当モジュールで保持する
 * @param {Function} enableMapZoom
 * @param {Function} [renderData] - 任意でrenderDataをセット
 */
export function enableInteractionDragState(enableMapZoom, renderData) {
    if (enableMapZoom) {
        enableMapZoomCallback = enableMapZoom;
    }
    if (renderData) {
        renderDataCallback = renderData;
    }
}

/**
 * ドラッグ中に頻繁に呼び出される描画を間引きする
 */
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
 * 頂点ドラッグ開始
 */
export function vertexDragStarted(event, dData, offsetX, feature) {
    debugLog(4, `vertexDragStarted() が呼び出されました。feature.id=${feature?.id}, offsetX=${offsetX}`);
    try {
        if (event.sourceEvent) {
            event.sourceEvent.stopPropagation();
        }
        stateManager.setState({ isDragging: true });
        d3.select(event.sourceEvent.target).raise().classed('active', true);

        if (disableMapZoomCallback) {
            disableMapZoomCallback();
        }

        tooltips.hideTooltip();
        dData._dragged = false;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);

        // 選択状態の更新は selection.js の updateSelectionForFeature() で行うが、
        // ここでは shiftKey などをチェックして必要に応じて呼び出す実装が通常
        // （ただし、別ファイルで行うならそこに処理を委譲）

        // ドラッグ開始時点の形状をdeep copy
        dragOriginalShape = JSON.parse(JSON.stringify(feature));
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

        const state = stateManager.getState();
        const { selectedFeature, selectedVertices } = state;
        if (!selectedFeature) return;

        // 頂点選択を複数している場合を考慮して、全頂点を移動させる
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

        // 中間更新 (shouldRecord=false)
        if (state.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(selectedFeature, false);
        } else if (state.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(selectedFeature, false);
        } else if (state.currentTool === 'pointMove') {
            if (selectedFeature.points && selectedFeature.points.length === 1) {
                DataStore.updatePoint(selectedFeature, false);
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

        if (enableMapZoomCallback) {
            enableMapZoomCallback();
        }

        if (!isDraggingFeature) return;
        isDraggingFeature = false;

        if (event.sourceEvent) {
            const tooltipData = getFeatureTooltipData(feature);
            tooltips.showTooltip(event.sourceEvent, tooltipData);
            tooltips.moveTooltip(event.sourceEvent);
        }

        // ドラッグ完了したら UndoRedoManager に1回分の更新アクションを記録
        const st = stateManager.getState();
        if (dData._dragged) {
            if (st.currentTool === 'lineVertexEdit') {
                DataStore.updateLine(feature, false);
                const action = UndoRedoManager.makeAction('updateLine', dragOriginalShape, feature);
                UndoRedoManager.record(action);
            } else if (st.currentTool === 'polygonVertexEdit') {
                DataStore.updatePolygon(feature, false);
                const action = UndoRedoManager.makeAction('updatePolygon', dragOriginalShape, feature);
                UndoRedoManager.record(action);
            } else if (st.currentTool === 'pointMove') {
                if (feature.points && feature.points.length === 1) {
                    DataStore.updatePoint(feature, false);
                    const action = UndoRedoManager.makeAction('updatePoint', dragOriginalShape, feature);
                    UndoRedoManager.record(action);
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
 * エッジドラッグ開始 (新頂点挿入)
 */
export function edgeDragStarted(event, dData, offsetX, feature) {
    debugLog(4, `edgeDragStarted() が呼び出されました。feature.id=${feature?.id}, offsetX=${offsetX}`);
    try {
        if (event.sourceEvent) {
            event.sourceEvent.stopPropagation();
        }
        stateManager.setState({ isDragging: true });
        d3.select(event.sourceEvent.target).raise().classed('active', true);

        if (disableMapZoomCallback) {
            disableMapZoomCallback();
        }

        tooltips.hideTooltip();
        dData._dragged = false;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);

        // 頂点追加前の状態を保存
        dragOriginalShape = JSON.parse(JSON.stringify(feature));

        // 新しい頂点を挿入
        const newX = dData.dragStartX;
        const newY = dData.dragStartY;
        feature.points.splice(dData.endIndex, 0, { x: newX, y: newY });

        if (!feature.id) {
            feature.id = Date.now() + Math.random();
        }

        isDraggingFeature = true;

        const st = stateManager.getState();
        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(feature, false);
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(feature, false);
        }

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

        const st = stateManager.getState();
        const feature = st.selectedFeature;
        if (!feature) return;

        // 挿入した頂点を動かす
        feature.points[dData.endIndex].x += dx;
        feature.points[dData.endIndex].y += dy;

        dData.dragStartX = transformedMouseX;
        dData.dragStartY = transformedMouseY;

        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(feature, false);
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(feature, false);
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

        if (enableMapZoomCallback) {
            enableMapZoomCallback();
        }

        if (!isDraggingFeature) return;
        isDraggingFeature = false;

        if (event.sourceEvent) {
            const tooltipData = getFeatureTooltipData(feature);
            tooltips.showTooltip(event.sourceEvent, tooltipData);
            tooltips.moveTooltip(event.sourceEvent);
        }

        const st = stateManager.getState();
        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(feature, false);
            const action = UndoRedoManager.makeAction('updateLine', dragOriginalShape, feature);
            UndoRedoManager.record(action);
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(feature, false);
            const action = UndoRedoManager.makeAction('updatePolygon', dragOriginalShape, feature);
            UndoRedoManager.record(action);
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
