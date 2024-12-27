// src/state/stateManager.js

import { defaultState } from './defaultState.js';
import { debugLog } from '../utils/logger.js';

/**
 * 実際にアプリが動作中に参照する状態オブジェクト
 * - defaultState のコピーを生成し、以降の更新を保存
 */
const state = { ...defaultState };

/**
 * 状態変更を検知するためのリスナー配列
 */
const listeners = [];

/**
 * 現在の状態をコピーして返す
 * @returns {Object} state のコピー
 */
function getState() {
    aa
    try {
        return { ...state };
    } catch (error) {
        debugLog(1, `getState() でエラー発生: ${error}`);
        return { ...state }; // とりあえず現状の state を返す
    }
}

/**
 * 状態を更新し、すべてのリスナーに通知する
 * @param {Object} updates - 更新内容
 */
function setState(updates) {
    debugLog(4, 'setState() が呼び出されました。updates=', updates);
    try {
        // currentTool が変わったら selectedFeature をリセット
        if (updates.currentTool && updates.currentTool !== state.currentTool) {
            updates.selectedFeature = null;
        }

        // stateにマージ
        Object.assign(state, updates);

        // リスナーに通知
        listeners.forEach(listener => {
            try {
                listener(getState());
            } catch (listenerError) {
                debugLog(1, `stateManager の listener 実行中にエラー発生: ${listenerError}`);
            }
        });

    } catch (error) {
        debugLog(1, `setState() でエラー発生: ${error}`);
    }
}

/**
 * 状態変更を購読する
 * @param {Function} listener - (newState) => {...}
 * @returns {Function} 解除用の関数
 */
function subscribe(listener) {
    debugLog(4, 'subscribe() が呼び出されました。');
    try {
        listeners.push(listener);
        // 解除用の関数を返す
        return () => {
            try {
                const index = listeners.indexOf(listener);
                if (index > -1) {
                    listeners.splice(index, 1);
                }
            } catch (error) {
                debugLog(1, `subscribe() 解除時にエラー発生: ${error}`);
            }
        };
    } catch (error) {
        debugLog(1, `subscribe() でエラー発生: ${error}`);
        // エラー時には解除関数だけ返す（何もしない）
        return () => { };
    }
}

export {
    getState,
    setState,
    subscribe,
};
