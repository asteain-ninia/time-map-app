// map.js

import stateManager from './stateManager.js';

const MapModule = (() => {
    let svg;
    let zoomGroup;
    let mapWidth = 1000;
    let mapHeight = 800;

    let DataStore;
    let UI;

    function loadMap(_DataStore, _UI, renderData) {
        return new Promise((resolve, reject) => {
            try {
                DataStore = _DataStore;
                UI = _UI;

                svg = d3.select('#map')
                    .append('svg')
                    .attr('width', '100%')
                    .attr('height', '100%');

                zoomGroup = svg.append('g');

                const zoom = d3.zoom()
                    .scaleExtent([1, 50])
                    .on('zoom', (event) => {
                        try {
                            if (stateManager.getState().debugMode) {
                                console.info('ズームイベントが発生しました。');
                            }

                            const { x, y, k } = event.transform;

                            // 修正点: dx の計算方法を変更し、ズーム時の位置ずれを防ぐ
                            let dx = x % (mapWidth * k);
                            if (dx > 0) dx -= mapWidth * k;

                            zoomGroup.attr('transform', `translate(${dx}, ${y}) scale(${k})`);
                        } catch (error) {
                            console.error('ズームイベント中にエラーが発生しました:', error);
                        }
                    });

                svg.call(zoom);

                const mapSvgUrl = 'map.svg';

                d3.xml(mapSvgUrl).then((xml) => {
                    try {
                        const mapSvg = xml.documentElement;

                        const viewBox = mapSvg.getAttribute('viewBox');
                        if (viewBox) {
                            const viewBoxValues = viewBox.split(' ').map(Number);
                            if (viewBoxValues.length === 4) {
                                mapWidth = viewBoxValues[2];
                                mapHeight = viewBoxValues[3];
                            }
                        } else {
                            mapWidth = parseFloat(mapSvg.getAttribute('width')) || mapWidth;
                            mapHeight = parseFloat(mapSvg.getAttribute('height')) || mapHeight;
                        }

                        // 地図の複製を -2 から +2 に拡大
                        for (let i = -2; i <= 2; i++) {
                            const mapClone = mapSvg.cloneNode(true);
                            const mapGroup = zoomGroup.append('g')
                                .attr('transform', `translate(${i * mapWidth}, 0)`);
                            mapGroup.node().appendChild(mapClone);
                        }

                        svg.attr('viewBox', `0 0 ${mapWidth} ${mapHeight}`)
                            .attr('preserveAspectRatio', 'xMidYMid meet');

                        renderData();

                        if (stateManager.getState().debugMode) {
                            console.info('地図が正常に読み込まれました。');
                        }

                        resolve();
                    } catch (error) {
                        console.error('地図の初期化中にエラーが発生しました:', error);
                        UI.showNotification('地図の初期化中にエラーが発生しました。', 'error');
                        reject(error);
                    }
                }).catch((error) => {
                    console.error('SVGファイルの読み込みエラー:', error);
                    UI.showNotification('地図の読み込み中にエラーが発生しました。', 'error');
                    reject(error);
                });
            } catch (error) {
                console.error('loadMap 関数内でエラーが発生しました:', error);
                UI.showNotification('地図の読み込み中にエラーが発生しました。', 'error');
                reject(error);
            }
        });
    }

    function renderData() {
        try {
            const state = stateManager.getState();

            if (state.debugMode) {
                console.info('renderData() が呼び出されました。');
            }

            // 既存のデータと一時的な描画を削除
            zoomGroup.selectAll('.data-group').remove();
            zoomGroup.selectAll('.temp-feature-group').remove();

            const dataGroup = zoomGroup.append('g')
                .attr('class', 'data-group');

            const currentYear = state.currentYear || 0;

            // データの取得
            const points = DataStore.getPoints(currentYear);
            const lines = DataStore.getLines(currentYear);
            const polygons = DataStore.getPolygons(currentYear);

            // 地図の複製数に対応するオフセットリスト
            const mapCopies = [-2, -1, 0, 1, 2];

            // 要素を複製する関数
            function duplicateFeature(feature, offsetX) {
                const duplicatedFeature = { ...feature };
                if (duplicatedFeature.x !== undefined) {
                    duplicatedFeature.x += offsetX;
                } else {
                    duplicatedFeature.points = duplicatedFeature.points.map(p => ({ x: p.x + offsetX, y: p.y }));
                }
                return duplicatedFeature;
            }

            // 複製した要素を格納する配列
            let allAdjustedPoints = [];
            let allAdjustedLines = [];
            let allAdjustedPolygons = [];

            mapCopies.forEach(offset => {
                try {
                    const offsetX = offset * mapWidth;

                    // フィーチャーの座標をオフセットし、全体の配列に追加
                    allAdjustedPoints.push(...points.map(point => duplicateFeature(point, offsetX)));
                    allAdjustedLines.push(...lines.map(line => duplicateFeature(line, offsetX)));
                    allAdjustedPolygons.push(...polygons.map(polygon => duplicateFeature(polygon, offsetX)));
                } catch (error) {
                    console.error(`mapCopies のループ内でエラーが発生しました（オフセット: ${offset}）:`, error);
                }
            });

            // ポイントの描画
            drawFeatures(dataGroup, {
                data: allAdjustedPoints,
                className: `point`,
                elementType: 'circle',
                attributes: {
                    cx: d => d.x,
                    cy: d => d.y,
                    r: 5,
                    fill: 'red'
                },
                eventHandlers: {
                    mouseover: (event, d) => UI.showTooltip(event, d),
                    mousemove: UI.moveTooltip,
                    mouseout: UI.hideTooltip,
                    click: (event, d) => {
                        event.stopPropagation();
                        const currentState = stateManager.getState();
                        if (currentState.isEditMode) {
                            UI.showEditForm(d, DataStore, renderData);
                        } else {
                            UI.showDetailWindow(d);
                        }
                    }
                }
            });

            // ラインの描画
            drawFeatures(dataGroup, {
                data: allAdjustedLines,
                className: `line`,
                elementType: 'path',
                attributes: {
                    d: d => {
                        return d3.line()
                            .x(p => p.x)
                            .y(p => p.y)(d.points);
                    },
                    stroke: 'blue',
                    'stroke-width': 2,
                    fill: 'none'
                },
                eventHandlers: {
                    mouseover: (event, d) => UI.showTooltip(event, d),
                    mousemove: UI.moveTooltip,
                    mouseout: UI.hideTooltip,
                    click: (event, d) => {
                        event.stopPropagation();
                        const currentState = stateManager.getState();
                        if (currentState.isEditMode) {
                            UI.showLineEditForm(d, DataStore, renderData);
                        } else {
                            UI.showDetailWindow(d);
                        }
                    }
                }
            });

            // ポリゴンの描画
            drawFeatures(dataGroup, {
                data: allAdjustedPolygons,
                className: `polygon`,
                elementType: 'path',
                attributes: {
                    d: d => {
                        return d3.line()
                            .x(p => p.x)
                            .y(p => p.y)
                            .curve(d3.curveLinearClosed)(d.points);
                    },
                    stroke: 'green',
                    'stroke-width': 2,
                    fill: 'rgba(0, 255, 0, 0.3)'
                },
                eventHandlers: {
                    mouseover: (event, d) => UI.showTooltip(event, d),
                    mousemove: UI.moveTooltip,
                    mouseout: UI.hideTooltip,
                    click: (event, d) => {
                        event.stopPropagation();
                        const currentState = stateManager.getState();
                        if (currentState.isEditMode) {
                            UI.showPolygonEditForm(d, DataStore, renderData);
                        } else {
                            UI.showDetailWindow(d);
                        }
                    }
                }
            });

            // 一時的なフィーチャーの描画（必要に応じて）
            if (state.isDrawing || (state.currentTool === 'point' && state.tempPoint)) {
                drawTemporaryFeatures();
            }
        } catch (error) {
            console.error('renderData 関数内でエラーが発生しました:', error);
        }
    }

    // drawFeatures 関数の修正
    function drawFeatures(dataGroup, { data, className, elementType, attributes, eventHandlers }) {
        try {
            if (stateManager.getState().debugMode) {
                console.info(`drawFeatures() が呼び出されました。クラス名: ${className}`);
            }

            const selection = dataGroup.selectAll(`.${className}`)
                .data(data, d => `${d.id}-${Math.floor(d.x / mapWidth)}`); // キー関数を修正

            // Enter セレクション
            const enterSelection = selection.enter()
                .append(elementType)
                .attr('class', className);

            // 属性とイベントハンドラを設定
            enterSelection.each(function (d) {
                const element = d3.select(this);
                for (const [attrName, attrValue] of Object.entries(attributes)) {
                    element.attr(attrName, typeof attrValue === 'function' ? attrValue(d) : attrValue);
                }
                for (const [eventName, eventHandler] of Object.entries(eventHandlers)) {
                    element.on(eventName, eventHandler);
                }
            });

            // Update セレクション
            const updateSelection = selection
                .transition()
                .duration(200);

            updateSelection.each(function (d) {
                const element = d3.select(this);
                for (const [attrName, attrValue] of Object.entries(attributes)) {
                    element.attr(attrName, typeof attrValue === 'function' ? attrValue(d) : attrValue);
                }
            });

            // Exit セレクション
            selection.exit()
                .transition()
                .duration(200)
                .remove();

        } catch (error) {
            console.error(`drawFeatures 関数内でエラーが発生しました（クラス名: ${className}）:`, error);
        }
    }

    // その他の関数（drawTemporaryFeatures, drawTemporaryFeature）はそのまま

    return {
        loadMap,
        renderData,
        getMapWidth: () => mapWidth,
        getMapHeight: () => mapHeight,
    };
})();

export default MapModule;
