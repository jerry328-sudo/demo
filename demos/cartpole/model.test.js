import test from 'node:test';
import assert from 'node:assert/strict';
import './model.js';
import './example.js';
const { CartPole, Policy, Trainer, evaluate, seededRandom, normalizeReturns, THETA_LIMIT, example } = globalThis.CartPoleDemo;

test('physical reference, left/right symmetry, failure and time-limit boundaries', () => {
  const left = new CartPole(), right = new CartPole();
  for (const env of [left, right]) Object.assign(env, { x: 0, xDot: 0, theta: 0, thetaDot: 0 });
  left.step(0); right.step(1);
  assert.ok(Math.abs(right.xDot - 0.1951219512195122) < 1e-12);
  assert.ok(Math.abs(right.thetaDot + 0.2926829268292683) < 1e-12);
  left.state().forEach((value, i) => assert.ok(Math.abs(value + right.state()[i]) < 1e-12));
  Object.assign(right, { theta: THETA_LIMIT + 0.01, thetaDot: 0 });
  assert.equal(right.step(0).reward, 0);
  assert.equal(right.done, true);
  assert.throws(() => right.step(1), /Reset/);
  left.reset();
  Object.assign(left, { steps: 499, x: 0, xDot: 0, theta: 0, thetaDot: 0 });
  const last = left.step(1);
  assert.equal(last.reward, 1);
  assert.equal(last.truncated, true);
  assert.equal(last.terminated, false);
  assert.throws(() => left.step(3), RangeError);
});

test('all 58 analytic policy derivatives match finite differences', () => {
  const policy = new Policy(seededRandom(7));
  const state = [0.2, -0.1, 0.04, 0.3], action = 1, advantage = 1.7;
  const sample = { ...policy.forward(state), action, advantage };
  const analytic = policy.gradient([sample]);
  const objective = () => advantage * Math.log(policy.forward(state).probs[action]);
  for (let i = 0; i < policy.parameters.length; i++) {
    const original = policy.parameters[i], delta = 1e-5;
    policy.parameters[i] = original + delta; const plus = objective();
    policy.parameters[i] = original - delta; const minus = objective();
    policy.parameters[i] = original;
    assert.ok(Math.abs((plus - minus) / (2 * delta) - analytic[i]) < 1e-6, `parameter ${i}`);
  }
  const before = policy.forward(state).probs[action];
  policy.update([sample]);
  assert.ok(policy.forward(state).probs[action] > before);
});

test('constant rewards, extreme logits and snapshots remain well-defined', () => {
  const samples = [{ return: 2 }, { return: 2 }];
  normalizeReturns(samples);
  assert.ok(samples.every(sample => sample.advantage === 0));
  const policy = new Policy(seededRandom(1));
  policy.parameters[56] = 10000;
  policy.parameters[57] = -10000;
  assert.deepEqual(policy.forward([0, 0, 0, 0]).probs, [1, 0]);
  const snapshot = policy.snapshot(); snapshot[0] += 1;
  assert.notEqual(snapshot[0], policy.parameters[0]);
  assert.throws(() => policy.load([Infinity]), TypeError);
});

test('evaluation is separate from training, and best weights match the evaluated score', () => {
  const first = new Trainer(42), second = new Trainer(42);
  for (let i = 0; i < 5; i++) {
    first.trainBatch(); evaluate(first.policy, 30000, 2);
    second.trainBatch();
  }
  assert.deepEqual(first.policy.snapshot(), second.policy.snapshot());
  assert.deepEqual(first.env.state(), second.env.state());
  const selected = new Policy(); selected.load(first.bestParameters);
  assert.equal(evaluate(selected).mean, first.bestScore);
});

test('learning improves across five seeds on unseen evaluation starts', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const trainer = new Trainer(seed);
    const initial = evaluate(trainer.policy, 20000, 20).mean;
    while (trainer.episodes < 400) trainer.trainBatch();
    const policy = new Policy(); policy.load(trainer.bestParameters);
    const trained = evaluate(policy, 20000, 20).mean;
    assert.ok(trained >= 450 && trained > initial + 300, `seed ${seed}: ${initial} → ${trained}`);
  }
});

test('the shipped example is reproducible training output and passes held-out evaluation', () => {
  const trainer = new Trainer(example.seed);
  while (trainer.episodes < example.episodes) trainer.trainBatch();
  assert.deepEqual(trainer.bestParameters, example.parameters);
  const policy = new Policy(); policy.load(example.parameters);
  const heldOut = evaluate(policy, example.heldOutSeed, example.heldOutEpisodes);
  assert.equal(heldOut.mean, example.heldOutMean);
  assert.ok(heldOut.mean >= 450);
});
