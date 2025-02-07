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
import { polygonsOverlap, pointInPolygon, distancePointToSegment, doLineSegmentsIntersect } from '../../utils/geometryUtils.js';
import VerticesStore from '../../dataStore/verticesStore.js';

// ===== 追加：自己交差および重なり判定用ヘルパー =====
function isSelfIntersecting(polygon) {
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
        const a1 = polygon[i];
        const a2 = polygon[(i + 1) % n];
        for (let j = i + 2; j < n; j++) {
            // 隣接エッジ（および最初と最後のエッジ）はスキップ
            if (i === 0 && j === n - 1) continue;
            const b1 = polygon[j];
            const b2 = polygon[(j + 1) % n];
            if (doLineSegmentsIntersect(a1, a2, b1, b2)) {
                return true;
            }
        }
    }
    return false;
}

function causesOverlap(candidatePolygon, selectedFeatureId, currentLayer) {
    const allPolygons = DataStore.getPolygons(stateManager.getState().currentYear);
    for (const poly of allPolygons) {
        if (poly.id === selectedFeatureId) continue;
        if (poly.layerId !== currentLayer) continue;
        if (polygonsOverlap(candidatePolygon, poly.points, selectedFeatureId)) { // Check the third argument (ignore id)
            return true;
        }
    }
    return false;
}
// ===== ここまで追加 =====

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
 * ドラッグ中にスナップ対象となっているエッジ情報を保持するための変数
 * { snapEdgeA, snapEdgeB } の形で保持し、ドラッグ終了時にクリアする
 */
export let currentSnapEdge = null;

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
                try {
                    renderDataCallback();
                    dragRenderTimeout = null;
                } catch (error) {
                    debugLog(1, `throttledRenderDuringDrag() 内でエラー発生: ${error}`);
                }
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
        // dragStartedではdData.offsetXを保存（draggedで現在地との差分を計算するため）
        dData.offsetX = offsetX;

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

        // const dx = transform.invertX(mouseX) - dData.dragStartX;
        // const dy = transform.invertY(mouseY) - dData.dragStartY;

        // // 更新後のドラッグ開始位置を更新
        // dData.dragStartX = transform.invertX(mouseX);
        // dData.dragStartY = transform.invertY(mouseY);
        // 代わりにoffsetXを利用
        // const dx = (transform.invertX(mouseX) - dData.offsetX) - dData.dragStartX;
        // const dy = (transform.invertY(mouseY)                ) - dData.dragStartY;
        // dData.dragStartX = transform.invertX(mouseX) - dData.offsetX;
        // dData.dragStartY = transform.invertY(mouseY);
        // さらに変更。オフセット分を戻さない
        const dx = (transform.invertX(mouseX)) - dData.dragStartX;
        const dy = (transform.invertY(mouseY)) - dData.dragStartY;
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
        // const mouseCoord = { x: transform.invertX(mouseX), y: transform.invertY(mouseY) };
        // offsetXを考慮
        const mouseCoord = { x: transform.invertX(mouseX) - dData.offsetX, y: transform.invertY(mouseY) };

        // スナップ処理
        const SNAP_THRESHOLD = 15 / transform.k;
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

        // 現在のスナップエッジ情報をグローバル変数に反映（ハイライト描画用）
        currentSnapEdge = (dData.snapEdgeA && dData.snapEdgeB) ? { snapEdgeA: dData.snapEdgeA, snapEdgeB: dData.snapEdgeB } : null;

        // 既存面内に頂点を配置できないチェック＋
        // 候補で更新した場合の自己交差・重なり判定
        const candidatePolygon = selectedFeature.points.slice();
        candidatePolygon[dData.index] = { x: candidate.x, y: candidate.y };
        if (isSelfIntersecting(candidatePolygon)) {
            debugLog(3, '候補の頂点移動により自己交差が発生するため、前の有効候補に戻します。');
            if (dData.lastValidCandidates && dData.lastValidCandidates[dData.index]) {
                candidate = dData.lastValidCandidates[dData.index];
            } else {
                candidate = selectedFeature.points[dData.index];
            }
        } else if (causesOverlap(candidatePolygon, selectedFeature.id, selectedFeature.layerId)) {
            debugLog(3, '候補の頂点移動により同一レイヤー内で面情報が重なってしまうため、前の有効候補に戻します。');
            if (dData.lastValidCandidates && dData.lastValidCandidates[dData.index]) {
                candidate = dData.lastValidCandidates[dData.index];
            } else {
                candidate = selectedFeature.points[dData.index];
            }
        } else {
            dData.lastValidCandidates[dData.index] = { x: candidate.x, y: candidate.y };
        }

        // 最終的に該当頂点の位置を candidate に更新
        // selectedFeature.points[dData.index].x = candidate.x;
        // selectedFeature.points[dData.index].y = candidate.y;

        // 代わりに、createOrGetVertexを呼んで、実際に近い頂点があればそちらを使う
        const { x, y } = candidate;
        // 除外対象
        const excludeIds = selectedFeature.vertexIds.filter(
            (id, index) => index !== dData.index
        );

        const newVertexId = VerticesStore.createOrGetVertex({ x, y }, excludeIds);

        // 既存の頂点IDから置き換える
        selectedFeature.vertexIds[dData.index] = newVertexId;
        // 座標も更新
        const newVertex = VerticesStore.getById(newVertexId);
        selectedFeature.points[dData.index].x = newVertex.x;
        selectedFeature.points[dData.index].y = newVertex.y;

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

        // ドラッグ終了時はスナップエッジ情報をクリア
        currentSnapEdge = null;

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
                // DataStore 側の points, vertexIds を更新
                // feature.points.forEach((p, i) => {
                //     const vertexId = feature.vertexIds[i];
                //     if (vertexId) {
                //         const vertex = VerticesStore.getById(vertexId);
                //         if (vertex) {
                //             vertex.x = p.x;
                //             vertex.y = p.y;
                //             VerticesStore.updateVertex(vertex);
                //         }
                //     }
                // });
                // 代わりに
                const vertex = VerticesStore.getById(feature.vertexIds[dData.index]);
                if (vertex) {
                    vertex.x = feature.points[dData.index].x;
                    vertex.y = feature.points[dData.index].y;
                    VerticesStore.updateVertex(vertex);
                }

                DataStore.updateLine(feature, false);
                const action = UndoRedoManager.makeAction(
                    'updateLine',
                    dragOriginalShape,
                    safeDeepCopy(feature)
                );
                UndoRedoManager.record(action);

            } else if (st.currentTool === 'polygonVertexEdit') {
                // DataStore 側の points, vertexIds を更新
                // feature.points.forEach((p, i) => {
                //     const vertexId = feature.vertexIds[i];
                //         if(vertexId){
                //         const vertex = VerticesStore.getById(vertexId);
                //         if (vertex) {
                //             vertex.x = p.x;
                //             vertex.y = p.y;
                //             VerticesStore.updateVertex(vertex);
                //         }
                //     }
                // });
                // 代わりに
                const vertex = VerticesStore.getById(feature.vertexIds[dData.index]);
                if (vertex) {
                    vertex.x = feature.points[dData.index].x;
                    vertex.y = feature.points[dData.index].y;
                    VerticesStore.updateVertex(vertex);
                }
                DataStore.updatePolygon(feature, false);
                const action = UndoRedoManager.makeAction(
                    'updatePolygon',
                    dragOriginalShape,
                    safeDeepCopy(feature)
                );
                UndoRedoManager.record(action);

            } else if (st.currentTool === 'pointMove') {
                if (feature.points.length === 1) {
                    // DataStore 側の points, vertexIds を更新
                    // feature.points.forEach((p, i) => {
                    //     const vertexId = feature.vertexIds[i];
                    //     if(vertexId){
                    //         const vertex = VerticesStore.getById(vertexId);
                    //         if (vertex) {
                    //             vertex.x = p.x;
                    //             vertex.y = p.y;
                    //             VerticesStore.updateVertex(vertex);
                    //         }
                    //     }
                    // });
                    // 代わりに
                    const vertex = VerticesStore.getById(feature.vertexIds[dData.index]);
                    if (vertex) {
                        vertex.x = feature.points[dData.index].x;
                        vertex.y = feature.points[dData.index].y;
                        VerticesStore.updateVertex(vertex);
                    }

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
        delete dData.offsetX
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
        // ← ここで新規頂点用の候補記録用オブジェクトを初期化（vertexDragStarted では行っている）
        dData.lastValidCandidates = {};
        dData._dragged = false;
        // 初回ドラッグ時の設定：スナップ状態初期化
        dData.snapPolygonId = null;
        dData.snapCandidate = null;
        dData.snapEdgeA = null;
        dData.snapEdgeB = null;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        // dData.dragStartX = transform.invertX(mouseX);
        // dData.dragStartY = transform.invertY(mouseY);
        // 代わりに
        dData.dragStartX = transform.invertX(mouseX) - offsetX;
        dData.dragStartY = transform.invertY(mouseY);
        dData.offsetX = offsetX;


        // バックアップ
        dragOriginalShape = safeDeepCopy(feature);

        // 新しい頂点を挿入
        if (!feature.points) feature.points = [];

        // offsetXを考慮
        const newCoord = { x: dData.dragStartX, y: dData.dragStartY };

        // 新しい頂点IDの生成（共有頂点の可能性も考慮）
        const newVertexId = VerticesStore.createOrGetVertex(newCoord);

        // feature.vertexIds にも新しい頂点IDを挿入
        if (!feature.vertexIds) {
            feature.vertexIds = [];
        }
        feature.vertexIds.splice(dData.endIndex, 0, newVertexId);

        // feature.points も更新（spliceを使う）
        // const newPoint = { x: dData.dragStartX, y: dData.dragStartY }; // ここもワールド座標
        // 代わりに
        const newPoint = { x: newCoord.x, y: newCoord.y };

        feature.points.splice(dData.endIndex, 0, newPoint);

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

        // const dx = transform.invertX(mouseX) - dData.dragStartX;
        // const dy = transform.invertY(mouseY) - dData.dragStartY;

        // dData.dragStartX = transform.invertX(mouseX);
        // dData.dragStartY = transform.invertY(mouseY);
        // 代わりに
        // const dx = (transform.invertX(mouseX) - dData.offsetX) - dData.dragStartX;
        // const dy = (transform.invertY(mouseY)                ) - dData.dragStartY;
        // dData.dragStartX = transform.invertX(mouseX) - dData.offsetX;
        // dData.dragStartY = transform.invertY(mouseY);
        // さらに変更。オフセット分を戻さない
        const dx = (transform.invertX(mouseX)) - dData.dragStartX;
        const dy = (transform.invertY(mouseY)) - dData.dragStartY;
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
            // const mouseCoord = { x: transform.invertX(mouseX), y: transform.invertY(mouseY) };
            // offsetXを考慮
            const mouseCoord = { x: transform.invertX(mouseX) - dData.offsetX, y: transform.invertY(mouseY) };

            const SNAP_THRESHOLD = 15 / transform.k;
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

            // 現在のスナップエッジ情報をグローバル変数に反映
            currentSnapEdge = (dData.snapEdgeA && dData.snapEdgeB) ? { snapEdgeA: dData.snapEdgeA, snapEdgeB: dData.snapEdgeB } : null;

            // 候補で更新した場合の自己交差・重なり判定
            const candidatePolygon = feature.points.slice();
            candidatePolygon[dData.endIndex] = { x: candidate.x, y: candidate.y };
            if (isSelfIntersecting(candidatePolygon)) {
                debugLog(3, 'エッジドラッグ候補で自己交差が発生するため、前の有効候補に戻します。');
                if (dData.lastValidCandidates && dData.lastValidCandidates[dData.endIndex]) {
                    candidate = dData.lastValidCandidates[dData.endIndex];
                } else {
                    candidate = pt;
                }
            } else if (causesOverlap(candidatePolygon, feature.id, feature.layerId)) {
                debugLog(3, 'エッジドラッグ候補で同一レイヤー内の面情報と重なってしまうため、前の有効候補に戻します。');
                if (dData.lastValidCandidates && dData.lastValidCandidates[dData.endIndex]) {
                    candidate = dData.lastValidCandidates[dData.endIndex];
                } else {
                    candidate = pt;
                }
            } else {
                dData.lastValidCandidates[dData.endIndex] = { x: candidate.x, y: candidate.y };
            }

            // pt.x = candidate.x;
            // pt.y = candidate.y;
            // 代わりに
            const { x, y } = candidate;
            const newVertexId = VerticesStore.createOrGetVertex({ x, y });
            feature.vertexIds[dData.endIndex] = newVertexId;
            const newVertex = VerticesStore.getById(newVertexId);
            pt.x = newVertex.x;
            pt.y = newVertex.y;


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

        // ドラッグ終了時はスナップエッジ情報をクリア
        currentSnapEdge = null;

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
            // 新しい頂点の座標を更新
            // const newVertexId = feature.vertexIds[dData.endIndex];
            // if (newVertexId) {
            //     const vertex = VerticesStore.getById(newVertexId);
            //     // vertexは必ず存在する
            //     vertex.x = feature.points[dData.endIndex].x;
            //     vertex.y = feature.points[dData.endIndex].y;
            //     VerticesStore.updateVertex(vertex);
            // }
            // vertexDragEndedと同じ処理なので省略

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
        delete dData.offsetX;
        delete dData._dragged;
        dragOriginalShape = null;
    } catch (error) {
        debugLog(1, `edgeDragEnded() でエラー発生: ${error}`);
    }
}