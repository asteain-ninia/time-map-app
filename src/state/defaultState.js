// src/state/defaultState.js

/**
 * アプリの初期状態を定義する
 * 必要に応じてキーを追加・変更してください
 */
export const defaultState = {
    isAddMode: false,             // 追加モードかどうか
    isEditMode: false,            // 編集モードかどうか
    currentTool: 'select',
    isDrawing: false,
    tempPoint: null,
    tempLinePoints: [],
    tempPolygonPoints: [],
    currentYear: 0,
    debugLevel: 4, // 0=出力なし, 1=エラーのみ, 2=警告+エラー, 3=情報+警告+エラー, 4=詳細
    sliderMin: 0,                 // スライダーの最小値
    sliderMax: 10000,             // スライダーの最大値
    worldName: '',                // 世界の名前
    worldDescription: '',         // 世界の概要
    selectedFeature: null,        // 現在選択されているフィーチャー
    isDragging: false,            // ドラッグ中かどうか
    selectedVertices: [],
    zoomMin: 1,
    zoomMax: 50,
};
