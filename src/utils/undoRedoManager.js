// src/utils/undoRedoManager.js

import DataStore from '../dataStore/index.js';
import { debugLog } from './logger.js';
import uiManager from '../ui/uiManager.js';
import stateManager from '../state/index.js';

/**
 * アクションの形式:
 * {
 *   type: 'addPoint' | 'updatePoint' | 'removePoint' | 'addLine' | 'updateLine' | 'removeLine'
 *          | 'addPolygon' | 'updatePolygon' | 'removePolygon'
 *          | 'tempPointSet' | 'tempLineAddVertex' | 'tempPolygonAddVertex'
 *          | 'addVertexToLine' | 'addVertexToPolygon'
 *   before: object or null,
 *   after:  object or null
 * }
 *
 * 例:
 *  - addPoint:   { type:'addPoint', before:null, after: {...} }
 *  - removeLine: { type:'removeLine', before:{...}, after:null }
 *  - addVertexToPolygon: { type:'addVertexToPolygon', before:{...}, after:{...} }
 */

const undoStack = [];
const redoStack = [];

/**
 * オブジェクトのディープコピー関数
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

const UndoRedoManager = {

    /**
     * 新しいアクションを登録し、redoStackをクリア
     * @param {Object} action
     */
    record(action) {
        debugLog(4, `UndoRedoManager.record(): type=${action.type}`);
        undoStack.push(action);
        redoStack.length = 0; // クリア
    },

    /**
     * Undo操作
     * - undoStack から最後のアクションを取り出し、逆操作を行う
     * - redoStack にアクションを積む
     */
    undo() {
        debugLog(4, 'UndoRedoManager.undo() called');
        if (undoStack.length === 0) {
            debugLog(3, 'No action to undo.');
            uiManager.showNotification('元に戻す操作がありません。', 'warning');
            return;
        }

        const action = undoStack.pop();
        this._revertAction(action);
        redoStack.push(action);
    },

    /**
     * Redo操作
     * - redoStack から最後のアクションを取り出し、再度同じ操作を行う
     * - そのアクションを undoStack に戻す
     */
    redo() {
        debugLog(4, 'UndoRedoManager.redo() called');
        if (redoStack.length === 0) {
            debugLog(3, 'No action to redo.');
            uiManager.showNotification('やり直す操作がありません。', 'warning');
            return;
        }

        const action = redoStack.pop();
        this._applyAction(action);
        undoStack.push(action);
    },

    /**
     * 新規にadd/update/removeなどが行われる前に
     * undo用アクションを作成するヘルパー
     */
    makeAction(type, beforeObj, afterObj) {
        return {
            type,
            before: beforeObj ? deepClone(beforeObj) : null,
            after: afterObj ? deepClone(afterObj) : null
        };
    },

    /**
     * Undo用の逆操作
     */
    _revertAction(action) {
        debugLog(4, `UndoRedoManager._revertAction(): type=${action.type}`);
        switch (action.type) {
            // Point
            case 'addPoint':
                if (action.after) {
                    DataStore.removePoint(action.after.id, false);
                }
                break;
            case 'removePoint':
                if (action.before) {
                    DataStore.addPoint(action.before, false);
                }
                break;
            case 'updatePoint':
                if (action.before) {
                    DataStore.updatePoint(action.before, false);
                }
                break;

            // Line
            case 'addLine':
                if (action.after) {
                    DataStore.removeLine(action.after.id, false);
                }
                break;
            case 'removeLine':
                if (action.before) {
                    DataStore.addLine(action.before, false);
                }
                break;
            case 'updateLine':
                if (action.before) {
                    DataStore.updateLine(action.before, false);
                }
                break;

            // Polygon
            case 'addPolygon':
                if (action.after) {
                    DataStore.removePolygon(action.after.id, false);
                }
                break;
            case 'removePolygon':
                if (action.before) {
                    DataStore.addPolygon(action.before, false);
                }
                break;
            case 'updatePolygon':
                if (action.before) {
                    DataStore.updatePolygon(action.before, false);
                }
                break;

            // temp
            case 'tempPointSet':
                if (action.before) {
                    stateManager.setState({ tempPoint: action.before.tempPoint || null });
                } else {
                    stateManager.setState({ tempPoint: null });
                }
                break;
            case 'tempLineAddVertex':
                if (action.before) {
                    stateManager.setState({ tempLinePoints: action.before.tempLinePoints || [] });
                } else {
                    stateManager.setState({ tempLinePoints: [] });
                }
                break;
            case 'tempPolygonAddVertex':
                if (action.before) {
                    stateManager.setState({ tempPolygonPoints: action.before.tempPolygonPoints || [] });
                } else {
                    stateManager.setState({ tempPolygonPoints: [] });
                }
                break;

            // 編集モードで頂点を追加
            case 'addVertexToLine':
                if (action.before) {
                    DataStore.updateLine(action.before, false);
                }
                break;
            case 'addVertexToPolygon':
                if (action.before) {
                    DataStore.updatePolygon(action.before, false);
                }
                break;

            default:
                debugLog(3, `Unknown action type: ${action.type}`);
                break;
        }
    },

    /**
     * Redo用の再適用
     */
    _applyAction(action) {
        debugLog(4, `UndoRedoManager._applyAction(): type=${action.type}`);
        switch (action.type) {
            // Point
            case 'addPoint':
                if (action.after) {
                    DataStore.addPoint(action.after, false);
                }
                break;
            case 'removePoint':
                if (action.before) {
                    DataStore.removePoint(action.before.id, false);
                }
                break;
            case 'updatePoint':
                if (action.after) {
                    DataStore.updatePoint(action.after, false);
                }
                break;

            // Line
            case 'addLine':
                if (action.after) {
                    DataStore.addLine(action.after, false);
                }
                break;
            case 'removeLine':
                if (action.before) {
                    DataStore.removeLine(action.before.id, false);
                }
                break;
            case 'updateLine':
                if (action.after) {
                    DataStore.updateLine(action.after, false);
                }
                break;

            // Polygon
            case 'addPolygon':
                if (action.after) {
                    DataStore.addPolygon(action.after, false);
                }
                break;
            case 'removePolygon':
                if (action.before) {
                    DataStore.removePolygon(action.before.id, false);
                }
                break;
            case 'updatePolygon':
                if (action.after) {
                    DataStore.updatePolygon(action.after, false);
                }
                break;

            // temp
            case 'tempPointSet':
                if (action.after) {
                    stateManager.setState({ tempPoint: action.after.tempPoint || null });
                } else {
                    stateManager.setState({ tempPoint: null });
                }
                break;
            case 'tempLineAddVertex':
                if (action.after) {
                    stateManager.setState({ tempLinePoints: action.after.tempLinePoints || [] });
                } else {
                    stateManager.setState({ tempLinePoints: [] });
                }
                break;
            case 'tempPolygonAddVertex':
                if (action.after) {
                    stateManager.setState({ tempPolygonPoints: action.after.tempPolygonPoints || [] });
                } else {
                    stateManager.setState({ tempPolygonPoints: [] });
                }
                break;

            // 編集モード頂点追加
            case 'addVertexToLine':
                if (action.after) {
                    DataStore.updateLine(action.after, false);
                }
                break;
            case 'addVertexToPolygon':
                if (action.after) {
                    DataStore.updatePolygon(action.after, false);
                }
                break;

            default:
                debugLog(3, `Unknown action type: ${action.type}`);
                break;
        }
    },
};

export default UndoRedoManager;
