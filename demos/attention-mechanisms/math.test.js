import test from 'node:test';
import assert from 'node:assert/strict';
import { softmax, scaledDotAttention, attentionMatrix, twoHeadAttention, graphAttention, gatedFeatures } from './math.js';

const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);

test('masked candidate has no effect on normalization or output', () => {
  const q = [1, 0];
  const values = [[1, 2], [900, 900], [3, 4]];
  const a = scaledDotAttention(q, [[1, 0], [50, 0], [0, 1]], values, { mask: [true, false, true] });
  const b = scaledDotAttention(q, [[1, 0], [-50, 0], [0, 1]], [[1, 2], [-900, -900], [3, 4]], { mask: [true, false, true] });
  assert.equal(a.weights[1], 0);
  close(a.weights.reduce((sum, value) => sum + value, 0), 1);
  assert.deepEqual(a.output, b.output);
});

test('softmax remains finite for large scores and smaller temperature sharpens weights', () => {
  const weights = softmax([1000, 1001, -1000]);
  close(weights.reduce((sum, value) => sum + value, 0), 1);
  assert.ok(weights.every(Number.isFinite));
  const q = [1, 0], keys = [[1, 0], [0, 1]], values = [[1], [0]];
  assert.ok(scaledDotAttention(q, keys, values, { temperature: 0.5 }).weights[0] >
    scaledDotAttention(q, keys, values, { temperature: 2 }).weights[0]);
});

test('self attention produces one normalized row per input, cross attention can have different row and column counts', () => {
  const vectors = [[1, 0], [0, 1]];
  const self = attentionMatrix(vectors, vectors, vectors);
  assert.equal(self.length, 2);
  close(self[0].weights[0], self[1].weights[1]);
  const cross = attentionMatrix([[1, 0]], [[1, 0], [0, 1], [-1, 0]], [[1, 0], [0, 1], [-1, 0]]);
  assert.equal(cross.length, 1);
  assert.equal(cross[0].weights.length, 3);
});

test('two heads project different coordinates and concatenate two outputs', () => {
  const vectors = [[2, 0], [0, 2]];
  const heads = twoHeadAttention(vectors[0], vectors);
  assert.equal(heads.length, 2);
  assert.ok(heads[0].weights[0] > heads[0].weights[1]);
  close(heads[1].weights[0], heads[1].weights[1]);
  assert.equal(heads.map(head => head.output[0]).length, 2);
});

test('unconnected graph node cannot change the center output', () => {
  const nodes = [[1, 0], [0, 1], [2, 2]];
  const a = graphAttention(nodes[0], nodes, [true, true, false]);
  const b = graphAttention(nodes[0], [nodes[0], nodes[1], [100, -100]], [true, true, false]);
  assert.equal(a.weights[2], 0);
  assert.deepEqual(a.output, b.output);
});

test('channel and spatial gates are independent sigmoid weights', () => {
  const grid = [[1, 0], [0, 1]];
  const data = gatedFeatures(grid);
  close(data.channelGates[0], data.channelGates[1]);
  close(data.spatialGates[0], data.spatialGates[1]);
  close(data.channelOutput[0][0], data.channelGates[0]);
  assert.ok(data.channelGates.reduce((a, b) => a + b, 0) !== 1);
});
