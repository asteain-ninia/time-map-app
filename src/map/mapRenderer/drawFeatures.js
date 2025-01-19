// src/map/mapRenderer/drawFeatures.js
/****************************************************
 * ポイント・ライン・ポリゴンを実際にD3で描画するヘルパー関数群
 ****************************************************/

import stateManager from '../../state/index.js';
import { debugLog } from '../../utils/logger.js';
import { colorScheme } from './index.js';

/**
 * 汎用的にフィーチャを描画するための関数
 * - data[].points に{x,y}が入っている想定（storeが変換済み）
 */
export function drawFeatures(
    container,
    { data, className, elementType, attributes, style, eventHandlers },
    k,
    isPointCircle = false
) {
    debugLog(4, `drawFeatures() が呼び出されました。className=${className}`);

    try {
        const selection = container
            .selectAll(`.${className}`)
            .data(
                data,
                (d) => {
                    if (!d.points || !d.points[0]) return `empty-${Math.random()}`;
                    return `${d.id || Math.random()}-${Math.floor(d.points[0].x)}`;
                }
            );

        const enterSelection = selection
            .enter()
            .append(elementType)
            .attr('class', className);

        enterSelection.each(function (d) {
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

        // ポイントなら半径を調整
        if (isPointCircle) {
            selection.merge(enterSelection).attr('r', 20 / k);
        }

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
                        if (className === 'line' || className === 'polygon') {
                            el.attr('stroke', colorScheme.highlightStroke)
                                .attr('stroke-width', colorScheme.highlightStrokeWidth)
                                .style('vector-effect', 'non-scaling-stroke');
                        } else if (className === 'point') {
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
