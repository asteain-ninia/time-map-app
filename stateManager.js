// stateManager.js

const state = {
    isEditMode: false,
    currentTool: 'select',
    isDrawing: false,
    tempPoint: null,
    tempLinePoints: [],
    tempPolygonPoints: [],
    currentYear: 0,
    debugMode: true,
    sliderMin: 0,            // 追加: スライダーの最小値
    sliderMax: 10000,        // 追加: スライダーの最大値
    worldName: '',           // 追加: 世界の名前
    worldDescription: '',    // 追加: 世界の概要
};

const listeners = [];

function getState() {
    return { ...state }; // 状態のコピーを返す
}

function setState(updates) {
    Object.assign(state, updates);
    // 状態が変更されたら、すべてのリスナーに通知
    listeners.forEach(listener => listener(getState()));
}

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

export default {
    getState,
    setState,
    subscribe,
};
