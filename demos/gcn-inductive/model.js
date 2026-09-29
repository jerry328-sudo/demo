export const original = {
  names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  topics: ['图像识别', '图学习', '科学计算', '语言模型', '材料建模', '量子材料', '晶体结构', '凝聚态', '神经算子', '交叉方法'],
  signals: [0.9, 0.7, 0.3, 0.6, -0.25, -0.75, -0.65, -0.9, 0.4, -0.18],
  edges: [[0, 1], [0, 2], [0, 8], [1, 2], [1, 3], [1, 8], [2, 3], [2, 4], [2, 9], [3, 8], [4, 5], [4, 6], [4, 9], [5, 6], [5, 7], [6, 7], [6, 9], [8, 9]],
  points: [[75, 145], [175, 82], [255, 188], [275, 70], [385, 180], [482, 115], [480, 270], [535, 345], [100, 290], [345, 310]]
};

export const subgraph = {
  names: ['M', 'N', 'O', 'P', 'Q'],
  topics: ['光谱分析', '能带结构', '计算催化', '反应动力学', '电极材料'],
  signals: [-0.65, -0.75, -0.55, -0.4, -0.8],
  edges: [[0, 1], [0, 2], [1, 2], [1, 4], [2, 3], [3, 4]],
  points: [[125, 520], [240, 455], [310, 525], [420, 455], [490, 525]]
};

export const additions = [
  { name: 'K', topic: '材料模拟', signal: -0.98, point: [220, 365], edges: [[2, 10], [9, 10]] },
  { name: 'L', topic: '计算方法', signal: 0.92, point: [375, 78], edges: [[3, 11], [10, 11]] }
];

export function graphAt(step) {
  const included = additions.slice(0, Math.min(step, 2));
  const connectedSubgraph = step >= 3;
  const offset = original.names.length + included.length;
  return {
    names: [...original.names, ...included.map(node => node.name), ...(connectedSubgraph ? subgraph.names : [])],
    topics: [...original.topics, ...included.map(node => node.topic), ...(connectedSubgraph ? subgraph.topics : [])],
    signals: [...original.signals, ...included.map(node => node.signal), ...(connectedSubgraph ? subgraph.signals : [])],
    points: [...original.points, ...included.map(node => node.point), ...(connectedSubgraph ? subgraph.points : [])],
    edges: [...original.edges, ...included.flatMap(node => node.edges),
      ...(connectedSubgraph ? [...subgraph.edges.map(([i, j]) => [i + offset, j + offset]), [2, offset], [9, offset + 4]] : [])]
  };
}

export function normalizedAdjacency(size, edges) {
  const a = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => Number(row === col)));
  for (const [i, j] of edges) a[i][j] = a[j][i] = 1;
  const degree = a.map(row => row.reduce((sum, value) => sum + value, 0));
  return a.map((row, i) => row.map((value, j) => value / Math.sqrt(degree[i] * degree[j])));
}

export function infer(signals, edges, depth, weights) {
  const a = normalizedAdjacency(signals.length, edges);
  let hidden = signals.map(signal => [signal, 1]);
  for (const [layer, weight] of weights[String(depth)].entries()) {
    const mixed = a.map(row => hidden[0].map((_, channel) =>
      row.reduce((sum, coefficient, node) => sum + coefficient * hidden[node][channel], 0)));
    hidden = mixed.map(message => weight[0].map((_, output) => {
      const pre = message.reduce((sum, value, input) => sum + value * weight[input][output], 0);
      return layer === depth - 1 ? pre : Math.tanh(pre);
    }));
  }
  return hidden.map(([logit]) => 1 / (1 + Math.exp(-logit)));
}

export function probabilities({ depth, step }, weights) {
  const beforeGraph = graphAt(step - 1);
  const afterGraph = graphAt(step);
  const before = infer(beforeGraph.signals, beforeGraph.edges, depth, weights);
  const after = infer(afterGraph.signals, afterGraph.edges, depth, weights);
  return { before, after, beforeGraph, afterGraph };
}
