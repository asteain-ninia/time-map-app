// src/map/mapInteraction/drag.js

import stateManager from '../../state/index.js';
import DataStore from '../../dataStore/index.js';
import tooltips from '../../ui/tooltips.js';
import { debugLog } from '../../utils/logger.js';
import UndoRedoManager from '../../utils/undoRedoManager.js';
import { getFeatureTooltipData } from './selection.js';
import VerticesStore from '../../dataStore/verticesStore.js';

let dragOriginalShape = null;
let isDraggingFeature = false;
let dragRenderTimeout = null;
const DRAG_RENDER_DELAY = 50;

let disableMapZoomCallback = null;
let enableMapZoomCallback = null;
let renderDataCallback = null;

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

export function disableInteractionDragState(disableMapZoom, renderData) {
    if (disableMapZoom) {
        disableMapZoomCallback = disableMapZoom;
    }
    if (renderData) {
        renderDataCallback = renderData;
    }
}

export function enableInteractionDragState(enableMapZoom, renderData) {
    if (enableMapZoom) {
        enableMapZoomCallback = enableMapZoom;
    }
    if (renderData) {
        renderDataCallback = renderData;
    }
}

/**
 * ストア上の本物のオブジェクトを返す。描画用featureの場合 originalLine/originalPolygon/originalPoint があればそれを返す。
 */
function getStoreObj(feature) {
    return feature.originalLine || feature.originalPolygon || feature.originalPoint || feature;
}

/**
 * ドラッグ開始時
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

        const storeObj = getStoreObj(feature);
        dragOriginalShape = JSON.parse(JSON.stringify(storeObj));
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
 * ドラッグ中
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

        const st = stateManager.getState();
        const { selectedFeature, selectedVertices } = st;
        if (!selectedFeature) return;

        const storeObj = getStoreObj(selectedFeature);
        if (!storeObj.vertexIds) return;

        // 頂点をすべて移動
        let allSelected = selectedVertices.filter(v => v.featureId === selectedFeature.id);
        if (allSelected.length === 0) {
            allSelected = [{ featureId: selectedFeature.id, vertexIndex: dData.index }];
        }

        for (const pos of allSelected) {
            const vId = storeObj.vertexIds[pos.vertexIndex];
            if (!vId) continue;
            const vert = VerticesStore.getById(vId);
            if (!vert) continue;
            const newX = vert.x + dx;
            const newY = vert.y + dy;
            VerticesStore.updateVertex({ id: vId, x: newX, y: newY });

            // ★ドラッグ中に selectedFeature.points[...] も更新し、ハンドルをリアルタイムで追随させる
            if (selectedFeature.points && selectedFeature.points[pos.vertexIndex]) {
                selectedFeature.points[pos.vertexIndex].x += dx;
                selectedFeature.points[pos.vertexIndex].y += dy;
            }
        }

        dData.dragStartX = transformedMouseX;
        dData.dragStartY = transformedMouseY;

        // 中間更新
        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(storeObj, false);
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(storeObj, false);
        } else if (st.currentTool === 'pointMove') {
            DataStore.updatePoint(storeObj, false);
        }

        throttledRenderDuringDrag();
    } catch (error) {
        debugLog(1, `vertexDragged() でエラー発生: ${error}`);
    }
}

/**
 * ドラッグ終了
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

        const st = stateManager.getState();
        if (dData._dragged) {
            const storeObj = getStoreObj(feature);

            const oldShape = dragOriginalShape;
            const newShape = JSON.parse(JSON.stringify(storeObj));

            if (st.currentTool === 'lineVertexEdit') {
                DataStore.updateLine(storeObj, false);
                const action = UndoRedoManager.makeAction('updateLine', oldShape, newShape);
                UndoRedoManager.record(action);
            } else if (st.currentTool === 'polygonVertexEdit') {
                DataStore.updatePolygon(storeObj, false);
                const action = UndoRedoManager.makeAction('updatePolygon', oldShape, newShape);
                UndoRedoManager.record(action);
            } else if (st.currentTool === 'pointMove') {
                DataStore.updatePoint(storeObj, false);
                const action = UndoRedoManager.makeAction('updatePoint', oldShape, newShape);
                UndoRedoManager.record(action);
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

        const storeObj = getStoreObj(feature);
        dragOriginalShape = JSON.parse(JSON.stringify(storeObj));

        if (storeObj.vertexIds) {
            const newId = VerticesStore.addVertex({
                x: dData.dragStartX,
                y: dData.dragStartY
            });
            storeObj.vertexIds.splice(dData.endIndex, 0, newId);

            // ★ selectedFeature.points も挿入
            if (feature.points) {
                feature.points.splice(dData.endIndex, 0, {
                    x: dData.dragStartX,
                    y: dData.dragStartY
                });
            }
        }

        isDraggingFeature = true;

        // 頂点追加直後は selectedVertices をクリアしておく（インデックスずれ対策）
        stateManager.setState({ selectedVertices: [] });

        const st = stateManager.getState();
        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(storeObj, false);
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(storeObj, false);
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
        const selectedFeature = st.selectedFeature;
        if (!selectedFeature) return;

        const storeObj = getStoreObj(selectedFeature);
        if (!storeObj.vertexIds) return;

        const vId = storeObj.vertexIds[dData.endIndex];
        if (!vId) return;

        const vert = VerticesStore.getById(vId);
        if (vert) {
            const newX = vert.x + dx;
            const newY = vert.y + dy;
            VerticesStore.updateVertex({ id: vId, x: newX, y: newY });
        }

        // 同じく selectedFeature.points を更新
        if (selectedFeature.points && selectedFeature.points[dData.endIndex]) {
            selectedFeature.points[dData.endIndex].x += dx;
            selectedFeature.points[dData.endIndex].y += dy;
        }

        dData.dragStartX = transformedMouseX;
        dData.dragStartY = transformedMouseY;

        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(storeObj, false);
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(storeObj, false);
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
        const storeObj = getStoreObj(feature);

        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(storeObj, false);
            const action = UndoRedoManager.makeAction('updateLine', dragOriginalShape, storeObj);
            UndoRedoManager.record(action);
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(storeObj, false);
            const action = UndoRedoManager.makeAction('updatePolygon', dragOriginalShape, storeObj);
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
