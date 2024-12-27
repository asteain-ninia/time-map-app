// src/state/index.js

/**
 * stateManager.js で定義した getState, setState, subscribe を
 * デフォルトエクスポートとしてまとめる
 */

import * as manager from './stateManager.js';

export default {
    getState: manager.getState,
    setState: manager.setState,
    subscribe: manager.subscribe,
};
