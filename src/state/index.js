// src/state/index.js

/**
 * stateManager.js で定義した getState, setState, subscribe を
 * デフォルトエクスポートとしてまとめる
 * 
 * - 他ファイルからは従来どおり
 *   import stateManager from 'src/state';
 *   stateManager.getState() ...
 *   のように使える。
 */

import * as manager from './stateManager.js';

// ここで manager = { getState, setState, subscribe, ... }

export default {
    getState: manager.getState,
    setState: manager.setState,
    subscribe: manager.subscribe,
};
