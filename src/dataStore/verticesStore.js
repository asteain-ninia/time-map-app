// src/dataStore/verticesStore.js

import { debugLog } from '../utils/logger.js';
import { showNotification } from '../ui/forms.js';

// 頂点を格納するMap。キー: vertexId, 値: { id, x, y }
const vertices = new Map();

// 共有頂点のスナップ閾値（ワールド座標単位）
// ※従来の10から20に拡大
const SHARED_VERTEX_THRESHOLD = 20;

/**
 * 指定座標に近い頂点を探す。
 * @param {Object} coord - { x, y }
 * @param {number} threshold - 閾値
 * @param {Array<string>} [excludeIds] - 検索時に無視する頂点IDの配列（同一ポリゴン内の頂点は除外）
 * @returns {Object|null} - 近傍の頂点があればその頂点、なければnull
 */
function findNearbyVertex(coord, threshold = SHARED_VERTEX_THRESHOLD, excludeIds = []) {
    for (const vertex of vertices.values()) {
        if (excludeIds.includes(vertex.id)) {
            continue;
        }
        const dx = vertex.x - coord.x;
        const dy = vertex.y - coord.y;
        if (Math.sqrt(dx * dx + dy * dy) <= threshold) {
            return vertex;
        }
    }
    return null;
}

/**
 * 指定座標について、近傍に存在する頂点（excludeIds に含まれない）があればそのIDを返し、
 * 存在しなければ新規に作成してその頂点IDを返す。
 * @param {Object} coord - { x, y }
 * @param {Array<string>} [excludeIds] - 無視する頂点IDの配列（例：同一ポリゴン内の既存頂点）
 * @param {number} [threshold] - 閾値（オプション、デフォルトはSHARED_VERTEX_THRESHOLD）
 * @returns {string} - 使用する頂点のID
 */
function createOrGetVertex(coord, excludeIds = [], threshold = SHARED_VERTEX_THRESHOLD) {
    const existing = findNearbyVertex(coord, threshold, excludeIds);
    if (existing) {
        return existing.id;
    }
    const newId = 'vx-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
    const newVertex = { id: newId, x: coord.x, y: coord.y };
    vertices.set(newId, newVertex);
    return newId;
}

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
    },

    /**
     * 指定座標について、近傍に存在する頂点（excludeIds に含まれない）があればそのIDを返し、
     * 存在しなければ新規に作成してその頂点IDを返す。
     * @param {Object} coord - { x, y }
     * @param {Array<string>} [excludeIds] - 無視する頂点IDの配列（例：同一ポリゴン内の既存頂点）
     * @param {number} [threshold] - 閾値（オプション）
     * @returns {string} - 頂点ID
     */
    createOrGetVertex: createOrGetVertex,

    /**
     * 共有頂点スナップ閾値を取得する
     * @returns {number}
     */
    getSharedThreshold() {
        return SHARED_VERTEX_THRESHOLD;
    }
};

export default VerticesStore;
