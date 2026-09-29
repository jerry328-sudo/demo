import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { original, graphAt, normalizedAdjacency, probabilities } from './model.js';

const weights = JSON.parse(readFileSync(new URL('./weights.json', import.meta.url), 'utf8'));
const baseline = { depth: 2, step: 1 };

test('symmetric GCN normalization retains unit self-loops and edge symmetry', () => {
  const a = normalizedAdjacency(original.names.length, original.edges);
  assert.ok(a.every((row, i) => row[i] > 0));
  assert.ok(a.every((row, i) => row.every((value, j) => Math.abs(value - a[j][i]) < 1e-12)));
});

test('a connected new subgraph affects existing nodes at all depths', () => {
  for (let depth = 1; depth <= 4; depth++) {
    const { before, after } = probabilities({ ...baseline, depth, step: 3 }, weights);
    assert.equal(after.length, before.length + 5);
    assert.ok(Math.abs(after[2] - before[2]) > 0.005);
  }
});

test('the first added paper changes old predictions and deeper layers reach farther nodes', () => {
  const one = probabilities({ ...baseline, depth: 1 }, weights);
  const four = probabilities({ ...baseline, depth: 4 }, weights);
  assert.ok(Math.abs(one.after[2] - one.before[2]) > 0.1);
  assert.ok(Math.abs(one.after[7] - one.before[7]) < 0.0005);
  assert.ok(Math.abs(four.after[7] - four.before[7]) > 0.0005);
});

test('the second addition preserves K, adds L, and changes old-paper predictions', () => {
  const { before, after } = probabilities({ ...baseline, step: 2 }, weights);
  assert.equal(graphAt(1).names.at(-1), 'K');
  assert.equal(graphAt(2).names.at(-1), 'L');
  assert.ok(Math.abs(after[3] - before[3]) > 0.005);
});
