// src/map/mapInteraction/drag.js
/****************************************************
 * 頂点ドラッグ処理
 * 
 * - ドラッグに伴う座標更新は feature.points[] に直接反映し、
 *   最終的に DataStore.updateLine() / DataStore.updatePolygon() 等で
 *   頂点ストア(VerticesStore)に書き戻される。
 *
 * 修正点:
 *   - ドラッグ完了後、DataStore.updateXxx() したあとに
 *     「再度 Store から読み直して selectedFeature を同期」し、
 *     位置が変わった形状を反映するようにする。
 *   - これにより頂点が動かない問題を解決。
 *   - さらに JSON.stringify() 時の循環参照を回避するため
 *     originalLine/polygon/point は一切付与せず、
 *     safeDeepCopy() 内でも除外。
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

/**
 * ドラッグ完了後に store から最新を読み直して selectedFeature に再設定
 */
function reSyncSelectedFeature(featureId, type) {
    let updated = null;
    switch (type) {
        case 'point':
            updated = DataStore.getById(featureId);
            if (updated) {
                // getPoints(year) ではなく getById() はストア生データ
                // なので geometryを復元してレンダリング用に変換:
                // ただし drag後にすぐ geometryが必要なら
                // DataStore.getPoints(currentYear) から探すのが早い場合も
                // ここでは簡易に "point" なので getPoints()
                const st = stateManager.getState();
                const currentYear = st.currentYear || 0;
                const allPoints = DataStore.getPoints(currentYear);
                updated = allPoints.find(p => p.id === featureId) || null;
            }
            break;
        case 'line':
            updated = DataStore.getById(featureId);
            if (updated) {
                const st = stateManager.getState();
                const currentYear = st.currentYear || 0;
                const allLines = DataStore.getLines(currentYear);
                updated = allLines.find(l => l.id === featureId) || null;
            }
            break;
        case 'polygon':
            updated = DataStore.getById(featureId);
            if (updated) {
                const st = stateManager.getState();
                const currentYear = st.currentYear || 0;
                const allPolygons = DataStore.getPolygons(currentYear);
                updated = allPolygons.find(pg => pg.id === featureId) || null;
            }
            break;
        default:
            break;
    }
    if (updated) {
        stateManager.setState({ selectedFeature: updated });
    } else {
        stateManager.setState({ selectedFeature: null, selectedVertices: [] });
    }
}

/**
 * 外部からの callback 設定
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
 * 外部から enableMapZoom() を受け取り、当モジュールで保持
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
 * ドラッグ中に再描画を間引く
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

        // ドラッグ開始時点の形状を safeDeepCopy
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
        if (!selectedFeature || !selectedFeature.points) {
            return;
        }

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
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(selectedFeature, false);
        } else if (st.currentTool === 'pointMove') {
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
        if (!feature.points) {
            return;
        }

        if (dData._dragged) {
            // UndoRedoManager に1回分の更新アクションを記録 (old->new)
            if (st.currentTool === 'lineVertexEdit') {
                DataStore.updateLine(feature, false);
                // safeDeepCopyで保存しておいた dragOriginalShape → after: feature
                const action = UndoRedoManager.makeAction(
                    'updateLine',
                    dragOriginalShape,
                    safeDeepCopy(feature)
                );
                UndoRedoManager.record(action);
                reSyncSelectedFeature(feature.id, 'line');

            } else if (st.currentTool === 'polygonVertexEdit') {
                DataStore.updatePolygon(feature, false);
                const action = UndoRedoManager.makeAction(
                    'updatePolygon',
                    dragOriginalShape,
                    safeDeepCopy(feature)
                );
                UndoRedoManager.record(action);
                reSyncSelectedFeature(feature.id, 'polygon');

            } else if (st.currentTool === 'pointMove') {
                if (feature.points.length === 1) {
                    DataStore.updatePoint(feature, false);
                    const action = UndoRedoManager.makeAction(
                        'updatePoint',
                        dragOriginalShape,
                        safeDeepCopy(feature)
                    );
                    UndoRedoManager.record(action);
                    reSyncSelectedFeature(feature.id, 'point');
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
 * エッジドラッグ開始(新頂点追加)
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

        // ドラッグ開始時点の形状を deep copy
        // (除外で循環参照を回避)
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
        if (!feature.points) return;

        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(feature, false);
            const action = UndoRedoManager.makeAction(
                'updateLine',
                dragOriginalShape,
                safeDeepCopy(feature)
            );
            UndoRedoManager.record(action);
            reSyncSelectedFeature(feature.id, 'line');

        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(feature, false);
            const action = UndoRedoManager.makeAction(
                'updatePolygon',
                dragOriginalShape,
                safeDeepCopy(feature)
            );
            UndoRedoManager.record(action);
            reSyncSelectedFeature(feature.id, 'polygon');
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
