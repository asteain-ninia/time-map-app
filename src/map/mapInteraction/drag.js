// src/map/mapInteraction/drag.js
/****************************************************
 * 頂点ドラッグ処理
 *
 * ポイント:
 *   - ドラッグ中の中間updateを廃止し、ドラッグ完了時に1度だけ
 *     DataStore.updateXxx(feature) を行う方針に変更。
 *   - これにより「ドラッグ途中で元の座標に戻る」不具合を回避。
 *   - ドラッグ中はあくまでも selectedFeature の points を更新し、
 *     画面上の描画をリフレッシュするのみ。
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
 * 循環参照除去ディープコピー
 */
function safeDeepCopy(obj) {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (key === 'originalLine' || key === 'originalPolygon' || key === 'originalPoint') {
            return undefined;
        }
        return value;
    }));
}

/**
 * ドラッグ中の描画を間引きする
 */
function throttledRenderDuringDrag() {
    if (!renderDataCallback) return;
    if (!dragRenderTimeout) {
        dragRenderTimeout = setTimeout(() => {
            debugLog(4, 'throttledRenderDuringDrag - 描画実行');
            renderDataCallback();
            dragRenderTimeout = null;
        }, DRAG_RENDER_DELAY);
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
 * (中間updateは行わず、selectedFeature.pointsを更新して再描画するのみ)
 */
export function vertexDragged(event, dData) {
    debugLog(4, 'vertexDragged() が呼び出されました。');
    try {
        if (!isDraggingFeature) return;
        dData._dragged = true;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        const dx = transform.invertX(mouseX) - dData.dragStartX;
        const dy = transform.invertY(mouseY) - dData.dragStartY;

        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);

        const st = stateManager.getState();
        const { selectedFeature, selectedVertices } = st;
        if (!selectedFeature || !selectedFeature.points) return;

        // 選択頂点（複数）の座標を更新
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

        // 画面再描画
        throttledRenderDuringDrag();
    } catch (error) {
        debugLog(1, `vertexDragged() でエラー発生: ${error}`);
    }
}

/**
 * 頂点ドラッグ終了
 * → ここで初めて Store を更新し、UndoRedoManagerに記録
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
        if (!feature.points || !dData._dragged) {
            // ドラッグしていないなら何もしない
            renderDataCallback && renderDataCallback();
            return;
        }

        // 形状更新
        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(feature, false);

            const action = UndoRedoManager.makeAction(
                'updateLine',
                dragOriginalShape,
                safeDeepCopy(feature)
            );
            UndoRedoManager.record(action);

        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(feature, false);

            const action = UndoRedoManager.makeAction(
                'updatePolygon',
                dragOriginalShape,
                safeDeepCopy(feature)
            );
            UndoRedoManager.record(action);

        } else if (st.currentTool === 'pointMove') {
            if (feature.points.length === 1) {
                DataStore.updatePoint(feature, false);

                const action = UndoRedoManager.makeAction(
                    'updatePoint',
                    dragOriginalShape,
                    safeDeepCopy(feature)
                );
                UndoRedoManager.record(action);
            }
        }

        // 最後に再描画
        if (renderDataCallback) renderDataCallback();

        // クリア
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
 * エッジドラッグ開始(新頂点追加)
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
        isDraggingFeature = true;

        // 新しい頂点を挿入 (最初はドラッグ開始位置)
        if (!feature.points) feature.points = [];
        feature.points.splice(dData.endIndex, 0, {
            x: dData.dragStartX,
            y: dData.dragStartY
        });

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
 *  - 追加された頂点( endIndex )をマウス移動に追従
 *  - 中間Store更新はしない
 */
export function edgeDragged(event, dData) {
    debugLog(4, 'edgeDragged() が呼び出されました。');
    try {
        if (!isDraggingFeature) return;
        dData._dragged = true;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());

        const dx = transform.invertX(mouseX) - dData.dragStartX;
        const dy = transform.invertY(mouseY) - dData.dragStartY;

        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);

        const st = stateManager.getState();
        const feature = st.selectedFeature;
        if (!feature || !feature.points) return;

        const pt = feature.points[dData.endIndex];
        if (pt) {
            pt.x += dx;
            pt.y += dy;
        }

        // 再描画 (中間更新なし)
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
        if (!feature.points || !dData._dragged) {
            if (renderDataCallback) renderDataCallback();
            return;
        }

        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(feature, false);
            const action = UndoRedoManager.makeAction(
                'updateLine',
                dragOriginalShape,
                safeDeepCopy(feature)
            );
            UndoRedoManager.record(action);

        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(feature, false);
            const action = UndoRedoManager.makeAction(
                'updatePolygon',
                dragOriginalShape,
                safeDeepCopy(feature)
            );
            UndoRedoManager.record(action);
        }

        if (renderDataCallback) renderDataCallback();

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
