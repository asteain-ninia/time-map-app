// src/utils/geometryUtils.js

/**
 * ２つの線分 (p→p2 と q→q2) が交差しているかどうかを判定する関数。
 * @param {Object} p - 始点。形式: {x, y}
 * @param {Object} p2 - 終点。形式: {x, y}
 * @param {Object} q - 始点。形式: {x, y}
 * @param {Object} q2 - 終点。形式: {x, y}
 * @returns {boolean} - 交差していれば true、そうでなければ false
 */
export function doLineSegmentsIntersect(p, p2, q, q2) {
    // 2D線分の交差判定：各線分の方向ベクトルと交点の位置を算出する
    const s1_x = p2.x - p.x;
    const s1_y = p2.y - p.y;
    const s2_x = q2.x - q.x;
    const s2_y = q2.y - q.y;

    const denominator = (-s2_x * s1_y + s1_x * s2_y);
    if (denominator === 0) {
        // 平行または重なっている場合（厳密な交差ではない）
        return false;
    }
    const s = (-s1_y * (p.x - q.x) + s1_x * (p.y - q.y)) / denominator;
    const t = (s2_x * (p.y - q.y) - s2_y * (p.x - q.x)) / denominator;

    return (s >= 0 && s <= 1 && t >= 0 && t <= 1);
}

/**
 * 与えられた多角形の各辺（線分）の配列を返す。
 * @param {Array} polygon - {x, y}オブジェクトの配列（多角形の頂点リスト）
 * @returns {Array} - 各辺を [p, q] の形で格納した配列
 */
export function polygonEdges(polygon) {
    const edges = [];
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
        const p = polygon[i];
        const q = polygon[(i + 1) % n]; // 最後の頂点と最初の頂点を連結
        edges.push([p, q]);
    }
    return edges;
}

/**
 * 与えられた２つの多角形が重なっているか（交差または内包しているか）どうかを判定する。
 * ※ 現状は多角形の外周（pointsプロパティ）のみで判定し、holesは考慮しません。
 * @param {Array} poly1 - {x, y}オブジェクトの配列（多角形１の外周）
 * @param {Array} poly2 - {x, y}オブジェクトの配列（多角形２の外周）
 * @returns {boolean} - 重なっているなら true、そうでなければ false
 */
export function polygonsOverlap(poly1, poly2) {
    if (!poly1 || poly1.length < 3 || !poly2 || poly2.length < 3) {
        return false;
    }

    // １．各多角形の辺同士で交差があるかどうかをチェック
    const edges1 = polygonEdges(poly1);
    const edges2 = polygonEdges(poly2);
    for (let [p, p2] of edges1) {
        for (let [q, q2] of edges2) {
            if (doLineSegmentsIntersect(p, p2, q, q2)) {
                return true;
            }
        }
    }

    // ２．どちらかの多角形の頂点が相手の内部にあるかどうかをチェック
    if (pointInPolygon(poly1[0], poly2)) {
        return true;
    }
    if (pointInPolygon(poly2[0], poly1)) {
        return true;
    }

    return false;
}

/**
 * 点が多角形の内部にあるかどうかを判定する（ray-castingアルゴリズム）。
 * @param {Object} point - {x, y}オブジェクト
 * @param {Array} polygon - {x, y}オブジェクトの配列（多角形の頂点リスト）
 * @returns {boolean} - 点が内部にあれば true、そうでなければ false
 */
export function pointInPolygon(point, polygon) {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.0000001) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/****************************************************
 * [新規追加]
 * 点と線分間の最小距離を計算する関数。
 * @param {Object} point - {x, y}のオブジェクト
 * @param {Object} A - 線分始点 {x, y}
 * @param {Object} B - 線分終点 {x, y}
 * @returns {number} - pointから線分ABまでの最小距離
 ****************************************************/
export function distancePointToSegment(point, A, B) {
    const ABx = B.x - A.x;
    const ABy = B.y - A.y;
    const len2 = ABx * ABx + ABy * ABy;
    let t = 0;
    if (len2 > 0) {
        t = ((point.x - A.x) * ABx + (point.y - A.y) * ABy) / len2;
        if (t < 0) t = 0;
        if (t > 1) t = 1;
    }
    const proj = { x: A.x + t * ABx, y: A.y + t * ABy };
    const dx = point.x - proj.x;
    const dy = point.y - proj.y;
    return Math.sqrt(dx * dx + dy * dy);
}
