import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { original, normalizedAdjacency, probabilities } from './model.js';

const weights = JSON.parse(readFileSync(new URL('./weights.json', import.meta.url), 'utf8'));
const baseline = { depth: 2, mode: 'node', attached: new Set([2]), feature: 'negative' };

test('symmetric GCN normalization retains unit self-loops and edge symmetry', () => {
  const a = normalizedAdjacency(original.names.length, original.edges);
  assert.ok(a.every((row, i) => row[i] > 0));
  assert.ok(a.every((row, i) => row.every((value, j) => Math.abs(value - a[j][i]) < 1e-12)));
});

test('a disconnected new graph leaves every existing prediction exactly unchanged at all depths', () => {
  for (let depth = 1; depth <= 4; depth++) {
    const { before, after } = probabilities({ ...baseline, depth, mode: 'graph' }, weights);
    assert.deepEqual(after, before);
  }
});

test('connecting a contrasting node changes predictions and deeper layers reach farther nodes', () => {
  const one = probabilities({ ...baseline, depth: 1 }, weights);
  const four = probabilities({ ...baseline, depth: 4 }, weights);
  assert.ok(Math.abs(one.after[2] - one.before[2]) > 0.1);
  assert.equal(one.after[0], one.before[0]);
  assert.ok(Math.abs(four.after[0] - four.before[0]) > 0.005);
});

test('isolated new node leaves original predictions unchanged', () => {
  const { before, after } = probabilities({ ...baseline, attached: new Set() }, weights);
  assert.deepEqual(after, before);
});
