// src/ui/tooltips.js

import stateManager from '../../stateManager.js';

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
        if (stateManager.getState().debugMode) {
            console.info('showTooltip() が呼び出されました。');
        }

        tooltip.style('display', 'block')
            .html(`名前: ${d.name}<br>年: ${d.year !== undefined ? d.year : '不明'}`);
    } catch (error) {
        console.error('showTooltip 関数内でエラーが発生しました:', error);
    }
}

/**
 * ツールチップをマウス位置に追従させる
 * @param {Event} event - マウスイベント
 */
function moveTooltip(event) {
    try {
        if (stateManager.getState().debugMode) {
            console.info('moveTooltip() が呼び出されました。');
        }

        tooltip.style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY + 10) + 'px');
    } catch (error) {
        console.error('moveTooltip 関数内でエラーが発生しました:', error);
    }
}

/**
 * ツールチップを非表示にする
 */
function hideTooltip() {
    try {
        if (stateManager.getState().debugMode) {
            console.info('hideTooltip() が呼び出されました。');
        }

        tooltip.style('display', 'none');
    } catch (error) {
        console.error('hideTooltip 関数内でエラーが発生しました:', error);
    }
}

export default {
    showTooltip,
    moveTooltip,
    hideTooltip
};
