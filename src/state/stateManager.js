// src/state/stateManager.js

import { defaultState } from './defaultState.js';

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
    return { ...state };
}

/**
 * 状態を更新し、すべてのリスナーに通知する
 * @param {Object} updates - 更新内容
 */
function setState(updates) {
    // currentTool が変わったら selectedFeature をリセット
    if (updates.currentTool && updates.currentTool !== state.currentTool) {
        updates.selectedFeature = null;
    }

    // stateにマージ
    Object.assign(state, updates);

    // リスナーに通知
    listeners.forEach(listener => listener(getState()));
}

/**
 * 状態変更を購読する
 * @param {Function} listener - (newState) => {...}
 * @returns {Function} 解除用の関数
 */
function subscribe(listener) {
    listeners.push(listener);
    // 解除用の関数を返す
    return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    };
}

export {
    getState,
    setState,
    subscribe,
};
