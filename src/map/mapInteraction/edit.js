// src/map/mapInteraction/edit.js

import stateManager from '../../state/index.js';
import DataStore from '../../dataStore/index.js';
import uiManager from '../../ui/uiManager.js';
import { debugLog } from '../../utils/logger.js';
import UndoRedoManager from '../../utils/undoRedoManager.js';

/**
 * 選択頂点を削除する
 * - 点情報の場合 → 単頂点ならオブジェクトごと削除
 * - ライン/ポリゴンの場合 → 頂点を削除し、頂点数0ならオブジェクトごと削除
 * - Undo/Redo対応
 */
export function removeSelectedVertices() {
    debugLog(4, 'removeSelectedVertices() が呼び出されました。');
    try {
        const st = stateManager.getState();
        const { selectedFeature, selectedVertices } = st;
        if (!selectedFeature) return;

        // 削除前の形状コピー
        const beforeObj = JSON.parse(JSON.stringify(selectedFeature));

        // 単頂点Pointなら removePoint
        if (selectedFeature.points && selectedFeature.points.length === 1 && st.currentTool === 'pointMove') {
            DataStore.removePoint(selectedFeature.id, false);
            stateManager.setState({ selectedFeature: null, selectedVertices: [] });
            uiManager.updateUI(); // フォームやリストを更新
            // Undo
            const action = UndoRedoManager.makeAction('removePoint', beforeObj, null);
            UndoRedoManager.record(action);
            return;
        }

        // ライン/ポリゴン頂点削除
        if (!selectedVertices || selectedVertices.length === 0) {
            return;
        }
        if (!selectedFeature.id) {
            selectedFeature.id = Date.now() + Math.random();
        }

        // 削除処理
        const sortedIndices = selectedVertices.map(v => v.vertexIndex).sort((a, b) => b - a);
        sortedIndices.forEach(idx => {
            if (selectedFeature.points && selectedFeature.points.length > idx) {
                selectedFeature.points.splice(idx, 1);
            }
        });

        if (!selectedFeature.points || selectedFeature.points.length === 0) {
            // 0頂点ならオブジェクトごと削除
            if (st.currentTool === 'lineVertexEdit') {
                DataStore.removeLine(selectedFeature.id, false);
            } else if (st.currentTool === 'polygonVertexEdit') {
                DataStore.removePolygon(selectedFeature.id, false);
            }
            stateManager.setState({ selectedFeature: null, selectedVertices: [] });
        } else {
            // 頂点がまだ残っている
            if (st.currentTool === 'lineVertexEdit') {
                DataStore.updateLine(selectedFeature, false);
            } else if (st.currentTool === 'polygonVertexEdit') {
                DataStore.updatePolygon(selectedFeature, false);
            }
            stateManager.setState({ selectedVertices: [] });
        }

        uiManager.updateUI();

        // Undo記録
        const stillExists = (st.currentTool === 'lineVertexEdit')
            ? DataStore.getLines(st.currentYear).find(l => l.id === beforeObj.id)
            : DataStore.getPolygons(st.currentYear).find(pg => pg.id === beforeObj.id);

        const afterObj = stillExists
            ? JSON.parse(JSON.stringify(selectedFeature))
            : null;

        const actionType = (st.currentTool === 'lineVertexEdit') ? 'updateLine' : 'updatePolygon';
        const action = UndoRedoManager.makeAction(actionType, beforeObj, afterObj);
        UndoRedoManager.record(action);

    } catch (error) {
        debugLog(1, `removeSelectedVertices() でエラー発生: ${error}`);
    }
}
