// src/map/mapInteraction.js

import stateManager from '../state/index.js';
import DataStore from '../dataStore/index.js';
import tooltips from '../ui/tooltips.js';
import { getPropertiesForYear } from '../utils/index.js';
import { debugLog } from '../utils/logger.js';
import UndoRedoManager from '../utils/undoRedoManager.js';

let renderDataCallback;
let disableMapZoomCallback;
let enableMapZoomCallback;

let dragRenderTimeout = null;
const DRAG_RENDER_DELAY = 50;

/**
 * ドラッグ中に元の形状を保持するための変数
 * - 頂点編集・ポイント移動などでも使う
 */
let dragOriginalShape = null; // { ... } deep copy
let isDraggingFeature = false;

/**
 * mapRenderer.js から渡される初期化用コールバック
 */
function initInteraction({ renderData, disableMapZoom, enableMapZoom }) {
    debugLog(4, 'initInteraction() が呼び出されました。');
    try {
        renderDataCallback = renderData;
        disableMapZoomCallback = disableMapZoom;
        enableMapZoomCallback = enableMapZoom;
    } catch (error) {
        debugLog(1, `initInteraction() でエラー発生: ${error}`);
    }
}

/** 頻繁に呼び出されるドラッグ中再描画をスロットル */
function throttledRenderDuringDrag() {
    try {
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
 * フィーチャの現在のプロパティ（名前・年など）を取得する
 */
function getFeatureTooltipData(feature) {
    debugLog(4, 'getFeatureTooltipData() が呼び出されました。');
    try {
        const st = stateManager.getState();
        const currentYear = st.currentYear || 0;

        if (feature.originalPolygon && feature.originalPolygon.properties) {
            const props = getPropertiesForYear(feature.originalPolygon.properties, currentYear);
            if (props) {
                return {
                    name: props.name || 'Undefined',
                    year: props.year !== undefined ? props.year : '不明'
                };
            }
        }
        if (feature.originalLine && feature.originalLine.properties) {
            const props = getPropertiesForYear(feature.originalLine.properties, currentYear);
            if (props) {
                return {
                    name: props.name || 'Undefined',
                    year: props.year !== undefined ? props.year : '不明'
                };
            }
        }
        if (feature.properties && Array.isArray(feature.properties)) {
            const props = getPropertiesForYear(feature.properties, currentYear);
            if (props) {
                return {
                    name: props.name || 'Undefined',
                    year: props.year !== undefined ? props.year : '不明'
                };
            }
        }
        return {
            name: feature.name || 'Undefined',
            year: '不明'
        };
    } catch (error) {
        debugLog(1, `getFeatureTooltipData() でエラー発生: ${error}`);
        return { name: 'Undefined', year: '不明' };
    }
}

/**
 * 同一フィーチャに対して複数頂点をShift+クリックで選択／解除可能
 */
function updateSelectionForFeature(feature, vertexIndex, shiftKey) {
    debugLog(4, `updateSelectionForFeature() が呼び出されました。feature.id=${feature?.id}, vertexIndex=${vertexIndex}, shiftKey=${shiftKey}`);
    try {
        const state = stateManager.getState();
        const selectedVertices = state.selectedVertices || [];
        let newSelectedFeature = state.selectedFeature || null;

        if (!feature.id) {
            feature.id = Date.now() + Math.random();
        }

        // まだフィーチャが選択されていない
        if (!newSelectedFeature) {
            newSelectedFeature = feature;
            stateManager.setState({
                selectedFeature: newSelectedFeature,
                selectedVertices: vertexIndex !== undefined ? [{ featureId: feature.id, vertexIndex }] : []
            });
            renderDataCallback();
            return;
        }

        // 別フィーチャをクリック
        if (newSelectedFeature.id !== feature.id) {
            newSelectedFeature = feature;
            const newVertices = vertexIndex !== undefined ? [{ featureId: feature.id, vertexIndex }] : [];
            stateManager.setState({
                selectedFeature: newSelectedFeature,
                selectedVertices: newVertices
            });
            renderDataCallback();
            return;
        }

        // 同じフィーチャ
        if (vertexIndex === undefined) {
            // フィーチャ全体クリック → 頂点選択だけ解除
            stateManager.setState({
                selectedFeature: newSelectedFeature,
                selectedVertices: []
            });
            renderDataCallback();
            return;
        }

        // 頂点クリック
        const exists = selectedVertices.some(v => v.featureId === feature.id && v.vertexIndex === vertexIndex);
        let newSelection;

        if (shiftKey) {
            // シフト押下 → トグル
            if (exists) {
                newSelection = selectedVertices.filter(v => !(v.featureId === feature.id && v.vertexIndex === vertexIndex));
            } else {
                newSelection = [...selectedVertices, { featureId: feature.id, vertexIndex }];
            }
        } else {
            newSelection = [{ featureId: feature.id, vertexIndex }];
        }

        stateManager.setState({
            selectedFeature: newSelectedFeature,
            selectedVertices: newSelection
        });
        renderDataCallback();
    } catch (error) {
        debugLog(1, `updateSelectionForFeature() でエラー発生: ${error}`);
    }
}

function isVertexSelected(feature, vertexIndex) {
    debugLog(4, `isVertexSelected() が呼び出されました。feature.id=${feature?.id}, vertexIndex=${vertexIndex}`);
    try {
        const state = stateManager.getState();
        const selectedVertices = state.selectedVertices || [];
        return selectedVertices.some(v => v.featureId === feature.id && v.vertexIndex === vertexIndex);
    } catch (error) {
        debugLog(1, `isVertexSelected() でエラー発生: ${error}`);
        return false;
    }
}

/**
 * 頂点ドラッグ開始
 */
function vertexDragStarted(event, dData, offsetX, feature) {
    debugLog(4, `vertexDragStarted() が呼び出されました。feature.id=${feature?.id}, offsetX=${offsetX}`);
    try {
        if (event.sourceEvent) event.sourceEvent.stopPropagation();
        stateManager.setState({ isDragging: true });

        d3.select(event.sourceEvent.target).raise().classed('active', true);
        disableMapZoomCallback();

        tooltips.hideTooltip();

        dData._dragged = false;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);

        const shiftPressed = event.sourceEvent && event.sourceEvent.shiftKey;

        // 頂点選択状態の更新
        const isCurrentlySelected = isVertexSelected(feature, dData.index);
        if (!isCurrentlySelected || shiftPressed) {
            updateSelectionForFeature(feature, dData.index, shiftPressed);
        }

        // ★ ドラッグ開始時点の形状をdeep copyして保持
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
function vertexDragged(event, dData) {
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

        // 選択頂点をすべて動かす
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

        // ドラッグ中は shouldRecord=false で「中間更新」
        if (state.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(selectedFeature, false);
        } else if (state.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(selectedFeature, false);
        } else if (state.currentTool === 'pointMove') {
            // 単頂点の場合
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
function vertexDragEnded(event, dData, feature) {
    debugLog(4, `vertexDragEnded() が呼び出されました。feature.id=${feature?.id}`);
    try {
        stateManager.setState({ isDragging: false });
        d3.select(event.sourceEvent.target).classed('active', false);
        enableMapZoomCallback();

        if (!isDraggingFeature) {
            // そもそも開始してなければ何もしない
            return;
        }
        isDraggingFeature = false;

        if (event.sourceEvent) {
            const tooltipData = getFeatureTooltipData(feature);
            tooltips.showTooltip(event.sourceEvent, tooltipData);
            tooltips.moveTooltip(event.sourceEvent);
        }

        // ドラッグが完了したので、最終的に store を update したうえで
        // UndoRedoManager に「一度だけ」アクションを積む
        const st = stateManager.getState();
        if (dData._dragged) {
            if (st.currentTool === 'lineVertexEdit') {
                DataStore.updateLine(feature, false);
                // record
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

        renderDataCallback();

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
 * 修正ポイント: 頂点追加前の状態を dragOriginalShape に保存し、
 * Undo の際に頂点追加自体を取り消せるようにする。
 */
function edgeDragStarted(event, dData, offsetX, feature) {
    debugLog(4, `edgeDragStarted() が呼び出されました。feature.id=${feature?.id}, offsetX=${offsetX}`);
    try {
        if (event.sourceEvent) event.sourceEvent.stopPropagation();
        stateManager.setState({ isDragging: true });
        d3.select(event.sourceEvent.target).raise().classed('active', true);
        disableMapZoomCallback();

        tooltips.hideTooltip();

        dData._dragged = false;

        const transform = d3.zoomTransform(d3.select('#map svg').node());
        const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
        dData.dragStartX = transform.invertX(mouseX);
        dData.dragStartY = transform.invertY(mouseY);

        // 頂点追加前の状態を保存する
        dragOriginalShape = JSON.parse(JSON.stringify(feature));

        // 新頂点を挿入
        const newX = dData.dragStartX;
        const newY = dData.dragStartY;
        feature.points.splice(dData.endIndex, 0, { x: newX, y: newY });

        if (!feature.id) {
            feature.id = Date.now() + Math.random();
        }

        isDraggingFeature = true;

        // ここでいったん更新（recordはしない）
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
function edgeDragged(event, dData) {
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

        const state = stateManager.getState();
        const feature = state.selectedFeature;
        if (!feature) return;

        // 追加した頂点 (endIndex) を動かす
        feature.points[dData.endIndex].x += dx;
        feature.points[dData.endIndex].y += dy;

        dData.dragStartX = transformedMouseX;
        dData.dragStartY = transformedMouseY;

        if (state.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(feature, false);
        } else if (state.currentTool === 'polygonVertexEdit') {
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
function edgeDragEnded(event, dData, feature) {
    debugLog(4, `edgeDragEnded() が呼び出されました。feature.id=${feature?.id}`);
    try {
        stateManager.setState({ isDragging: false });
        d3.select(event.sourceEvent.target).classed('active', false);
        enableMapZoomCallback();

        if (!isDraggingFeature) {
            return;
        }
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

        renderDataCallback();

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

/**
 * 選択頂点を削除
 * - Undo/Redo対応: ここでは「都度 DataStore.removeX or updateX」をshouldRecord=falseで呼び出し
 * - 最後に "removeSelectedVertices" 全体で UndoRedoManager にアクション1回分を積む手法も可
 */
function removeSelectedVertices() {
    debugLog(4, 'removeSelectedVertices() が呼び出されました。');
    try {
        const st = stateManager.getState();
        const { selectedFeature, selectedVertices } = st;
        if (!selectedFeature) return;

        // ★ 削除前の形状をコピー
        const beforeObj = JSON.parse(JSON.stringify(selectedFeature));

        // (A) 単頂点のPointなら removePoint
        if (selectedFeature.points && selectedFeature.points.length === 1 && st.currentTool === 'pointMove') {
            DataStore.removePoint(selectedFeature.id, false);
            stateManager.setState({ selectedFeature: null, selectedVertices: [] });
            renderDataCallback();
            // Undo記録
            const action = UndoRedoManager.makeAction('removePoint', beforeObj, null);
            UndoRedoManager.record(action);
            return;
        }

        // (B) ライン/ポリゴン頂点削除
        if (!selectedVertices || selectedVertices.length === 0) {
            return;
        }
        if (!selectedFeature.id) {
            selectedFeature.id = Date.now() + Math.random();
        }

        // 削除
        const sortedIndices = selectedVertices.map(v => v.vertexIndex).sort((a, b) => b - a);
        sortedIndices.forEach(idx => {
            if (selectedFeature.points && selectedFeature.points.length > idx) {
                selectedFeature.points.splice(idx, 1);
            }
        });

        if (!selectedFeature.points || selectedFeature.points.length === 0) {
            // 0頂点なら、ライン/ポリゴンごと削除
            if (st.currentTool === 'lineVertexEdit') {
                DataStore.removeLine(selectedFeature.id, false);
            } else if (st.currentTool === 'polygonVertexEdit') {
                DataStore.removePolygon(selectedFeature.id, false);
            }
            stateManager.setState({ selectedFeature: null, selectedVertices: [] });
        } else {
            // 頂点が残ったので更新
            if (st.currentTool === 'lineVertexEdit') {
                DataStore.updateLine(selectedFeature, false);
            } else if (st.currentTool === 'polygonVertexEdit') {
                DataStore.updatePolygon(selectedFeature, false);
            }
            stateManager.setState({ selectedVertices: [] });
        }

        renderDataCallback();

        // Undo記録
        // "beforeObj" -> "selectedFeature" (削除後)
        // もし頂点が0個になりオブジェクト自体削除されたなら "after" はnull
        const stillExists = (st.currentTool === 'lineVertexEdit')
            ? DataStore.getLines(st.currentYear).find(l => l.id === beforeObj.id)
            : DataStore.getPolygons(st.currentYear).find(pg => pg.id === beforeObj.id);
        const afterObj = stillExists ? JSON.parse(JSON.stringify(selectedFeature)) : null;

        const actionType = (st.currentTool === 'lineVertexEdit') ? 'updateLine' : 'updatePolygon';
        const action = UndoRedoManager.makeAction(actionType, beforeObj, afterObj);
        UndoRedoManager.record(action);

    } catch (error) {
        debugLog(1, `removeSelectedVertices() でエラー発生: ${error}`);
    }
}

export {
    initInteraction,
    updateSelectionForFeature,
    isVertexSelected,
    vertexDragStarted,
    vertexDragged,
    vertexDragEnded,
    edgeDragStarted,
    edgeDragged,
    edgeDragEnded,
    removeSelectedVertices
};
