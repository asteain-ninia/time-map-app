// src/map/mapInteraction/selection.js
/****************************************************
 * オブジェクトや頂点の選択状態管理
 ****************************************************/

import stateManager from '../../state/index.js';
import { debugLog } from '../../utils/logger.js';
import tooltips from '../../ui/tooltips.js';

/**
 * 指定フィーチャがクリックされたとき、選択頂点を更新
 * - Shiftキーが押されていれば複数選択をトグル
 * - フィーチャが異なる場合は選択を切り替え
 * @param {Object} feature
 * @param {number} [vertexIndex]
 * @param {boolean} shiftKey
 */
export function updateSelectionForFeature(feature, vertexIndex, shiftKey) {
    debugLog(4, `updateSelectionForFeature() が呼び出されました。feature.id=${feature?.id}, vertexIndex=${vertexIndex}, shiftKey=${shiftKey}`);
    try {
        const state = stateManager.getState();
        const selectedVertices = state.selectedVertices || [];
        let newSelectedFeature = state.selectedFeature || null;

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

        // 別フィーチャ
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

        // 同じフィーチャ上
        if (vertexIndex === undefined) {
            stateManager.setState({
                selectedFeature: newSelectedFeature,
                selectedVertices: []
            });
            return;
        }

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
 * 頂点がすでに選択されているかどうか
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
 * ドラッグ終了などでツールチップ表示する際に、フィーチャの現在のプロパティを取得
 * → ここでは store の getPropertiesForYear() に依存せず、feature から直接読み出す
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
            const props = pickNearestProperties(feature.originalPolygon.properties, currentYear);
            if (props) {
                return {
                    name: props.name || 'Undefined',
                    year: props.year !== undefined ? props.year : '不明'
                };
            }
        }
        // line
        if (feature.originalLine && feature.originalLine.properties) {
            const props = pickNearestProperties(feature.originalLine.properties, currentYear);
            if (props) {
                return {
                    name: props.name || 'Undefined',
                    year: props.year !== undefined ? props.year : '不明'
                };
            }
        }
        // point
        if (feature.properties && Array.isArray(feature.properties)) {
            const props = pickNearestProperties(feature.properties, currentYear);
            if (props) {
                return {
                    name: props.name || 'Undefined',
                    year: props.year !== undefined ? props.year : '不明'
                };
            }
        }
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
 * feature.properties配列から、currentYear以下で最も新しい年を持つプロパティを返す
 */
function pickNearestProperties(propertiesArray, year) {
    if (!propertiesArray || propertiesArray.length === 0) {
        return null;
    }
    const validProps = propertiesArray
        .filter(prop => typeof prop.year === 'number' && !isNaN(prop.year))
        .sort((a, b) => a.year - b.year);

    let current = null;
    for (const p of validProps) {
        if (p.year <= year) {
            current = p;
        } else {
            break;
        }
    }
    return current;
}
