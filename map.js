// map.js

const path = require('path');

const MapModule = (() => {
    let svg;
    let zoomGroup;
    let mapWidth = 1000;
    let mapHeight = 800;

    // モジュールスコープで保持する変数
    let State;
    let DataStore;
    let UI;

    function loadMap(_State, _DataStore, _UI, renderData) {
        return new Promise((resolve, reject) => {
            State = _State;
            DataStore = _DataStore;
            UI = _UI;

            svg = d3.select('#map')
                .append('svg')
                .attr('width', '100%')
                .attr('height', '100%');
            console.log("SVG読み込みOK")
            zoomGroup = svg.append('g');

            const zoom = d3.zoom()
                .scaleExtent([1, 50])
                .on('zoom', (event) => {
                    const { x, y, k } = event.transform;

                    let dx = ((x % (mapWidth * k)) + (mapWidth * k)) % (mapWidth * k);

                    const minY = - (mapHeight * (k - 1));
                    const maxY = 0;
                    let dy = Math.max(Math.min(y, maxY), minY);

                    zoomGroup.attr('transform', `translate(${dx}, ${dy}) scale(${k})`);
                });

            svg.call(zoom);

            d3.xml(path.join(__dirname, 'map.svg')).then((xml) => {
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

                for (let i = -1; i <= 2; i++) {
                    const mapClone = mapSvg.cloneNode(true);
                    const mapGroup = zoomGroup.append('g')
                        .attr('transform', `translate(${i * mapWidth}, 0)`);
                    mapGroup.node().appendChild(mapClone);
                }

                svg.attr('viewBox', `0 0 ${mapWidth} ${mapHeight}`)
                    .attr('preserveAspectRatio', 'xMidYMid meet');

                renderData();

                // 成功時に resolve を呼び出す
                resolve();
            }).catch((error) => {
                console.error('SVGファイルの読み込みエラー:', error);
                UI.showNotification('地図の読み込み中にエラーが発生しました。', 'error');
                // エラー時に reject を呼び出す
                reject(error);
            });
        });
    }

    function renderData() {
        // 既存のデータと一時的な描画を削除
        zoomGroup.selectAll('.data-group').remove();
        zoomGroup.selectAll('.tempLine').remove();  // 一時的な線を削除
        zoomGroup.selectAll('.tempPolygon').remove();  // 一時的な面を削除

        const dataGroup = zoomGroup.append('g')
            .attr('class', 'data-group');

        const currentYear = State.currentYear || 0;
        const mapCopies = [-1, 0, 1];

        mapCopies.forEach(offset => {
            const offsetX = offset * mapWidth;

            // 仮のポイントの描画
            if (State.tempPoint) {
                drawTemporaryPoint();
            } else {
                // 仮のポイントがない場合、既存の仮ポイントを削除
                zoomGroup.selectAll('.tempPoint').remove();
            }

            // ポイントの描画
            dataGroup.selectAll(`.point-${offset}`)
                .data(DataStore.getPoints(currentYear), d => d.id)
                .join(
                    enter => enter.append('circle')
                        .attr('class', `point-${offset}`)
                        .attr('cx', d => d.x + offsetX)
                        .attr('cy', d => d.y)
                        .attr('r', 5)
                        .attr('fill', 'red')
                        .on('mouseover', (event, d) => UI.showTooltip(event, d, State))
                        .on('mousemove', UI.moveTooltip)
                        .on('mouseout', UI.hideTooltip)
                        .on('click', (event, d) => {
                            event.stopPropagation();
                            if (State.isEditMode) {
                                UI.showEditForm(d, DataStore, renderData, State);
                            } else {
                                UI.showDetailWindow(d);
                            }
                        }),
                    update => update
                        .attr('cx', d => d.x + offsetX)
                        .attr('cy', d => d.y),
                    exit => exit.remove()
                );

            // ラインの描画
            dataGroup.selectAll(`.line-${offset}`)
                .data(DataStore.getLines(currentYear), d => d.id)
                .join(
                    enter => enter.append('path')
                        .attr('class', `line line-${offset}`)
                        .attr('d', d => {
                            const linePoints = d.points.map(p => ({
                                x: p.x + offsetX,
                                y: p.y
                            }));
                            return d3.line()
                                .x(p => p.x)
                                .y(p => p.y)(linePoints);
                        })
                        .attr('stroke', 'blue')
                        .attr('stroke-width', 2)
                        .attr('fill', 'none')
                        .on('mouseover', (event, d) => UI.showTooltip(event, d, State))
                        .on('mousemove', UI.moveTooltip)
                        .on('mouseout', UI.hideTooltip)
                        .on('click', (event, d) => {
                            event.stopPropagation();
                            if (State.isEditMode) {
                                UI.showLineEditForm(d, DataStore, renderData, State);
                            } else {
                                UI.showDetailWindow(d);
                            }
                        }),
                    update => update
                        .attr('d', d => {
                            const linePoints = d.points.map(p => ({
                                x: p.x + offsetX,
                                y: p.y
                            }));
                            return d3.line()
                                .x(p => p.x)
                                .y(p => p.y)(linePoints);
                        }),
                    exit => exit.remove()
                );

            // ポリゴンの描画
            dataGroup.selectAll(`.polygon-${offset}`)
                .data(DataStore.getPolygons(currentYear), d => d.id)
                .join(
                    enter => enter.append('path')
                        .attr('class', `polygon polygon-${offset}`)
                        .attr('d', d => {
                            const polygonPoints = d.points.map(p => ({
                                x: p.x + offsetX,
                                y: p.y
                            }));
                            return d3.line()
                                .x(p => p.x)
                                .y(p => p.y)
                                .curve(d3.curveLinearClosed)(polygonPoints);
                        })
                        .attr('stroke', 'green')
                        .attr('stroke-width', 2)
                        .attr('fill', 'rgba(0, 255, 0, 0.3)')
                        .on('mouseover', (event, d) => UI.showTooltip(event, d, State))
                        .on('mousemove', UI.moveTooltip)
                        .on('mouseout', UI.hideTooltip)
                        .on('click', (event, d) => {
                            event.stopPropagation();
                            if (State.isEditMode) {
                                UI.showPolygonEditForm(d, DataStore, renderData, State);
                            } else {
                                UI.showDetailWindow(d);
                            }
                        }),
                    update => update
                        .attr('d', d => {
                            const polygonPoints = d.points.map(p => ({
                                x: p.x + offsetX,
                                y: p.y
                            }));
                            return d3.line()
                                .x(p => p.x)
                                .y(p => p.y)
                                .curve(d3.curveLinearClosed)(polygonPoints);
                        }),
                    exit => exit.remove()
                );
        });

        // 仮の線と面、ポイントの描画
        if (State.isDrawing) {
            if (State.currentTool === 'line') {
                drawTemporaryLine();
            } else if (State.currentTool === 'polygon') {
                drawTemporaryPolygon();
            }
            drawTemporaryPoint(); // 常に仮のポイントを描画
        } else if (State.currentTool === 'point' && State.tempPoint) {
            drawTemporaryPoint();
        }
    }

    function drawTemporaryPoint() {
        zoomGroup.selectAll('.tempPoint').remove();

        const mapCopies = [-1, 0, 1, 2];

        // 現在のツールに応じて、一時的なポイントを取得
        let tempPoints = [];
        if (State.currentTool === 'line' && State.tempLinePoints.length > 0) {
            tempPoints = [State.tempLinePoints[State.tempLinePoints.length - 1]];
        } else if (State.currentTool === 'polygon' && State.tempPolygonPoints.length > 0) {
            tempPoints = [State.tempPolygonPoints[State.tempPolygonPoints.length - 1]];
        } else if (State.currentTool === 'point' && State.tempPoint) {
            tempPoints = [State.tempPoint];
        }

        mapCopies.forEach(offset => {
            const offsetX = offset * mapWidth;

            zoomGroup.selectAll(`.tempPoint-${offset}`)
                .data(tempPoints)
                .enter()
                .append('circle')
                .attr('class', `tempPoint tempPoint-${offset}`)
                .attr('cx', d => d.x + offsetX)
                .attr('cy', d => d.y)
                .attr('r', 5)
                .attr('fill', 'orange');
        });
    }

    function drawTemporaryLine() {
        zoomGroup.selectAll('.tempLine').remove();

        const mapCopies = [-1, 0, 1, 2];

        mapCopies.forEach(offset => {
            const offsetX = offset * mapWidth;

            zoomGroup.append('path')
                .datum(State.tempLinePoints.map(p => ({
                    x: p.x + offsetX,
                    y: p.y
                })))
                .attr('class', 'tempLine')
                .attr('d', d3.line()
                    .x(d => d.x)
                    .y(d => d.y)
                )
                .attr('stroke', 'orange')
                .attr('stroke-width', 2)
                .attr('fill', 'none');
        });
    }

    function drawTemporaryPolygon() {
        zoomGroup.selectAll('.tempPolygon').remove();

        const mapCopies = [-1, 0, 1, 2];

        mapCopies.forEach(offset => {
            const offsetX = offset * mapWidth;

            zoomGroup.append('path')
                .datum(State.tempPolygonPoints.map(p => ({
                    x: p.x + offsetX,
                    y: p.y
                })))
                .attr('class', 'tempPolygon')
                .attr('d', d3.line()
                    .x(d => d.x)
                    .y(d => d.y)
                    .curve(d3.curveLinearClosed)
                )
                .attr('stroke', 'orange')
                .attr('stroke-width', 2)
                .attr('fill', 'rgba(255, 165, 0, 0.3)');
        });
    }

    return {
        loadMap,
        renderData,
        getMapWidth: () => mapWidth,
        getMapHeight: () => mapHeight,
    };
})();

module.exports = MapModule;
