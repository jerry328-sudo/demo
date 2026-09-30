export const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
export const sigmoid = value => 1 / (1 + Math.exp(-value));
export const leakyRelu = value => value >= 0 ? value : 0.2 * value;

export function softmax(scores, mask = scores.map(() => true)) {
  const visible = scores.filter((_, index) => mask[index]);
  if (!visible.length) return scores.map(() => 0);
  const peak = Math.max(...visible);
  const weights = scores.map((score, index) => mask[index] ? Math.exp(score - peak) : 0);
  const sum = weights.reduce((total, weight) => total + weight, 0);
  return weights.map(weight => weight / sum);
}

export function weightedSum(weights, vectors) {
  return vectors[0].map((_, dimension) =>
    weights.reduce((sum, weight, index) => sum + weight * vectors[index][dimension], 0));
}

export function scaledDotAttention(query, keys, values, { temperature = 1, mask } = {}) {
  const scale = Math.sqrt(query.length) * temperature;
  const scores = keys.map(key => dot(query, key) / scale);
  const weights = softmax(scores, mask);
  return { scores, weights, output: weightedSum(weights, values) };
}

// Fixed coefficients make the additive scoring function inspectable; they are not trained.
export function additiveAttention(query, keys, values, { temperature = 1, mask } = {}) {
  const scores = keys.map(key =>
    (Math.tanh(query[0] + key[0]) + 0.6 * Math.tanh(query[1] + key[1])) / temperature);
  const weights = softmax(scores, mask);
  return { scores, weights, output: weightedSum(weights, values) };
}

export function attentionMatrix(queries, keys, values, temperature = 1) {
  return queries.map(query => scaledDotAttention(query, keys, values, { temperature }));
}

// Each head observes one coordinate; concatenation and output projection W_O = I.
export function twoHeadAttention(query, vectors, temperature = 1) {
  return [0, 1].map(dimension => {
    const q = [query[dimension]];
    const keys = vectors.map(vector => [vector[dimension]]);
    return scaledDotAttention(q, keys, keys, { temperature });
  });
}

// W = I, a = [-0.6, 0.8, 0.2, 0.5] in a^T [Wh_i || Wh_j].
export function graphAttention(center, nodes, included) {
  const scores = nodes.map(node => leakyRelu(
    -0.6 * center[0] + 0.8 * center[1] + 0.2 * node[0] + 0.5 * node[1]));
  const weights = softmax(scores, included);
  return { scores, weights, output: weightedSum(weights, nodes) };
}

// A transparent fixed score function for channel/spatial gates, not a trained SE/CBAM block.
export function gatedFeatures(channels) {
  const count = channels[0].length;
  const channelMeans = channels.map(values => values.reduce((a, b) => a + b, 0) / count);
  const spatialMeans = Array.from({ length: count }, (_, position) =>
    channels.reduce((sum, values) => sum + values[position], 0) / channels.length);
  const channelGates = channelMeans.map(mean => sigmoid(2 * (mean - 0.6)));
  const spatialGates = spatialMeans.map(mean => sigmoid(2 * (mean - 0.6)));
  return { channelMeans, spatialMeans, channelGates, spatialGates,
    channelOutput: channels.map((values, channel) => values.map(value => value * channelGates[channel])),
    spatialOutput: channels.map(values => values.map((value, position) => value * spatialGates[position])) };
}
