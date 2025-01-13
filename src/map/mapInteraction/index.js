// src/map/mapInteraction/index.js

import stateManager from '../../state/index.js';
import DataStore from '../../dataStore/index.js';
import uiManager from '../../ui/uiManager.js';
import { debugLog } from '../../utils/logger.js';
import tooltips from '../../ui/tooltips.js';
import UndoRedoManager from '../../utils/undoRedoManager.js';

/**
 * 他ファイルから再インポート
 */
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
 * 地図描画後に一度呼ばれ、コールバックを登録する初期化関数
 * @param {Object} callbacks - { renderData, disableMapZoom, enableMapZoom }
 */
function initInteraction({ renderData, disableMapZoom, enableMapZoom }) {
    debugLog(4, 'initInteraction() が呼び出されました。');
    try {
        // drag.js側に外部コールバックを渡す
        disableInteractionDragState(disableMapZoom);
        enableInteractionDragState(enableMapZoom);

        // コールバックを保持し、ドラッグ完了などで再描画を呼べるようにする
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
        // drag.js の setRenderDataCallback を呼ぶ
        // ファイル間の依存を少なくしたい場合はここでまとめて行う
        enableInteractionDragState(null, renderData);
    } catch (error) {
        debugLog(1, `setRenderDataCallback() でエラー発生: ${error}`);
    }
}

/**
 * モジュール内の主なエクスポート
 */
export {
    initInteraction,
    // ドラッグ系
    vertexDragStarted,
    vertexDragged,
    vertexDragEnded,
    edgeDragStarted,
    edgeDragged,
    edgeDragEnded,
    // 選択系
    updateSelectionForFeature,
    isVertexSelected,
    // 頂点削除など編集系
    removeSelectedVertices
};
