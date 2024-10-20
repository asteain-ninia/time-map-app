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
        State = _State;
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
        }).catch((error) => {
            console.error('SVGファイルの読み込みエラー:', error);
            UI.showNotification('地図の読み込み中にエラーが発生しました。', 'error');
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
                        .on('mouseover', UI.showTooltip)
                        .on('mousemove', UI.moveTooltip)
                        .on('mouseout', UI.hideTooltip)
                        .on('click', (event, d) => {
                            event.stopPropagation();
                            if (State.isEditMode) {
                                UI.showEditForm(d, DataStore, renderData);
                            } else {
                                UI.showDetailWindow(d);
                            }
                        }),
                    update => update
                        .attr('cx', d => d.x + offsetX)
                        .attr('cy', d => d.y),
                    exit => exit.remove()
                );

            // 線の描画
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
                        .on('mouseover', UI.showTooltip)
                        .on('mousemove', UI.moveTooltip)
                        .on('mouseout', UI.hideTooltip)
                        .on('click', (event, d) => {
                            event.stopPropagation();
                            if (State.isEditMode) {
                                UI.showLineEditForm(d, DataStore, renderData);
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

            // 面の描画
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
                        .on('mouseover', UI.showTooltip)
                        .on('mousemove', UI.moveTooltip)
                        .on('mouseout', UI.hideTooltip)
                        .on('click', (event, d) => {
                            event.stopPropagation();
                            if (State.isEditMode) {
                                UI.showPolygonEditForm(d, DataStore, renderData);
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

        // 仮の線と面の描画
        if (State.isDrawing) {
            if (State.currentTool === 'line') {
                drawTemporaryLine();
            } else if (State.currentTool === 'polygon') {
                drawTemporaryPolygon();
            }
        }
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
