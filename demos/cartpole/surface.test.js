import test from 'node:test';
import assert from 'node:assert/strict';
import './model.js';
import './example.js';
import './surface.js';
const { Policy, Trainer, seededRandom, example, sampleDecisionSurface, decisionContour } = globalThis.CartPoleDemo;

test('slice axes use degrees, angular velocity and the two fixed inputs in their correct positions', () => {
  const states = [];
  const grid = sampleDecisionSurface({ forward(state) { states.push(state); return { probs: [0.75, 0.25] }; } }, 0.8, -0.7);
  assert.equal(grid.points.length, 625);
  assert.equal(grid.faces.length, 1152);
  assert.deepEqual(states[0], [0.8, -0.7, -Math.PI / 15, -2]);
  assert.deepEqual(states[312], [0.8, -0.7, 0, 0]);
  assert.deepEqual(states.at(-1), [0.8, -0.7, Math.PI / 15, 2]);
  assert.ok(grid.points.every(point => point.probability === 0.25));
  assert.throws(() => sampleDecisionSurface({}, NaN, 0), RangeError);
  assert.throws(() => sampleDecisionSurface({}, 0, 0, 1), RangeError);
});

test('the 50 percent contour matches an independently defined linear boundary', () => {
  const triangle = [
    { x: -1, y: -1, probability: 0 },
    { x: 1, y: -1, probability: 0.5 },
    { x: 1, y: 1, probability: 1 }
  ];
  const contour = decisionContour(triangle);
  assert.equal(contour.length, 2);
  contour.forEach(point => {
    assert.equal(point.probability, 0.5);
    assert.ok(Math.abs(point.x + point.y) < 1e-12);
  });
  assert.deepEqual(decisionContour(triangle.map(point => ({ ...point, probability: 0.7 }))), []);
});

test('real model surface values and probe probabilities agree, including fixed nonzero slice conditions', () => {
  const policy = new Policy(); policy.load(example.parameters);
  const original = policy.snapshot();
  for (const [position, velocity] of [[0, 0], [0.8, -0.7], [-2, 2]]) {
    const grid = sampleDecisionSurface(policy, position, velocity);
    for (const index of [0, 18, 312, 606, 624]) {
      const point = grid.points[index];
      const expected = policy.forward([position, velocity, point.angle * Math.PI / 180, point.omega]).probs[1];
      assert.equal(point.probability, expected);
      assert.ok(expected >= 0 && expected <= 1);
    }
  }
  assert.deepEqual(policy.snapshot(), original);
  const initial = new Policy(seededRandom(42));
  assert.equal(sampleDecisionSurface(initial, 0, 0).points[312].probability, 0.5);
});

test('surface sampling never consumes training randomness or changes learning results', () => {
  const first = new Trainer(42), second = new Trainer(42);
  for (let i = 0; i < 5; i++) {
    first.trainBatch(); sampleDecisionSurface(first.policy, 0, 0);
    second.trainBatch();
  }
  assert.deepEqual(first.policy.snapshot(), second.policy.snapshot());
  assert.deepEqual(first.history, second.history);
});
