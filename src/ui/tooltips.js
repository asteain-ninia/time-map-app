// src/ui/tooltips.js

import stateManager from '../state/index.js';
import { debugLog } from '../utils/logger.js';
import { showNotification } from './forms.js';

/**
 * ツールチップ関連のUI機能をまとめたモジュール
 */
const tooltip = d3.select('#tooltip');

/**
 * ツールチップを表示する
 * @param {Event} event - マウスイベント
 * @param {Object} d - フィーチャーデータ（名前や年などを持つ）
 */
function showTooltip(event, d) {
    try {
        debugLog(4, 'ツールチップを表示します。');
        tooltip.style('display', 'block')
            .html(`名前: ${d.name}<br>年: ${d.year !== undefined ? d.year : '不明'}`);
    } catch (error) {
        console.error('showTooltip 関数内でエラー:', error);
        showNotification('ツールチップ表示中にエラーが発生しました。', 'error');
    }
}

/**
 * ツールチップをマウス位置に追従させる
 * @param {Event} event - マウスイベント
 */
function moveTooltip(event) {
    try {
        debugLog(4, 'ツールチップの位置を移動します。');
        tooltip.style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY + 10) + 'px');
    } catch (error) {
        console.error('moveTooltip 関数内でエラー:', error);
        showNotification('ツールチップ移動中にエラーが発生しました。', 'error');
    }
}

/**
 * ツールチップを非表示にする
 */
function hideTooltip() {
    try {
        debugLog(4, 'ツールチップを非表示にします。');
        tooltip.style('display', 'none');
    } catch (error) {
        console.error('hideTooltip 関数内でエラー:', error);
        showNotification('ツールチップ非表示中にエラーが発生しました。', 'error');
    }
}

export default {
    showTooltip,
    moveTooltip,
    hideTooltip
};
