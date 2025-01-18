// src/map/mapRenderer/drawFeatures.js

import stateManager from '../../state/index.js';
import { debugLog } from '../../utils/logger.js';
import { colorScheme } from './index.js';

/**
 * 汎用的にフィーチャを描画するための関数。
 * ポイント・ライン・ポリゴンを一括で扱える。
 * 
 * @param {D3Selection} container - 親コンテナ(g要素)
 * @param {Object} options
 *   - data: 描画対象となるフィーチャ配列
 *   - className: 副作用として付与するクラス名 ('point', 'line', 'polygon' など)
 *   - elementType: 'path' or 'circle'
 *   - attributes: 各要素に設定する属性 (オブジェクト)
 *   - style: スタイル設定 (オブジェクト)
 *   - eventHandlers: イベント設定 (例: { click: (event, d) => {...}, mouseover: ... })
 * @param {number} k - ズーム係数
 * @param {boolean} [isPointCircle=false] - 円を描画するポイントかどうか（半径を調整）
 */
export function drawFeatures(
    container,
    { data, className, elementType, attributes, style, eventHandlers },
    k,
    isPointCircle = false
) {
    debugLog(4, `drawFeatures() が呼び出されました。className=${className}`);

    try {
        // D3のセレクションを作成
        const selection = container
            .selectAll(`.${className}`)
            .data(
                data,
                (d) => {
                    // データ識別用にIDと座標などを組み合わせ
                    if (!d.points || !d.points[0]) return `empty-${Math.random()}`;
                    return `${d.id || Math.random()}-${Math.floor(d.points[0].x)}`;
                }
            );

        // Enter
        const enterSelection = selection
            .enter()
            .append(elementType)
            .attr('class', className);

        // Enter時の属性・イベントを設定
        enterSelection.each(function (d) {
            const el = d3.select(this);
            // 属性
            for (const [attrName, attrValue] of Object.entries(attributes)) {
                if (typeof attrValue === 'function') {
                    el.attr(attrName, attrValue(d));
                } else {
                    el.attr(attrName, attrValue);
                }
            }
            // スタイル
            if (style) {
                for (const [sName, sValue] of Object.entries(style)) {
                    el.style(sName, sValue);
                }
            }
            // イベント
            for (const [eName, eHandler] of Object.entries(eventHandlers)) {
                el.on(eName, eHandler);
            }
        });

        // Update (既存要素の更新)
        selection.each(function (d) {
            const el = d3.select(this);
            for (const [attrName, attrValue] of Object.entries(attributes)) {
                if (typeof attrValue === 'function') {
                    el.attr(attrName, attrValue(d));
                } else {
                    el.attr(attrName, attrValue);
                }
            }
            if (style) {
                for (const [sName, sValue] of Object.entries(style)) {
                    el.style(sName, sValue);
                }
            }
            for (const [eName, eHandler] of Object.entries(eventHandlers)) {
                el.on(eName, eHandler);
            }
        });

        // ポイントなら半径を調整 (ズーム係数 k に応じて円の見かけサイズを変える)
        if (isPointCircle) {
            selection.merge(enterSelection).attr('r', 20 / k);
        }

        // Exit
        selection.exit().remove();

        // 選択中フィーチャをハイライト
        const st = stateManager.getState();
        if (st.selectedFeature && st.selectedFeature.id) {
            container
                .selectAll(`.${className}`)
                .filter((d) => d.id === st.selectedFeature.id)
                .each(function () {
                    try {
                        const el = d3.select(this);
                        // ライン or ポリゴン
                        if (className === 'line' || className === 'polygon') {
                            el.attr('stroke', colorScheme.highlightStroke)
                                .attr('stroke-width', colorScheme.highlightStrokeWidth)
                                .style('vector-effect', 'non-scaling-stroke');
                        } else if (className === 'point') {
                            // 円をハイライト色に
                            el.attr('fill', colorScheme.highlightPointFill);
                        }
                    } catch (err) {
                        debugLog(1, `drawFeatures ハイライト処理中にエラー: ${err}`);
                    }
                });
        }
    } catch (error) {
        debugLog(1, `drawFeatures() 外枠でエラー発生（クラス名: ${className}）: ${error}`);
    }
}
