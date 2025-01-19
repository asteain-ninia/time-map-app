// src/map/mapInteraction/index.js
/****************************************************
 * mapInteractionモジュールのエントリポイント
 * - ドラッグ操作、頂点編集、選択などをまとめる
 ****************************************************/

import stateManager from '../../state/index.js';
import DataStore from '../../dataStore/index.js';
import uiManager from '../../ui/uiManager.js';
import { debugLog } from '../../utils/logger.js';
import tooltips from '../../ui/tooltips.js';
import UndoRedoManager from '../../utils/undoRedoManager.js';

import {
    vertexDragStarted,
    vertexDragged,
    vertexDragEnded,
    edgeDragStarted,
    edgeDragged,
    edgeDragEnded,
    disableInteractionDragState,
    enableInteractionDragState
} from './drag.js';

import {
    updateSelectionForFeature,
    isVertexSelected
} from './selection.js';

import {
    removeSelectedVertices
} from './edit.js';

/**
 * 地図描画後に一度呼び出される初期化
 */
function initInteraction({ renderData, disableMapZoom, enableMapZoom }) {
    debugLog(4, 'initInteraction() が呼び出されました。');
    try {
        disableInteractionDragState(disableMapZoom);
        enableInteractionDragState(enableMapZoom);

        // コールバックを保持して、ドラッグ完了などで再描画を呼べるようにする
        setRenderDataCallback(renderData);
    } catch (error) {
        debugLog(1, `initInteraction() でエラー発生: ${error}`);
    }
}

/**
 * drag.js 内で使う変数に renderData をセットするためのラッパ
 */
function setRenderDataCallback(renderData) {
    try {
        enableInteractionDragState(null, renderData);
    } catch (error) {
        debugLog(1, `setRenderDataCallback() でエラー発生: ${error}`);
    }
}

export {
    initInteraction,
    // ドラッグ
    vertexDragStarted,
    vertexDragged,
    vertexDragEnded,
    edgeDragStarted,
    edgeDragged,
    edgeDragEnded,
    // 選択
    updateSelectionForFeature,
    isVertexSelected,
    // 頂点削除
    removeSelectedVertices
};
