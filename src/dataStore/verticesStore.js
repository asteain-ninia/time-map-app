// src/dataStore/verticesStore.js

import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';

const vertices = new Map();

/**
 * 頂点情報を一元管理するモジュール
 * - キーは vertexId
 * - 値は { id, x, y }
 */
const VerticesStore = {

    /**
     * 単一頂点を取得
     * @param {string|number} id
     * @returns {object|null} 例: { id, x, y }
     */
    getById(id) {
        debugLog(4, `VerticesStore.getById() が呼び出されました。id=${id}`);
        try {
            if (!vertices.has(id)) return null;
            return vertices.get(id);
        } catch (error) {
            debugLog(1, `VerticesStore.getById() でエラー発生: ${error}`);
            return null;
        }
    },

    /**
     * 全頂点を配列で返す
     * @returns {Array}
     */
    getAllVertices() {
        debugLog(4, 'VerticesStore.getAllVertices() が呼び出されました。');
        try {
            return Array.from(vertices.values());
        } catch (error) {
            debugLog(1, `VerticesStore.getAllVertices() でエラー発生: ${error}`);
            showNotification('頂点情報の一覧取得中にエラーが発生しました。', 'error');
            return [];
        }
    },

    /**
     * 頂点を追加
     * @param {object} vertexObj 例: { x: 100, y: 200 }
     * @returns {string|number} 付与された id
     */
    addVertex(vertexObj) {
        debugLog(4, 'VerticesStore.addVertex() が呼び出されました。');
        try {
            // IDを割り振る
            const newId = Date.now() + '_' + Math.random();
            const v = {
                id: newId,
                x: vertexObj.x || 0,
                y: vertexObj.y || 0,
            };
            vertices.set(newId, v);
            return newId;
        } catch (error) {
            debugLog(1, `VerticesStore.addVertex() でエラー発生: ${error}`);
            showNotification('頂点の追加中にエラーが発生しました。', 'error');
            return null;
        }
    },

    /**
     * 頂点を更新
     * @param {object} updatedVertex 例: { id: 'xxx', x: number, y: number }
     */
    updateVertex(updatedVertex) {
        debugLog(4, `VerticesStore.updateVertex() が呼び出されました。updatedVertex.id=${updatedVertex?.id}`);
        try {
            if (!updatedVertex.id) {
                debugLog(3, 'VerticesStore.updateVertex() - IDがありません。');
                return;
            }
            if (vertices.has(updatedVertex.id)) {
                const existing = vertices.get(updatedVertex.id);
                existing.x = updatedVertex.x !== undefined ? updatedVertex.x : existing.x;
                existing.y = updatedVertex.y !== undefined ? updatedVertex.y : existing.y;
                // 必要に応じて追加の属性があれば更新
                vertices.set(updatedVertex.id, existing);
            } else {
                debugLog(3, `VerticesStore.updateVertex() - 頂点が見つかりません。ID: ${updatedVertex?.id}`);
            }
        } catch (error) {
            debugLog(1, `VerticesStore.updateVertex() でエラー発生: ${error}`);
            showNotification('頂点の更新中にエラーが発生しました。', 'error');
        }
    },

    /**
     * 頂点を削除
     * @param {string|number} id
     */
    removeVertex(id) {
        debugLog(4, `VerticesStore.removeVertex() が呼び出されました。id=${id}`);
        try {
            vertices.delete(id);
        } catch (error) {
            debugLog(1, `VerticesStore.removeVertex() でエラー発生: ${error}`);
            showNotification('頂点の削除中にエラーが発生しました。', 'error');
        }
    },

    /**
     * 全頂点をクリア
     */
    clear() {
        debugLog(3, 'VerticesStore.clear() が呼び出されました。');
        vertices.clear();
    },
};

export default VerticesStore;
