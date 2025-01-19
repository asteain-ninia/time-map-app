// src/map/mapRenderer/drawHandles.js
/****************************************************
 * ライン/ポリゴンの頂点・エッジ編集用のハンドルを描画する
 ****************************************************/

import { debugLog } from '../../utils/logger.js';
import stateManager from '../../state/index.js';
import {
    vertexDragStarted,
    vertexDragged,
    vertexDragEnded,
    edgeDragStarted,
    edgeDragged,
    edgeDragEnded
} from '../mapInteraction/index.js';

import { getCurrentZoomScale } from './index.js';
import { colorScheme } from './index.js';

/**
 * 頂点ハンドル表示
 */
export function drawVertexHandles(dataGroup, feature) {
    debugLog(4, `drawVertexHandles() が呼び出されました。feature.id=${feature?.id}`);

    try {
        if (!feature.points || feature.points.length < 1) {
            return;
        }
        if (!feature.id) {
            feature.id = Date.now() + Math.random();
        }

        dataGroup.selectAll('.vertex-handle-group').remove();

        const handleGroup = dataGroup.append('g').attr('class', 'vertex-handle-group');
        const st = stateManager.getState();
        const selectedVertices = st.selectedVertices || [];
        const k = getCurrentZoomScale();

        const offsetXValues = [-2, -1, 0, 1, 2].map(o => o * st.mapWidth || 0);

        offsetXValues.forEach(offsetX => {
            try {
                const adjustedPoints = feature.points.map((p, i) => ({
                    x: p.x + offsetX,
                    y: p.y,
                    index: i
                }));
                const offsetXClass = 'offset_' + Math.round(offsetX);

                const vertices = handleGroup.selectAll(`.vertex-handle-${offsetXClass}`)
                    .data(adjustedPoints, d => d.index);

                const enterVertices = vertices.enter().append('circle');
                enterVertices.merge(vertices)
                    .attr('class', `vertex-handle vertex-handle-${offsetXClass}`)
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y)
                    .attr('r', d => {
                        const isSelected = selectedVertices.some(v => v.featureId === feature.id && v.vertexIndex === d.index);
                        return isSelected ? 28 / k : 20 / k;
                    })
                    .attr('fill', d => {
                        const isSelected = selectedVertices.some(v => v.featureId === feature.id && v.vertexIndex === d.index);
                        return isSelected ? colorScheme.vertexSelected : colorScheme.vertexNormal;
                    })
                    .style('pointer-events', 'all')
                    .style('vector-effect', 'non-scaling-stroke')
                    .call(
                        d3.drag()
                            .on('start', (event, dData) => {
                                vertexDragStarted(event, dData, offsetX, feature);
                            })
                            .on('drag', (event, dData) => {
                                vertexDragged(event, dData);
                            })
                            .on('end', (event, dData) => {
                                vertexDragEnded(event, dData, feature);
                            })
                    );

                vertices.exit().remove();
            } catch (innerError) {
                debugLog(1, `drawVertexHandles offsetX=${offsetX} ループ内でエラー: ${innerError}`);
            }
        });
    } catch (error) {
        debugLog(1, `drawVertexHandles() 外枠でエラー: ${error}`);
    }
}

/**
 * エッジハンドル描画 (新頂点追加用)
 */
export function drawEdgeHandles(dataGroup, feature) {
    debugLog(4, `drawEdgeHandles() が呼び出されました。feature.id=${feature?.id}`);

    try {
        if (!feature.points || feature.points.length <= 1) {
            return;
        }

        dataGroup.selectAll('.edge-handle-group').remove();
        const edgeHandleGroup = dataGroup.append('g').attr('class', 'edge-handle-group');

        const st = stateManager.getState();
        const isPolygon = (st.currentTool === 'polygonVertexEdit');
        const k = getCurrentZoomScale();

        let minPoints = isPolygon ? 3 : 2;
        if (feature.points.length < minPoints) {
            return;
        }

        const offsetXValues = [-2, -1, 0, 1, 2].map(o => o * st.mapWidth || 0);

        offsetXValues.forEach(offsetX => {
            try {
                const adjustedPoints = feature.points.map((p, i) => ({
                    x: p.x + offsetX,
                    y: p.y,
                    index: i
                }));
                const offsetXClass = 'offset_' + Math.round(offsetX);

                const edges = [];
                const length = adjustedPoints.length;
                const endLimit = isPolygon ? length : (length - 1);

                for (let i = 0; i < endLimit; i++) {
                    const nextIndex = (i + 1) % length;
                    const start = adjustedPoints[i];
                    const end = adjustedPoints[nextIndex];
                    edges.push({
                        x: (start.x + end.x) / 2,
                        y: (start.y + end.y) / 2,
                        startIndex: i,
                        endIndex: nextIndex
                    });
                }

                edgeHandleGroup.selectAll(`.edge-handle-${offsetXClass}`)
                    .data(edges)
                    .enter()
                    .append('circle')
                    .attr('class', `edge-handle edge-handle-${offsetXClass}`)
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y)
                    .attr('r', 16 / k)
                    .attr('fill', colorScheme.edgeHandleFill)
                    .style('pointer-events', 'all')
                    .style('vector-effect', 'non-scaling-stroke')
                    .call(
                        d3.drag()
                            .on('start', (event, dData) => {
                                edgeDragStarted(event, dData, offsetX, feature);
                            })
                            .on('drag', (event, dData) => {
                                edgeDragged(event, dData);
                            })
                            .on('end', (event, dData) => {
                                edgeDragEnded(event, dData, feature);
                            })
                    );
            } catch (innerError) {
                debugLog(1, `drawEdgeHandles offsetX=${offsetX} でエラー: ${innerError}`);
            }
        });
    } catch (error) {
        debugLog(1, `drawEdgeHandles() 外枠でエラー: ${error}`);
    }
}
