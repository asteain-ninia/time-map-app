// src/utils/undoRedoManager.js

import DataStore from '../dataStore/index.js';
import { debugLog } from './logger.js';
import uiManager from '../ui/uiManager.js';

/**
 * アクションの形式:
 * {
 *   type: 'addPoint' | 'updatePoint' | 'removePoint' | 'addLine' | 'updateLine' | 'removeLine' | 'addPolygon' | 'updatePolygon' | 'removePolygon',
 *   before: object or null,   // 更新/削除の前のオブジェクト(深いコピー)
 *   after:  object or null,   // 更新/追加の後のオブジェクト(深いコピー)
 * }
 *
 * 例:
 *  - addPoint:   { type:'addPoint', before:null, after: {...} }
 *  - updateLine: { type:'updateLine', before:{...}, after:{...} }
 *  - removePolygon: { type:'removePolygon', before:{...}, after:null }
 */

const undoStack = [];
const redoStack = [];

/**
 * オブジェクトのディープコピー関数
 * JSON.parse(JSON.stringify(...)) で最低限の深いコピーを実現
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

const UndoRedoManager = {

    /**
     * 新しいアクションを登録
     * - 登録と同時にredoStackはクリアする (新しい操作が割り込むと古いRedoは無効になる)
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
     * - redoStack にアクションを積む (Redoで呼び戻せるように)
     */
    undo() {
        debugLog(4, 'UndoRedoManager.undo() called');
        if (undoStack.length === 0) {
            debugLog(3, 'No action to undo.');
            uiManager.showNotification('元に戻す操作がありません。', 'warning');
            return;
        }

        const action = undoStack.pop();
        // アクションに応じて逆操作を行う
        switch (action.type) {
            case 'addPoint':
                // "追加"を取り消す => removePoint
                if (action.after) {
                    DataStore.removePoint(action.after.id, false); // shouldRecord=false
                }
                break;
            case 'removePoint':
                // "削除"を取り消す => addPoint
                if (action.before) {
                    DataStore.addPoint(action.before, false);
                }
                break;
            case 'updatePoint':
                // "更新"を取り消す => 元の状態に戻す
                if (action.before) {
                    DataStore.updatePoint(action.before, false);
                }
                break;

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
            default:
                debugLog(3, `Unknown action type: ${action.type}`);
                break;
        }

        // 逆操作をredo用に積む
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

        // アクションを再実行
        switch (action.type) {
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
            default:
                debugLog(3, `Unknown action type: ${action.type}`);
                break;
        }

        // 再実行したアクションはundoStackに戻す
        undoStack.push(action);
    },

    /**
     * 新規にadd/update/removeが行われる前に
     * undo用アクションを作成するヘルパー
     */
    makeAction(type, beforeObj, afterObj) {
        return {
            type: type,
            before: beforeObj ? deepClone(beforeObj) : null,
            after: afterObj ? deepClone(afterObj) : null
        };
    }
};

export default UndoRedoManager;
