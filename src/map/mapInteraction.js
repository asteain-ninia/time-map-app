// src/map/mapInteraction.js

import stateManager from '../state/index.js';
import DataStore from '../dataStore/index.js';
import tooltips from '../ui/tooltips.js';
import { getPropertiesForYear } from '../utils/index.js';

let renderDataCallback;
let disableMapZoomCallback;
let enableMapZoomCallback;

let dragRenderTimeout = null;
const DRAG_RENDER_DELAY = 50;

let dragStartPositions = [];
let draggingVertexData = null;

/**
 * mapRenderer.js から渡される初期化用コールバック
 */
function initInteraction({ renderData, disableMapZoom, enableMapZoom }) {
    renderDataCallback = renderData;
    disableMapZoomCallback = disableMapZoom;
    enableMapZoomCallback = enableMapZoom;
}

/** 頻繁に呼び出されるドラッグ中再描画をスロットル */
function throttledRenderDuringDrag() {
    if (!dragRenderTimeout) {
        dragRenderTimeout = setTimeout(() => {
            renderDataCallback();
            dragRenderTimeout = null;
        }, DRAG_RENDER_DELAY);
    }
}

/**
 * フィーチャの現在のプロパティ（名前・年など）を取得する
 * - originalPolygon / originalLine があればそちらから読み取る
 * - なければ feature自身のpropertiesをチェック
 */
function getFeatureTooltipData(feature) {
    const st = stateManager.getState();
    const currentYear = st.currentYear || 0;

    // 1) originalPolygon
    if (feature.originalPolygon && feature.originalPolygon.properties) {
        const props = getPropertiesForYear(feature.originalPolygon.properties, currentYear);
        if (props) {
            return {
                name: props.name || 'Undefined',
                year: props.year !== undefined ? props.year : '不明'
            };
        }
    }
    // 2) originalLine
    if (feature.originalLine && feature.originalLine.properties) {
        const props = getPropertiesForYear(feature.originalLine.properties, currentYear);
        if (props) {
            return {
                name: props.name || 'Undefined',
                year: props.year !== undefined ? props.year : '不明'
            };
        }
    }
    // 3) feature.properties
    if (feature.properties && Array.isArray(feature.properties)) {
        const props = getPropertiesForYear(feature.properties, currentYear);
        if (props) {
            return {
                name: props.name || 'Undefined',
                year: props.year !== undefined ? props.year : '不明'
            };
        }
    }
    // 4) fallback
    return {
        name: feature.name || 'Undefined',
        year: '不明'
    };
}

/**
 * 同一フィーチャに対して複数頂点をShift+クリックで選択／解除可能にし、
 * フィーチャ自体は選択状態を残したままにする。
 */
function updateSelectionForFeature(feature, vertexIndex, shiftKey) {
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

    // 同じフィーチャをクリック
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
        // シフトなし → この頂点のみ単独選択
        newSelection = [{ featureId: feature.id, vertexIndex }];
    }

    stateManager.setState({
        selectedFeature: newSelectedFeature,
        selectedVertices: newSelection
    });
    renderDataCallback();
}

/**
 * 頂点が選択されているかどうか
 */
function isVertexSelected(feature, vertexIndex) {
    const state = stateManager.getState();
    const selectedVertices = state.selectedVertices || [];
    return selectedVertices.some(v => v.featureId === feature.id && v.vertexIndex === vertexIndex);
}

/**
 * 頂点ドラッグ開始
 */
function vertexDragStarted(event, dData, offsetX, feature) {
    if (event.sourceEvent) event.sourceEvent.stopPropagation();
    stateManager.setState({ isDragging: true });

    d3.select(event.sourceEvent.target).raise().classed('active', true);
    disableMapZoomCallback();

    // ★ UI.hideTooltip(); → tooltips.hideTooltip();
    tooltips.hideTooltip();

    dData._dragged = false;

    const transform = d3.zoomTransform(d3.select('#map svg').node());
    const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
    dData.dragStartX = transform.invertX(mouseX);
    dData.dragStartY = transform.invertY(mouseY);

    const shiftPressed = event.sourceEvent && event.sourceEvent.shiftKey;

    // もしこの頂点が未選択であれば、シフトキーの有無に応じてトグル選択
    const isCurrentlySelected = isVertexSelected(feature, dData.index);
    if (!isCurrentlySelected || shiftPressed) {
        updateSelectionForFeature(feature, dData.index, shiftPressed);
    }

    // ドラッグ対象 = 選択中の頂点すべて
    const st = stateManager.getState();
    const { selectedVertices } = st;

    let allSelectedPositions = selectedVertices
        .filter(v => v.featureId === feature.id)
        .map(v => ({
            featureId: feature.id,
            vertexIndex: v.vertexIndex,
            startX: feature.points[v.vertexIndex].x,
            startY: feature.points[v.vertexIndex].y
        }));

    if (allSelectedPositions.length === 0) {
        allSelectedPositions = [{
            featureId: feature.id,
            vertexIndex: dData.index,
            startX: feature.points[dData.index].x,
            startY: feature.points[dData.index].y
        }];
    }

    dragStartPositions = allSelectedPositions;
    draggingVertexData = { feature, offsetX };

    if (dragRenderTimeout) {
        clearTimeout(dragRenderTimeout);
        dragRenderTimeout = null;
    }
}

/**
 * 頂点ドラッグ中
 */
function vertexDragged(event, dData) {
    dData._dragged = true;
    if (!draggingVertexData || dragStartPositions.length === 0) return;

    const transform = d3.zoomTransform(d3.select('#map svg').node());
    const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
    const transformedMouseX = transform.invertX(mouseX);
    const transformedMouseY = transform.invertY(mouseY);

    const dx = transformedMouseX - dData.dragStartX;
    const dy = transformedMouseY - dData.dragStartY;

    const { feature } = draggingVertexData;
    for (const pos of dragStartPositions) {
        feature.points[pos.vertexIndex].x = pos.startX + dx;
        feature.points[pos.vertexIndex].y = pos.startY + dy;
    }

    throttledRenderDuringDrag();
}

/**
 * 頂点ドラッグ終了
 */
function vertexDragEnded(event, dData, feature) {
    stateManager.setState({ isDragging: false });
    d3.select(event.sourceEvent.target).classed('active', false);
    enableMapZoomCallback();

    if (event.sourceEvent) {
        // ドラッグ終了時 → ライン/ポリゴン等の情報をツールチップ表示
        const tooltipData = getFeatureTooltipData(feature);
        // ★ UI.showTooltip(event.sourceEvent, tooltipData);
        tooltips.showTooltip(event.sourceEvent, tooltipData);
        // ★ UI.moveTooltip(event.sourceEvent);
        tooltips.moveTooltip(event.sourceEvent);
    }

    if (dData._dragged) {
        const st = stateManager.getState();
        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(feature);
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(feature);
        } else if (st.currentTool === 'pointMove' && feature.points.length === 1) {
            DataStore.updatePoint(feature);
        }
    }

    renderDataCallback();

    dragStartPositions = [];
    draggingVertexData = null;
    if (dragRenderTimeout) {
        clearTimeout(dragRenderTimeout);
        dragRenderTimeout = null;
    }
    delete dData.dragStartX;
    delete dData.dragStartY;
    delete dData._dragged;
}

/**
 * エッジドラッグ開始 (新頂点挿入)
 */
function edgeDragStarted(event, dData, offsetX, feature) {
    if (event.sourceEvent) event.sourceEvent.stopPropagation();
    stateManager.setState({ isDragging: true });
    d3.select(event.sourceEvent.target).raise().classed('active', true);
    disableMapZoomCallback();

    // ★ UI.hideTooltip();
    tooltips.hideTooltip();

    dData._dragged = false;

    const transform = d3.zoomTransform(d3.select('#map svg').node());
    const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
    dData.dragStartX = transform.invertX(mouseX);
    dData.dragStartY = transform.invertY(mouseY);

    // エッジ上に新頂点を追加
    const newX = dData.dragStartX;
    const newY = dData.dragStartY;
    feature.points.splice(dData.endIndex, 0, { x: newX, y: newY });

    if (!feature.id) {
        feature.id = Date.now() + Math.random();
    }

    const st = stateManager.getState();
    if (st.currentTool === 'lineVertexEdit') {
        feature.type = 'line';
        DataStore.updateLine(feature);
    } else if (st.currentTool === 'polygonVertexEdit') {
        feature.type = 'polygon';
        DataStore.updatePolygon(feature);
    }

    dData._dragged = true;
    draggingVertexData = { feature, offsetX };

    dragStartPositions = [{
        featureId: feature.id,
        vertexIndex: dData.endIndex,
        startX: newX,
        startY: newY
    }];

    stateManager.setState({ selectedFeature: feature });
    renderDataCallback();

    if (dragRenderTimeout) {
        clearTimeout(dragRenderTimeout);
        dragRenderTimeout = null;
    }
}

/**
 * エッジドラッグ中
 */
function edgeDragged(event, dData) {
    if (!draggingVertexData || dragStartPositions.length === 0) return;
    dData._dragged = true;

    const transform = d3.zoomTransform(d3.select('#map svg').node());
    const [mouseX, mouseY] = d3.pointer(event, d3.select('#map svg').node());
    const transformedMouseX = transform.invertX(mouseX);
    const transformedMouseY = transform.invertY(mouseY);

    const dx = transformedMouseX - dData.dragStartX;
    const dy = transformedMouseY - dData.dragStartY;

    const { feature } = draggingVertexData;
    for (const pos of dragStartPositions) {
        feature.points[pos.vertexIndex].x = pos.startX + dx;
        feature.points[pos.vertexIndex].y = pos.startY + dy;
    }

    throttledRenderDuringDrag();
}

/**
 * エッジドラッグ終了
 */
function edgeDragEnded(event, dData, feature) {
    stateManager.setState({ isDragging: false });
    d3.select(event.sourceEvent.target).classed('active', false);
    enableMapZoomCallback();

    if (event.sourceEvent) {
        // ドラッグ終了 → ライン/ポリゴンの情報ツールチップ
        const tooltipData = getFeatureTooltipData(feature);
        // ★ UI.showTooltip(event.sourceEvent, tooltipData);
        tooltips.showTooltip(event.sourceEvent, tooltipData);
        // ★ UI.moveTooltip(event.sourceEvent);
        tooltips.moveTooltip(event.sourceEvent);
    }

    const st = stateManager.getState();
    if (st.currentTool === 'lineVertexEdit') {
        DataStore.updateLine(feature);
    } else if (st.currentTool === 'polygonVertexEdit') {
        DataStore.updatePolygon(feature);
    }

    renderDataCallback();

    dragStartPositions = [];
    draggingVertexData = null;
    if (dragRenderTimeout) {
        clearTimeout(dragRenderTimeout);
        dragRenderTimeout = null;
    }
    delete dData.dragStartX;
    delete dData.dragStartY;
    delete dData._dragged;
}

/**
 * 選択頂点(複数含む)を削除する
 * - 0頂点になったら削除
 * - 1頂点が残ってもライン/ポリゴンを維持
 * - ポイント(単頂点)の場合は削除
 */
function removeSelectedVertices() {
    const st = stateManager.getState();
    const { selectedFeature, selectedVertices } = st;

    if (!selectedFeature) return;

    // (A) ポイント(単頂点)を削除
    if (selectedFeature.points && selectedFeature.points.length === 1) {
        // 単頂点 → これがポイント扱い
        DataStore.removePoint(selectedFeature.id);
        stateManager.setState({ selectedFeature: null, selectedVertices: [] });
        renderDataCallback();
        return;
    }

    // (B) ライン/ポリゴン
    if (!selectedVertices || selectedVertices.length === 0) {
        // 頂点が選択されていない → 何もしない
        return;
    }

    if (!selectedFeature.id) {
        selectedFeature.id = Date.now() + Math.random();
    }

    // 選択頂点を消す
    const sortedIndices = selectedVertices.map(v => v.vertexIndex).sort((a, b) => b - a);
    sortedIndices.forEach(idx => {
        if (selectedFeature.points && selectedFeature.points.length > idx) {
            selectedFeature.points.splice(idx, 1);
        }
    });

    // 頂点数が0になったら削除
    if (!selectedFeature.points || selectedFeature.points.length === 0) {
        if (st.currentTool === 'lineVertexEdit') {
            DataStore.removeLine(selectedFeature.id);
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.removePolygon(selectedFeature.id);
        }
        stateManager.setState({ selectedFeature: null, selectedVertices: [] });
    } else {
        // 1以上残れば維持
        if (st.currentTool === 'lineVertexEdit') {
            DataStore.updateLine(selectedFeature);
        } else if (st.currentTool === 'polygonVertexEdit') {
            DataStore.updatePolygon(selectedFeature);
        }
        stateManager.setState({ selectedVertices: [] });
    }

    renderDataCallback();
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
