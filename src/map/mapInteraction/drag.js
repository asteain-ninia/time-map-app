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
import { polygonsOverlap } from '../../utils/geometryUtils.js';

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
        // 初回ドラッグ時、各頂点の有効な候補位置を記録するためのオブジェクトを初期化
        dData.lastValidCandidates = {};

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

        // 自由移動候補の算出と排他チェック
        // 各対象頂点について処理（対象が選択されていなければ、ドラッグ対象として1点とする）
        let allSelected = selectedVertices.filter(v => v.featureId === selectedFeature.id);
        if (allSelected.length === 0) {
            allSelected = [{ featureId: selectedFeature.id, vertexIndex: dData.index }];
        }

        // ヘルパー関数：指定点と線分ABとの距離および射影点を算出
        function pointToSegment(candidate, A, B) {
            const ABx = B.x - A.x;
            const ABy = B.y - A.y;
            const len2 = ABx * ABx + ABy * ABy;
            let t = 0;
            if (len2 > 0) {
                t = ((candidate.x - A.x) * ABx + (candidate.y - A.y) * ABy) / len2;
                if (t < 0) t = 0;
                if (t > 1) t = 1;
            }
            const proj = { x: A.x + t * ABx, y: A.y + t * ABy };
            const dxSeg = candidate.x - proj.x;
            const dySeg = candidate.y - proj.y;
            const dist = Math.sqrt(dxSeg * dxSeg + dySeg * dySeg);
            return { proj, dist };
        }

        // スナップ閾値（ズーム係数により調整）
        const SNAP_THRESHOLD = 10 / transform.k;
        // 現在年の全ポリゴン（排他チェック用）
        const allPolygons = DataStore.getPolygons(st.currentYear);

        for (const pos of allSelected) {
            const i = pos.vertexIndex;
            let pt = selectedFeature.points[i];
            if (!pt) continue;

            // 自由移動候補位置
            let candidate = { x: pt.x + dx, y: pt.y + dy };

            // 他のポリゴン（自分自身を除く）のエッジへの吸着処理
            let snapCandidate = null;
            let minDist = Infinity;
            for (const poly of allPolygons) {
                if (poly.id === selectedFeature.id) continue; // 自分自身は除外
                if (!poly.points || poly.points.length < 2) continue;
                const nPts = poly.points.length;
                for (let j = 0; j < nPts; j++) {
                    const A = poly.points[j];
                    const B = poly.points[(j + 1) % nPts];
                    const { proj, dist } = pointToSegment(candidate, A, B);
                    if (dist < SNAP_THRESHOLD && dist < minDist) {
                        minDist = dist;
                        snapCandidate = proj;
                    }
                }
            }
            if (snapCandidate) {
                candidate = snapCandidate;
            }

            // 次に、重複排他チェック：
            // 仮に candidate を適用した場合の selectedFeature の頂点リストを作成
            let tempPoints = selectedFeature.points.slice();
            tempPoints[i] = { x: candidate.x, y: candidate.y };
            let overlapDetected = false;
            for (const poly of allPolygons) {
                if (poly.id === selectedFeature.id) continue;
                if (poly.layerId !== selectedFeature.layerId) continue;
                if (poly.points && poly.points.length >= 3) {
                    // polygonsOverlap は外周のみでチェックする想定
                    // ※穴情報はここでは考慮しない
                    // ※重複と判断された場合、overlapDetected を true にする
                    // ※ここでは、単に重なりが発生するかどうかを調べる
                    if (polygonsOverlap(tempPoints, poly.points)) {
                        overlapDetected = true;
                        break;
                    }
                }
            }
            // 適用候補が重複する場合は、候補を更新せず、前回有効な候補があればそれを使う
            if (overlapDetected) {
                if (dData.lastValidCandidates && dData.lastValidCandidates[i]) {
                    candidate = dData.lastValidCandidates[i];
                } else {
                    // もし初回から重複するなら、何もしない（位置更新なし）
                    candidate = pt; // そのまま
                }
            } else {
                // 候補が有効なら更新して記録
                dData.lastValidCandidates[i] = { x: candidate.x, y: candidate.y };
            }
            // 最終的に該当頂点の位置を candidate に更新
            pt.x = candidate.x;
            pt.y = candidate.y;
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
