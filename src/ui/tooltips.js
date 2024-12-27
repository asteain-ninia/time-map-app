// src/ui/tooltips.js

import { debugLog } from '../utils/logger.js';
import { showNotification } from './forms.js';

const tooltip = d3.select('#tooltip');

/**
 * ツールチップを表示する
 * @param {Event} event - マウスイベント
 * @param {Object} d - フィーチャーデータ（名前や年などを持つ）
 */
function showTooltip(event, d) {
    debugLog(4, 'showTooltip() が呼び出されました。');
    try {
        tooltip.style('display', 'block')
            .html(`名前: ${d.name}<br>年: ${d.year !== undefined ? d.year : '不明'}`);
    } catch (error) {
        debugLog(1, `showTooltip() でエラー発生: ${error}`);
        showNotification('ツールチップ表示中にエラーが発生しました。', 'error');
    }
}

/**
 * ツールチップをマウス位置に追従させる
 * @param {Event} event - マウスイベント
 */
function moveTooltip(event) {
    debugLog(4, 'moveTooltip() が呼び出されました。');
    try {
        tooltip.style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY + 10) + 'px');
    } catch (error) {
        debugLog(1, `moveTooltip() でエラー発生: ${error}`);
        showNotification('ツールチップ移動中にエラーが発生しました。', 'error');
    }
}

/**
 * ツールチップを非表示にする
 */
function hideTooltip() {
    debugLog(4, 'hideTooltip() が呼び出されました。');
    try {
        tooltip.style('display', 'none');
    } catch (error) {
        debugLog(1, `hideTooltip() でエラー発生: ${error}`);
        showNotification('ツールチップ非表示中にエラーが発生しました。', 'error');
    }
}

export default {
    showTooltip,
    moveTooltip,
    hideTooltip
};
