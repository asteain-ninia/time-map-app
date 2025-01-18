// src/map/mapInteraction/selection.js

import stateManager from '../../state/index.js';
import { debugLog } from '../../utils/logger.js';
import tooltips from '../../ui/tooltips.js';

/**
 * 指定フィーチャがクリックされたとき、selectedVerticesを更新。
 * - Shiftキーが押されていれば頂点をトグル
 * - フィーチャが違う場合は選択を切り替え
 * @param {Object} feature - 描画用feature
 * @param {number} [vertexIndex] - 頂点インデックス(クリックされた頂点)
 * @param {boolean} shiftKey
 */
export function updateSelectionForFeature(feature, vertexIndex, shiftKey) {
    debugLog(4, `updateSelectionForFeature() が呼び出されました。feature.id=${feature?.id}, vertexIndex=${vertexIndex}, shiftKey=${shiftKey}`);
    try {
        const state = stateManager.getState();
        const selectedVertices = state.selectedVertices || [];
        let newSelectedFeature = state.selectedFeature || null;

        // featureにidがない場合付与
        if (!feature.id) {
            feature.id = Date.now() + Math.random();
        }

        // まだ何も選択されていない
        if (!newSelectedFeature) {
            newSelectedFeature = feature;
            stateManager.setState({
                selectedFeature: newSelectedFeature,
                selectedVertices: vertexIndex !== undefined ? [{ featureId: feature.id, vertexIndex }] : []
            });
            return;
        }

        // 別フィーチャなら切り替え
        if (newSelectedFeature.id !== feature.id) {
            newSelectedFeature = feature;
            const newVertices = vertexIndex !== undefined
                ? [{ featureId: feature.id, vertexIndex }]
                : [];
            stateManager.setState({
                selectedFeature: newSelectedFeature,
                selectedVertices: newVertices
            });
            return;
        }

        // 同じフィーチャ
        if (vertexIndex === undefined) {
            // 頂点指定なし -> 頂点選択解除
            stateManager.setState({
                selectedFeature: newSelectedFeature,
                selectedVertices: []
            });
            return;
        }

        // 頂点クリック
        const exists = selectedVertices.some(v => v.featureId === feature.id && v.vertexIndex === vertexIndex);
        let newSelection;

        if (shiftKey) {
            // トグル
            if (exists) {
                newSelection = selectedVertices.filter(v => !(v.featureId === feature.id && v.vertexIndex === vertexIndex));
            } else {
                newSelection = [...selectedVertices, { featureId: feature.id, vertexIndex }];
            }
        } else {
            // 単独選択
            newSelection = [{ featureId: feature.id, vertexIndex }];
        }

        stateManager.setState({
            selectedFeature: newSelectedFeature,
            selectedVertices: newSelection
        });
    } catch (error) {
        debugLog(1, `updateSelectionForFeature() でエラー発生: ${error}`);
    }
}

/**
 * 頂点がすでに選択されているかどうかを確認
 * @param {Object} feature
 * @param {number} vertexIndex
 * @returns {boolean}
 */
export function isVertexSelected(feature, vertexIndex) {
    debugLog(4, `isVertexSelected() が呼び出されました。feature.id=${feature?.id}, vertexIndex=${vertexIndex}`);
    try {
        const state = stateManager.getState();
        const selectedVertices = state.selectedVertices || [];
        return selectedVertices.some(v => v.featureId === feature.id && v.vertexIndex === vertexIndex);
    } catch (error) {
        debugLog(1, `isVertexSelected() でエラー発生: ${error}`);
        return false;
    }
}

/**
 * ツールチップ表示用にフィーチャの年や名前を返す
 * @param {Object} feature
 * @returns {Object} {name, year}
 */
export function getFeatureTooltipData(feature) {
    debugLog(4, 'getFeatureTooltipData() が呼び出されました。');
    try {
        const st = stateManager.getState();
        const currentYear = st.currentYear || 0;

        // polygon
        if (feature.originalPolygon && feature.originalPolygon.properties) {
            const props = getPropertiesForYear(feature.originalPolygon.properties, currentYear);
            if (props) {
                return {
                    name: props.name || 'Undefined',
                    year: props.year !== undefined ? props.year : '不明'
                };
            }
        }
        // line
        if (feature.originalLine && feature.originalLine.properties) {
            const props = getPropertiesForYear(feature.originalLine.properties, currentYear);
            if (props) {
                return {
                    name: props.name || 'Undefined',
                    year: props.year !== undefined ? props.year : '不明'
                };
            }
        }
        // point
        if (feature.originalPoint && feature.originalPoint.properties) {
            const props = getPropertiesForYear(feature.originalPoint.properties, currentYear);
            if (props) {
                return {
                    name: props.name || 'Undefined',
                    year: props.year !== undefined ? props.year : '不明'
                };
            }
        }
        // fallback
        return {
            name: feature.name || 'Undefined',
            year: '不明'
        };
    } catch (error) {
        debugLog(1, `getFeatureTooltipData() でエラー発生: ${error}`);
        return { name: 'Undefined', year: '不明' };
    }
}

/**
 * ダミー。実際には src/utils/timeUtils.js から import する想定。
 */
function getPropertiesForYear(propertiesArray, year) {
    if (!propertiesArray || propertiesArray.length === 0) {
        return null;
    }
    const valids = propertiesArray.filter(prop => typeof prop.year === 'number');
    valids.sort((a, b) => a.year - b.year);
    let result = null;
    for (const p of valids) {
        if (p.year <= year) {
            result = p;
        } else break;
    }
    return result;
}
