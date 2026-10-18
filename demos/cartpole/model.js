(() => {
'use strict';
// A small, dependency-free REINFORCE example: 4 observations → 8 tanh units → 2 actions.
const MAX_STEPS = 500;
const HIDDEN_SIZE = 8;
const BATCH_SIZE = 8;
const GAMMA = 0.99;
const THETA_LIMIT = 12 * Math.PI / 180;
const INPUT_SCALE = [2.4, 2, THETA_LIMIT, 2];

function seededRandom(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function normal(random) {
  return Math.sqrt(-2 * Math.log(Math.max(random(), 1e-12))) * Math.cos(2 * Math.PI * random());
}

class CartPole {
  constructor(random = Math.random) {
    this.random = random;
    this.tau = 0.02;
    this.xThreshold = 2.4;
    this.thetaThreshold = THETA_LIMIT;
    this.reset();
  }

  reset() {
    // Keep the original demo's Gaussian initial conditions for comparable evaluations.
    this.x = normal(this.random) * 0.05;
    this.xDot = normal(this.random) * 0.05;
    this.theta = normal(this.random) * 0.05;
    this.thetaDot = normal(this.random) * 0.05;
    this.steps = 0;
    this.done = false;
    return this.state();
  }

  state() { return [this.x, this.xDot, this.theta, this.thetaDot]; }

  step(action) {
    if (action !== 0 && action !== 1) throw new RangeError('Action must be 0 (left) or 1 (right).');
    if (this.done) throw new Error('Reset the environment before taking another step.');
    const force = action === 1 ? 10 : -10;
    const cos = Math.cos(this.theta), sin = Math.sin(this.theta);
    const temp = (force + 0.05 * this.thetaDot ** 2 * sin) / 1.1;
    const thetaAcc = (9.8 * sin - cos * temp) / (0.5 * (4 / 3 - 0.1 * cos ** 2 / 1.1));
    const xAcc = temp - 0.05 * thetaAcc * cos / 1.1;
    this.x += this.tau * this.xDot;
    this.xDot += this.tau * xAcc;
    this.theta += this.tau * this.thetaDot;
    this.thetaDot += this.tau * thetaAcc;
    this.steps++;
    const terminated = Math.abs(this.x) > this.xThreshold || Math.abs(this.theta) > this.thetaThreshold;
    const truncated = !terminated && this.steps >= MAX_STEPS;
    this.done = terminated || truncated;
    return { state: this.state(), reward: terminated ? 0 : 1, done: this.done, terminated, truncated };
  }
}

class Policy {
  constructor(random = Math.random) {
    this.random = random;
    // Flat layout: W1[8×4], b1[8], W2[2×8], b2[2]. Only 58 trainable numbers.
    this.parameters = Array.from({ length: 58 }, (_, i) =>
      i < 32 ? normal(random) * Math.sqrt(2 / 12) :
        i >= 40 && i < 56 ? normal(random) * Math.sqrt(2 / 10) : 0);
    this.firstMoment = new Float64Array(58);
    this.secondMoment = new Float64Array(58);
    this.updates = 0;
    this.learningRate = 0.01;
  }

  forward(state) {
    const input = state.map((value, i) => value / INPUT_SCALE[i]);
    const p = this.parameters;
    const hidden = Array.from({ length: 8 }, (_, j) =>
      Math.tanh(input.reduce((sum, value, i) => sum + p[j * 4 + i] * value, p[32 + j])));
    const logits = [0, 1].map(a => hidden.reduce((sum, value, j) => sum + p[40 + a * 8 + j] * value, p[56 + a]));
    const maximum = Math.max(...logits);
    const exps = logits.map(value => Math.exp(value - maximum));
    const total = exps[0] + exps[1];
    return { input, hidden, probs: exps.map(value => value / total) };
  }

  act(state, explore = false) {
    const prediction = this.forward(state);
    const action = explore ? Number(this.random() >= prediction.probs[0]) : Number(prediction.probs[1] > prediction.probs[0]);
    return { ...prediction, state: [...state], action };
  }

  gradient(samples) {
    const gradient = new Float64Array(58);
    for (const { input, hidden, probs, action, advantage } of samples) {
      const output = probs.map((probability, a) => advantage * (Number(a === action) - probability));
      for (let a = 0; a < 2; a++) {
        gradient[56 + a] += output[a];
        for (let j = 0; j < 8; j++) gradient[40 + a * 8 + j] += output[a] * hidden[j];
      }
      for (let j = 0; j < 8; j++) {
        const delta = (output[0] * this.parameters[40 + j] + output[1] * this.parameters[48 + j]) * (1 - hidden[j] ** 2);
        gradient[32 + j] += delta;
        for (let i = 0; i < 4; i++) gradient[j * 4 + i] += delta * input[i];
      }
    }
    return gradient.map(value => value / Math.max(samples.length, 1));
  }

  update(samples) {
    if (!samples.length) return;
    const gradient = this.gradient(samples);
    const norm = Math.hypot(...gradient);
    const clip = Math.min(1, 1 / Math.max(norm, 1e-8));
    this.updates++;
    // Adam changes the step size, not the policy-gradient learning rule.
    for (let i = 0; i < 58; i++) {
      const g = gradient[i] * clip;
      this.firstMoment[i] = 0.9 * this.firstMoment[i] + 0.1 * g;
      this.secondMoment[i] = 0.999 * this.secondMoment[i] + 0.001 * g * g;
      const m = this.firstMoment[i] / (1 - 0.9 ** this.updates);
      const v = this.secondMoment[i] / (1 - 0.999 ** this.updates);
      this.parameters[i] += this.learningRate * m / (Math.sqrt(v) + 1e-8);
    }
  }

  snapshot() { return [...this.parameters]; }

  load(parameters) {
    if (!Array.isArray(parameters) || parameters.length !== 58 || !parameters.every(Number.isFinite)) {
      throw new TypeError('Expected 58 finite policy parameters.');
    }
    this.parameters = [...parameters];
    this.firstMoment.fill(0);
    this.secondMoment.fill(0);
    this.updates = 0;
  }
}

function rollout(policy, env, explore = false) {
  let state = env.reset(), reward = 0;
  const samples = [];
  while (!env.done) {
    const decision = policy.act(state, explore);
    const result = env.step(decision.action);
    reward += result.reward;
    if (explore) samples.push({ ...decision, reward: result.reward });
    state = result.state;
  }
  let futureReward = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    futureReward = samples[i].reward + GAMMA * futureReward;
    samples[i].return = futureReward;
  }
  return { samples, reward, steps: env.steps };
}

function normalizeReturns(samples) {
  const mean = samples.reduce((sum, sample) => sum + sample.return, 0) / samples.length;
  const variance = samples.reduce((sum, sample) => sum + (sample.return - mean) ** 2, 0) / samples.length;
  const scale = Math.max(Math.sqrt(variance), 1e-8);
  for (const sample of samples) sample.advantage = (sample.return - mean) / scale;
}

function evaluate(policy, seed = 10000, episodes = 10) {
  // Separate random generator: evaluating never changes training or the visible cart.
  const env = new CartPole(seededRandom(seed));
  const scores = Array.from({ length: episodes }, () => rollout(policy, env).reward);
  return { mean: scores.reduce((sum, score) => sum + score, 0) / episodes, scores };
}

class Trainer {
  constructor(seed = 42) {
    const random = seededRandom(seed);
    this.policy = new Policy(random);
    this.env = new CartPole(random);
    this.episodes = 0;
    this.steps = 0;
    this.history = [];
    this.evaluations = [];
    this.evaluation = null;
    this.bestScore = -1;
    this.bestParameters = null;
  }

  trainBatch() {
    const samples = [], rewards = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const result = rollout(this.policy, this.env, true);
      samples.push(...result.samples);
      rewards.push(result.reward);
      this.steps += result.steps;
    }
    normalizeReturns(samples);
    this.policy.update(samples);
    this.episodes += BATCH_SIZE;
    const mean = rewards.reduce((sum, score) => sum + score, 0) / rewards.length;
    this.history.push(mean);
    if (this.episodes % 40 === 0) {
      this.evaluation = evaluate(this.policy);
      this.evaluations.push({ episodes: this.episodes, mean: this.evaluation.mean });
      if (this.evaluation.mean > this.bestScore) {
        this.bestScore = this.evaluation.mean;
        this.bestParameters = this.policy.snapshot();
      }
    }
    return { mean, rewards };
  }
}

// One shared namespace supports both a normal web server and a double-clicked HTML file.
globalThis.CartPoleDemo = { MAX_STEPS, HIDDEN_SIZE, BATCH_SIZE, GAMMA, THETA_LIMIT, seededRandom, CartPole, Policy, rollout, normalizeReturns, evaluate, Trainer };
})();
