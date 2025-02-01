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
import { polygonsOverlap, pointInPolygon } from '../../utils/geometryUtils.js';

let dragOriginalShape = null; // ドラッグ前の形状を保持するための変数
let isDraggingFeature = false; // ドラッグ中かどうかのフラグ
let dragRenderTimeout = null;  // ドラッグ中の頻繁な再描画を間引くためのタイマー
const DRAG_RENDER_DELAY = 50;  // 再描画遅延時間

// 地図ズーム無効化／有効化用コールバック
let disableMapZoomCallback = null;
let enableMapZoomCallback = null;

// 再描画コールバック (renderData)
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
 * ドラッグ中の再描画を間引く
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
        // 初回ドラッグ時、各頂点の有効な候補位置を記録するためのオブジェクトを初期化
        dData.lastValidCandidates = {};
        // スナップ状態関連のプロパティを初期化
        dData.snapPolygonId = null;
        dData.snapCandidate = null;
        dData.snapEdgeA = null;
        dData.snapEdgeB = null;

        // ドラッグ開始時点の形状をバックアップ
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
        if (!isDraggingFeature) return;

        dData._dragged = true;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());

        const dx = transform.invertX(mouseX) - dData.dragStartX;
        const dy = transform.invertY(mouseY) - dData.dragStartY;

        // 更新後のドラッグ開始位置を更新
        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);

        const st = stateManager.getState();
        const { selectedFeature } = st;
        if (!selectedFeature || !selectedFeature.points) return;

        // 単純な移動候補（ポリゴン外ではカーソルと完全同期）
        const simpleCandidate = {
            x: selectedFeature.points[dData.index].x + dx,
            y: selectedFeature.points[dData.index].y + dy
        };
        let candidate = simpleCandidate;

        // 現在のマウス座標
        const mouseCoord = { x: transform.invertX(mouseX), y: transform.invertY(mouseY) };
        const SNAP_THRESHOLD = 10 / transform.k;
        const allPolygons = DataStore.getPolygons(st.currentYear);

        // 既にスナップ状態がある場合は、その対象ポリゴン内にマウスが留まっているか確認
        if (dData.snapPolygonId) {
            const snapPoly = allPolygons.find(p => p.id === dData.snapPolygonId);
            if (snapPoly && pointInPolygon(mouseCoord, snapPoly.points)) {
                // 既に記録済みのエッジ上で再計算して「滑る」ようにする
                if (dData.snapEdgeA && dData.snapEdgeB) {
                    const { proj } = (() => {
                        const ABx = dData.snapEdgeB.x - dData.snapEdgeA.x;
                        const ABy = dData.snapEdgeB.y - dData.snapEdgeA.y;
                        const len2 = ABx * ABx + ABy * ABy;
                        let t = 0;
                        if (len2 > 0) {
                            t = ((mouseCoord.x - dData.snapEdgeA.x) * ABx + (mouseCoord.y - dData.snapEdgeA.y) * ABy) / len2;
                            if (t < 0) t = 0;
                            if (t > 1) t = 1;
                        }
                        return { proj: { x: dData.snapEdgeA.x + t * ABx, y: dData.snapEdgeA.y + t * ABy } };
                    })();
                    candidate = proj;
                    dData.snapCandidate = proj;
                } else {
                    // エッジ情報が無ければ再計算（下記の全体探索へ）
                    dData.snapPolygonId = null;
                    dData.snapCandidate = null;
                    dData.snapEdgeA = null;
                    dData.snapEdgeB = null;
                    candidate = simpleCandidate;
                }
            } else {
                // マウスがスナップ対象ポリゴンから外れている場合は、スナップ状態をクリアして単純候補を採用
                dData.snapPolygonId = null;
                dData.snapCandidate = null;
                dData.snapEdgeA = null;
                dData.snapEdgeB = null;
                candidate = simpleCandidate;
            }
        }
        // スナップ状態が未設定の場合は、新たにスナップ候補を計算する
        if (!dData.snapPolygonId) {
            let bestSnapCandidate = null;
            let bestSnapDistance = Infinity;
            let bestPolyId = null;
            let bestEdgeA = null;
            let bestEdgeB = null;
            for (const poly of allPolygons) {
                if (poly.id === selectedFeature.id) continue;
                if (!poly.points || poly.points.length < 2) continue;
                // マウス座標が対象ポリゴン内にあるかどうかを確認
                if (!pointInPolygon(mouseCoord, poly.points)) continue;
                for (let j = 0; j < poly.points.length; j++) {
                    const A = poly.points[j];
                    const B = poly.points[(j + 1) % poly.points.length];
                    const ABx = B.x - A.x;
                    const ABy = B.y - A.y;
                    const len2 = ABx * ABx + ABy * ABy;
                    let t = 0;
                    if (len2 > 0) {
                        t = ((mouseCoord.x - A.x) * ABx + (mouseCoord.y - A.y) * ABy) / len2;
                        if (t < 0) t = 0;
                        if (t > 1) t = 1;
                    }
                    const proj = { x: A.x + t * ABx, y: A.y + t * ABy };
                    const dxSeg = mouseCoord.x - proj.x;
                    const dySeg = mouseCoord.y - proj.y;
                    const dist = Math.sqrt(dxSeg * dxSeg + dySeg * dySeg);
                    if (dist < SNAP_THRESHOLD && dist < bestSnapDistance) {
                        bestSnapDistance = dist;
                        bestSnapCandidate = proj;
                        bestPolyId = poly.id;
                        bestEdgeA = A;
                        bestEdgeB = B;
                    }
                }
            }
            if (bestSnapCandidate) {
                candidate = bestSnapCandidate;
                dData.snapPolygonId = bestPolyId;
                dData.snapCandidate = bestSnapCandidate;
                dData.snapEdgeA = bestEdgeA;
                dData.snapEdgeB = bestEdgeB;
            }
        }

        // 重複排他チェック：仮に candidate を適用した場合の selectedFeature の頂点リストを作成
        let tempPoints = selectedFeature.points.slice();
        tempPoints[dData.index] = { x: candidate.x, y: candidate.y };
        let overlapDetected = false;
        for (const poly of allPolygons) {
            if (poly.id === selectedFeature.id) continue;
            if (poly.layerId !== selectedFeature.layerId) continue;
            if (poly.points && poly.points.length >= 3) {
                if (polygonsOverlap(tempPoints, poly.points)) {
                    overlapDetected = true;
                    break;
                }
            }
        }
        if (overlapDetected) {
            if (dData.lastValidCandidates && dData.lastValidCandidates[dData.index]) {
                candidate = dData.lastValidCandidates[dData.index];
            } else {
                candidate = selectedFeature.points[dData.index];
            }
        } else {
            dData.lastValidCandidates[dData.index] = { x: candidate.x, y: candidate.y };
        }
        // 最終的に該当頂点の位置を candidate に更新
        selectedFeature.points[dData.index].x = candidate.x;
        selectedFeature.points[dData.index].y = candidate.y;

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
            renderDataCallback && renderDataCallback();
            return;
        }

        // ドラッグ中に少なくとも1回移動した場合
        if (dData._dragged) {
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
        // 初回ドラッグ時の設定：スナップ状態初期化
        dData.snapPolygonId = null;
        dData.snapCandidate = null;
        dData.snapEdgeA = null;
        dData.snapEdgeB = null;

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
            // 単純な移動候補
            const simpleCandidate = { x: pt.x + dx, y: pt.y + dy };
            let candidate = simpleCandidate;

            // 新規頂点用のスナップ処理（同様にスナップ状態を保持）
            const mouseCoord = { x: transform.invertX(mouseX), y: transform.invertY(mouseY) };
            const SNAP_THRESHOLD = 10 / transform.k;
            const allPolygons = DataStore.getPolygons(st.currentYear);

            if (dData.snapPolygonId) {
                const snapPoly = allPolygons.find(p => p.id === dData.snapPolygonId);
                if (snapPoly && pointInPolygon(mouseCoord, snapPoly.points)) {
                    if (dData.snapEdgeA && dData.snapEdgeB) {
                        const ABx = dData.snapEdgeB.x - dData.snapEdgeA.x;
                        const ABy = dData.snapEdgeB.y - dData.snapEdgeA.y;
                        const len2 = ABx * ABx + ABy * ABy;
                        let t = 0;
                        if (len2 > 0) {
                            t = ((mouseCoord.x - dData.snapEdgeA.x) * ABx + (mouseCoord.y - dData.snapEdgeA.y) * ABy) / len2;
                            if (t < 0) t = 0;
                            if (t > 1) t = 1;
                        }
                        const proj = { x: dData.snapEdgeA.x + t * ABx, y: dData.snapEdgeA.y + t * ABy };
                        candidate = proj;
                        dData.snapCandidate = proj;
                    } else {
                        dData.snapPolygonId = null;
                        dData.snapCandidate = null;
                        dData.snapEdgeA = null;
                        dData.snapEdgeB = null;
                        candidate = simpleCandidate;
                    }
                } else {
                    dData.snapPolygonId = null;
                    dData.snapCandidate = null;
                    dData.snapEdgeA = null;
                    dData.snapEdgeB = null;
                    candidate = simpleCandidate;
                }
            }
            if (!dData.snapPolygonId) {
                let bestSnapCandidate = null;
                let bestSnapDistance = Infinity;
                let bestPolyId = null;
                let bestEdgeA = null;
                let bestEdgeB = null;
                for (const poly of allPolygons) {
                    if (poly.id === feature.id) continue;
                    if (!poly.points || poly.points.length < 2) continue;
                    if (!pointInPolygon(mouseCoord, poly.points)) continue;
                    for (let j = 0; j < poly.points.length; j++) {
                        const A = poly.points[j];
                        const B = poly.points[(j + 1) % poly.points.length];
                        const ABx = B.x - A.x;
                        const ABy = B.y - A.y;
                        const len2 = ABx * ABx + ABy * ABy;
                        let t = 0;
                        if (len2 > 0) {
                            t = ((mouseCoord.x - A.x) * ABx + (mouseCoord.y - A.y) * ABy) / len2;
                            if (t < 0) t = 0;
                            if (t > 1) t = 1;
                        }
                        const proj = { x: A.x + t * ABx, y: A.y + t * ABy };
                        const dxSeg = mouseCoord.x - proj.x;
                        const dySeg = mouseCoord.y - proj.y;
                        const dist = Math.sqrt(dxSeg * dxSeg + dySeg * dySeg);
                        if (dist < SNAP_THRESHOLD && dist < bestSnapDistance) {
                            bestSnapDistance = dist;
                            bestSnapCandidate = proj;
                            bestPolyId = poly.id;
                            bestEdgeA = A;
                            bestEdgeB = B;
                        }
                    }
                }
                if (bestSnapCandidate) {
                    candidate = bestSnapCandidate;
                    dData.snapPolygonId = bestPolyId;
                    dData.snapCandidate = bestSnapCandidate;
                    dData.snapEdgeA = bestEdgeA;
                    dData.snapEdgeB = bestEdgeB;
                }
            }
            pt.x = candidate.x;
            pt.y = candidate.y;
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

        if (dData._dragged) {
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
