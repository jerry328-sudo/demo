export const original = {
  names: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  signals: [0.86, 0.64, 0.24, -0.28, -0.68, -0.88, 0.38],
  edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6]],
  points: [[104, 310], [205, 246], [320, 256], [445, 248], [550, 178], [655, 224], [340, 112]]
};

export const separate = {
  names: ['P', 'Q', 'R', 'S'],
  signals: [-0.82, -0.42, 0.45, 0.78],
  edges: [[0, 1], [1, 2], [2, 3]],
  points: [[530, 144], [625, 116], [548, 305], [650, 280]]
};

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

export function probabilities({ depth, mode, attached, feature }, weights) {
  const before = infer(original.signals, original.edges, depth, weights);
  if (mode === 'graph' || attached.size === 0) return { before, after: [...before] };
  const edges = [...original.edges, ...[...attached].map(node => [node, original.names.length])];
  const signal = feature === 'negative' ? -0.98 : 0.98;
  const after = infer([...original.signals, signal], edges, depth, weights).slice(0, original.names.length);
  return { before, after };
}
