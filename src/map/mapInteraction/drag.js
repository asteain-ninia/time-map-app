// src/map/mapInteraction/drag.js
/****************************************************
 * ドラッグ操作に関するモジュール
 ****************************************************/

import stateManager from '../../state/index.js';
import DataStore from '../../dataStore/index.js';
import tooltips from '../../ui/tooltips.js';
import { debugLog } from '../../utils/logger.js';
import UndoRedoManager from '../../utils/undoRedoManager.js';
import { getFeatureTooltipData } from './selection.js';

/**
 * ドラッグ前の形状を保持するための変数。
 */
let dragOriginalShape = null;

/**
 * ドラッグ中かどうかのフラグ
 */
let isDraggingFeature = false;

/**
 * ドラッグ中の頻繁な再描画を間引くためのタイマー
 */
let dragRenderTimeout = null;
const DRAG_RENDER_DELAY = 50;

/**
 * 地図ズーム無効化／有効化用コールバック
 */
let disableMapZoomCallback = null;
let enableMapZoomCallback = null;

/**
 * 再描画コールバック (renderData)
 */
let renderDataCallback = null;

/**
 * originalLine / originalPolygon / originalPoint などを除外して
 * 循環参照を防ぐディープコピー
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
 * ドラッグ中の再描画を間引きする
 */
function throttledRenderDuringDrag() {
    try {
        if (!renderDataCallback) return;
        if (!dragRenderTimeout) {
            dragRenderTimeout = setTimeout(() => {
                debugLog(4, 'throttledRenderDuringDrag - 再描画実行');
                renderDataCallback();
                dragRenderTimeout = null;
            }, DRAG_RENDER_DELAY);
        }
    } catch (error) {
        debugLog(1, `throttledRenderDuringDrag() でエラー発生: ${error}`);
    }
}

/**
 * UIイベントから disableMapZoom() と renderData() を受け取り、当モジュールで保持
 */
export function disableInteractionDragState(disableMapZoom, renderData) {
    if (disableMapZoom) disableMapZoomCallback = disableMapZoom;
    if (renderData) renderDataCallback = renderData;
}

/**
 * UIイベントから enableMapZoom() と renderData() を受け取り、当モジュールで保持
 */
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
        if (event.sourceEvent) {
            // d3イベントと地図ズームなどの衝突を防ぐ
            event.sourceEvent.stopPropagation();
        }
        // ドラッグ開始フラグ
        stateManager.setState({ isDragging: true });
        d3.select(event.sourceEvent.target).raise().classed('active', true);

        // ズーム無効化
        if (disableMapZoomCallback) disableMapZoomCallback();

        tooltips.hideTooltip();

        dData._dragged = false;

        // ドラッグ開始位置を記録
        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);

        // ドラッグ開始時点の形状をバックアップ
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
        if (!isDraggingFeature) return;

        dData._dragged = true;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());

        const dx = transform.invertX(mouseX) - dData.dragStartX;
        const dy = transform.invertY(mouseY) - dData.dragStartY;

        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);

        // 選択中フィーチャの頂点を移動
        const st = stateManager.getState();
        const { selectedFeature, selectedVertices } = st;
        if (!selectedFeature || !selectedFeature.points) return;

        let allSelected = selectedVertices.filter(v => v.featureId === selectedFeature.id);
        if (allSelected.length === 0) {
            allSelected = [{ featureId: selectedFeature.id, vertexIndex: dData.index }];
        }
        for (const pos of allSelected) {
            const pt = selectedFeature.points[pos.vertexIndex];
            if (!pt) continue;
            pt.x += dx;
            pt.y += dy;
        }

        // ---- 中間updateを行い、線や面をリアルタイム描画させる ----
        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(selectedFeature, false);
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(selectedFeature, false);
        } else if (st.currentTool === 'pointMove') {
            // ポイントの場合、単一点のみ
            if (selectedFeature.points.length === 1) {
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

        // ズーム再有効化
        if (enableMapZoomCallback) enableMapZoomCallback();

        if (!isDraggingFeature) return;
        isDraggingFeature = false;

        if (event.sourceEvent) {
            const tooltipData = getFeatureTooltipData(feature);
            tooltips.showTooltip(event.sourceEvent, tooltipData);
            tooltips.moveTooltip(event.sourceEvent);
        }

        const st = stateManager.getState();
        if (!feature.points) {
            // ドラッグ対象の頂点配列が無いなら何もしない
            renderDataCallback && renderDataCallback();
            return;
        }

        // ドラッグ中に少なくとも1回移動した
        if (dData._dragged) {
            // 最終的に store を update (shouldRecord=false) + UndoRedoManager記録
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
        }

        // 再描画
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

        // バックアップ
        dragOriginalShape = safeDeepCopy(feature);

        // 新しい頂点を挿入
        if (!feature.points) feature.points = [];
        feature.points.splice(dData.endIndex, 0, {
            x: dData.dragStartX,
            y: dData.dragStartY
        });

        isDraggingFeature = true;

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

        const dx = transform.invertX(mouseX) - dData.dragStartX;
        const dy = transform.invertY(mouseY) - dData.dragStartY;

        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);

        const st = stateManager.getState();
        const feature = st.selectedFeature;
        if (!feature || !feature.points) return;

        // 追加された新頂点を移動
        const pt = feature.points[dData.endIndex];
        if (pt) {
            pt.x += dx;
            pt.y += dy;
        }

        // 中間updateし、ライン/ポリゴンをリアルタイム追従
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
            renderDataCallback && renderDataCallback();
            return;
        }

        // 最終更新 & UndoRedo
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
