// src/state/defaultState.js

/**
 * アプリの初期状態を定義する
 * 必要に応じてキーを追加・変更してください
 */
export const defaultState = {
    isAddMode: false,             // 追加: 追加モードかどうか
    isEditMode: false,            // 追加: 編集モードかどうか
    currentTool: 'select',
    isDrawing: false,
    tempPoint: null,
    tempLinePoints: [],
    tempPolygonPoints: [],
    currentYear: 0,
    debugMode: true,
    sliderMin: 0,                 // スライダーの最小値
    sliderMax: 10000,             // スライダーの最大値
    worldName: '',                // 世界の名前
    worldDescription: '',         // 世界の概要
    selectedFeature: null,        // 現在選択されているフィーチャー
    isDragging: false,            // ドラッグ中かどうか
    selectedVertices: [],
};
