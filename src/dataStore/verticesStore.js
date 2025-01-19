//src/dataStore/verticesStore.js

/****************************************************
 * 頂点情報を集中管理するストア。
 * ポイント、ライン、ポリゴンのジオメトリを、
 * 頂点IDを介して一括で保存・取得・編集できるようにする。
 ****************************************************/

import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';

// 頂点を格納するMap。キー: vertexId, 値: { id, x, y }
const vertices = new Map();

const VerticesStore = {

    /**
     * 指定IDの頂点を取得
     * @param {string|number} id
     * @returns {Object|null} { id, x, y } または null
     */
    getById(id) {
        debugLog(4, `VerticesStore.getById() が呼び出されました。id=${id}`);
        try {
            if (!vertices.has(id)) {
                return null;
            }
            return vertices.get(id);
        } catch (error) {
            debugLog(1, `VerticesStore.getById() でエラー発生: ${error}`);
            return null;
        }
    },

    /**
     * すべての頂点を配列で取得
     * @returns {Array<Object>} [{ id, x, y }, ...]
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
     * 新しい頂点を追加
     * @param {Object} vertex - { id, x, y }
     */
    addVertex(vertex) {
        debugLog(4, `VerticesStore.addVertex() が呼び出されました。vertex.id=${vertex?.id}`);
        try {
            if (!vertex || vertex.id === undefined) {
                throw new Error('頂点IDが未指定です。');
            }
            if (vertices.has(vertex.id)) {
                throw new Error(`頂点IDが重複しています: ${vertex.id}`);
            }
            vertices.set(vertex.id, vertex);
        } catch (error) {
            debugLog(1, `VerticesStore.addVertex() でエラー発生: ${error}`);
            showNotification('頂点情報の追加中にエラーが発生しました。', 'error');
        }
    },

    /**
     * 頂点を更新
     * @param {Object} updatedVertex - { id, x, y }
     */
    updateVertex(updatedVertex) {
        debugLog(4, `VerticesStore.updateVertex() が呼び出されました。updatedVertex.id=${updatedVertex?.id}`);
        try {
            if (!vertices.has(updatedVertex.id)) {
                debugLog(3, `VerticesStore.updateVertex() - 更新対象の頂点が見つかりません。ID: ${updatedVertex?.id}`);
                console.warn('更新対象の頂点が見つかりません。ID:', updatedVertex.id);
                return;
            }
            vertices.set(updatedVertex.id, updatedVertex);
        } catch (error) {
            debugLog(1, `VerticesStore.updateVertex() でエラー発生: ${error}`);
            showNotification('頂点情報の更新中にエラーが発生しました。', 'error');
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
            showNotification('頂点情報の削除中にエラーが発生しました。', 'error');
        }
    },

    /**
     * ストアをクリア (全頂点削除)
     */
    clear() {
        debugLog(3, 'VerticesStore.clear() が呼び出されました。');
        vertices.clear();
    }
};

export default VerticesStore;
