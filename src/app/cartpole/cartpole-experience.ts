/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

export function initCartPole() {
  if (typeof window === "undefined") {
    return () => {};
  }

  // --- 数学辅助函数 ---
      const randn = () => {
        // Box-Muller变换
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      };


      // --- 简单的MLP实现 ---
      class MLP {
        constructor(inputSize, hiddenSize, outputSize) {
          this.inputSize = inputSize;
          this.hiddenSize = hiddenSize;
          this.outputSize = outputSize;

          const scale1 = Math.sqrt(2 / (inputSize + hiddenSize));
          const scale2 = Math.sqrt(2 / (hiddenSize + outputSize));
          this.W1 = Array.from({ length: hiddenSize }, () =>
            Array.from({ length: inputSize }, () => randn() * scale1)
          );
          this.b1 = Array.from({ length: hiddenSize }, () => 0);
          this.W2 = Array.from({ length: outputSize }, () =>
            Array.from({ length: hiddenSize }, () => randn() * scale2)
          );
          this.b2 = Array.from({ length: outputSize }, () => 0);
          this.lr = 5e-3;
        }

        forward(x) {
          const h = this.W1.map((row, i) => {
            const sum = row.reduce((acc, w, j) => acc + w * x[j], this.b1[i]);
            return Math.tanh(sum);
          });
          const logits = this.W2.map((row, i) =>
            row.reduce((acc, w, j) => acc + w * h[j], this.b2[i])
          );
          const maxLogit = Math.max(...logits);
          const exps = logits.map(v => Math.exp(v - maxLogit));
          const sumExp = exps.reduce((a, b) => a + b, 0);
          const probs = exps.map(v => v / sumExp);
          return { h, logits, probs };
        }

        // 单步梯度上升（策略梯度）
        update(trajectory) {
          const gradW1 = this.W1.map(row => row.map(() => 0));
          const gradb1 = this.b1.map(() => 0);
          const gradW2 = this.W2.map(row => row.map(() => 0));
          const gradb2 = this.b2.map(() => 0);

          for (const step of trajectory) {
            const { state, hidden, probs, action, advantage } = step;

            // 输出层梯度
            for (let i = 0; i < this.outputSize; i++) {
              const indicator = i === action ? 1 : 0;
              const grad = advantage * (indicator - probs[i]);
              gradb2[i] += grad;
              for (let j = 0; j < this.hiddenSize; j++) {
                gradW2[i][j] += grad * hidden[j];
              }
            }

            // 隐藏层梯度 (chain rule)
            for (let j = 0; j < this.hiddenSize; j++) {
              let gradHidden = 0;
              for (let i = 0; i < this.outputSize; i++) {
                const indicator = i === action ? 1 : 0;
                const grad = advantage * (indicator - probs[i]);
                gradHidden += grad * this.W2[i][j];
              }
              const dtanh = 1 - hidden[j] * hidden[j];
              const delta = gradHidden * dtanh;
              gradb1[j] += delta;
              for (let k = 0; k < this.inputSize; k++) {
                gradW1[j][k] += delta * state[k];
              }
            }
          }

          const scale = this.lr / trajectory.length;
          for (let i = 0; i < this.outputSize; i++) {
            gradb2[i] *= scale;
            this.b2[i] += gradb2[i];
            for (let j = 0; j < this.hiddenSize; j++) {
              gradW2[i][j] *= scale;
              this.W2[i][j] += gradW2[i][j];
            }
          }
          for (let j = 0; j < this.hiddenSize; j++) {
            gradb1[j] *= scale;
            this.b1[j] += gradb1[j];
            for (let k = 0; k < this.inputSize; k++) {
              gradW1[j][k] *= scale;
              this.W1[j][k] += gradW1[j][k];
            }
          }
        }

        act(state) {
          const { probs, h, logits } = this.forward(state);
          const r = Math.random();
          let cum = 0;
          for (let i = 0; i < probs.length; i++) {
            cum += probs[i];
            if (r <= cum) return { action: i, probs, hidden: h, logits };
          }
          return { action: probs.length - 1, probs, hidden: h, logits };
        }

        actGreedy(state) {
          const { probs, h, logits } = this.forward(state);
          let bestIdx = 0;
          let bestVal = -Infinity;
          for (let i = 0; i < probs.length; i++) {
            if (probs[i] > bestVal) {
              bestVal = probs[i];
              bestIdx = i;
            }
          }
          return { action: bestIdx, probs, hidden: h, logits };
        }
      }

      // --- CartPole 环境 ---
      class CartPole {
        constructor() {
          this.gravity = 9.8;
          this.massCart = 1.0;
          this.massPole = 0.1;
          this.totalMass = this.massCart + this.massPole;
          this.length = 0.5; // 实际杆长的一半
          this.poleMassLength = this.massPole * this.length;
          this.forceMag = 10.0;
          this.tau = 0.02;
          this.thetaThreshold = 12 * Math.PI / 180; // 12°
          this.xThreshold = 2.4;
          this.reset();
        }

        reset() {
          this.x = randn() * 0.05;
          this.xDot = randn() * 0.05;
          this.theta = randn() * 0.05;
          this.thetaDot = randn() * 0.05;
          this.steps = 0;
          return this.state();
        }

        state() {
          return [this.x, this.xDot, this.theta, this.thetaDot];
        }

        step(action) {
          const force = action === 1 ? this.forceMag : -this.forceMag;
          const costheta = Math.cos(this.theta);
          const sintheta = Math.sin(this.theta);

          const temp = (force + this.poleMassLength * this.thetaDot * this.thetaDot * sintheta) / this.totalMass;
          const thetaAcc = (this.gravity * sintheta - costheta * temp) /
            (this.length * (4.0 / 3.0 - this.massPole * costheta * costheta / this.totalMass));
          const xAcc = temp - this.poleMassLength * thetaAcc * costheta / this.totalMass;

          this.x += this.tau * this.xDot;
          this.xDot += this.tau * xAcc;
          this.theta += this.tau * this.thetaDot;
          this.thetaDot += this.tau * thetaAcc;
          this.steps += 1;

          const done = (
            this.x < -this.xThreshold ||
            this.x > this.xThreshold ||
            this.theta < -this.thetaThreshold ||
            this.theta > this.thetaThreshold
          );

          const reward = done ? 0 : 1;
          return { state: this.state(), reward, done };
        }
      }

      // --- 渲染逻辑 ---
      class Renderer {
        constructor(canvas) {
          this.ctx = canvas.getContext('2d');
          this.width = canvas.width;
          this.height = canvas.height;
        }

        draw(env) {
          const ctx = this.ctx;
          ctx.clearRect(0, 0, this.width, this.height);

          ctx.fillStyle = '#0b1120';
          ctx.fillRect(0, 0, this.width, this.height);

          const cartY = this.height * 0.65;
          const trackHeight = 6;
          const cartWidth = 70;
          const cartHeight = 30;

          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, cartY, this.width, trackHeight);

          const worldToCanvas = (x) => (x / env.xThreshold) * (this.width / 2) + this.width / 2;
          const cartX = worldToCanvas(env.x);

          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(cartX - cartWidth / 2, cartY - cartHeight, cartWidth, cartHeight);

          const poleX = cartX;
          const poleY = cartY - cartHeight;
          const poleLength = env.length * 200;
          const angle = env.theta - Math.PI / 2;
          const endX = poleX + poleLength * Math.cos(angle);
          const endY = poleY + poleLength * Math.sin(angle);

          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(poleX, poleY);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(endX, endY, 10, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- 简单奖励曲线 ---
      class RewardChart {
        constructor(canvas) {
          this.ctx = canvas.getContext('2d');
          this.width = canvas.width;
          this.height = canvas.height;
          this.data = [];
          this.maxPoints = 150;
        }

        push(value) {
          this.data.push(value);
          if (this.data.length > this.maxPoints) this.data.shift();
          this.draw();
        }

        draw() {
          const ctx = this.ctx;
          ctx.clearRect(0, 0, this.width, this.height);
          ctx.fillStyle = '#0d1322';
          ctx.fillRect(0, 0, this.width, this.height);
          if (this.data.length === 0) return;

          const maxVal = Math.max(...this.data);
          const minVal = Math.min(...this.data);
          const pad = 10;

          ctx.strokeStyle = '#4ade80';
          ctx.lineWidth = 2;
          ctx.beginPath();
          this.data.forEach((val, idx) => {
            const x = pad + (idx / (this.data.length - 1)) * (this.width - pad * 2);
            const yNorm = (val - minVal) / Math.max(maxVal - minVal, 1);
            const y = this.height - pad - yNorm * (this.height - pad * 2);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();

          ctx.fillStyle = 'rgba(226, 232, 240, 0.6)';
          ctx.font = '12px "JetBrains Mono", monospace';
          ctx.fillText(`最近奖励: ${this.data[this.data.length - 1].toFixed(1)}`, pad, 16);
          ctx.fillText(`最大奖励: ${maxVal.toFixed(1)}`, pad, 32);
        }
      }

      class NetworkVisualizer {
        constructor(canvas, agent) {
          this.canvas = canvas;
          this.ctx = canvas.getContext('2d');
          this.agent = agent;
          this.lastState = Array.from({ length: agent.inputSize }, () => 0);
          this.lastHidden = Array.from({ length: agent.hiddenSize }, () => 0);
          this.lastOutput = Array.from({ length: agent.outputSize }, () => 0);
          this.metrics = {
            lastReward: 0,
            movingAverage: 0,
            learningRate: agent.lr,
            bestReward: 0,
          };
          this.inputLabels = ['x', 'x_dot', 'theta', 'theta_dot'];
          this.outputLabels = ['Left', 'Right'];
          this.draw();
        }

        setMetrics({ lastReward, movingAverage, learningRate, bestReward }) {
          if (typeof lastReward === 'number') this.metrics.lastReward = lastReward;
          if (typeof movingAverage === 'number') this.metrics.movingAverage = movingAverage;
          if (typeof learningRate === 'number') this.metrics.learningRate = learningRate;
          if (typeof bestReward === 'number') this.metrics.bestReward = bestReward;
          this.draw();
        }

        update(state, hidden, output) {
          this.lastState = state ? [...state] : this.lastState;
          this.lastHidden = hidden ? [...hidden] : this.lastHidden;
          this.lastOutput = output ? [...output] : this.lastOutput;
          this.draw();
        }

        maxAbs(matrix) {
          let max = 0;
          for (const row of matrix) {
            for (const v of row) {
              const abs = Math.abs(v);
              if (abs > max) max = abs;
            }
          }
          return Math.max(max, 1e-6);
        }

        connectionStyle(weight, maxMag) {
          const norm = Math.min(Math.abs(weight) / maxMag, 1);
          const alpha = 0.15 + norm * 0.75;
          const color = weight >= 0 ? `rgba(56, 189, 248, ${alpha.toFixed(3)})`
            : `rgba(248, 113, 113, ${alpha.toFixed(3)})`;
          const width = 0.5 + norm * 3.2;
          return { color, width };
        }

        nodeFill(value) {
          const norm = Math.min(Math.abs(value), 1.5) / 1.5;
          const alpha = 0.25 + norm * 0.6;
          if (value >= 0) {
            return { fill: `rgba(56, 189, 248, ${alpha.toFixed(3)})`, stroke: 'rgba(248, 250, 252, 0.4)' };
          }
          return { fill: `rgba(248, 113, 113, ${alpha.toFixed(3)})`, stroke: 'rgba(248, 250, 252, 0.4)' };
        }

        drawText(label, value, x, y, align = 'center') {
          const ctx = this.ctx;
          ctx.font = '11px "JetBrains Mono", monospace';
          ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
          ctx.textAlign = align;
          ctx.fillText(label, x, y);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
          ctx.fillText(value, x, y + 12);
        }

        draw() {
          const ctx = this.ctx;
          const { width, height } = this.canvas;
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = '#081021';
          ctx.fillRect(0, 0, width, height);

          ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
          ctx.font = '16px "Segoe UI", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('Neural Policy Explorer', 20, 32);

          const top = 50;
          const bottomPadding = 80;
          const marginX = 70;
          const layers = [
            {
              count: this.agent.inputSize,
              values: this.lastState,
              labels: this.inputLabels,
              radius: 12,
              align: 'right',
            },
            {
              count: this.agent.hiddenSize,
              values: this.lastHidden,
              labels: null,
              radius: 7,
              align: 'center',
            },
            {
              count: this.agent.outputSize,
              values: this.lastOutput,
              labels: this.outputLabels,
              radius: 12,
              align: 'left',
            },
          ];

          const innerHeight = height - top - bottomPadding;
          const layerSpacing = (width - marginX * 2) / (layers.length - 1);

          const positions = layers.map((layer, idx) => {
            const x = marginX + idx * layerSpacing;
            const arr = [];
            const count = layer.count;
            const step = count > 1 ? innerHeight / (count - 1) : 0;
            for (let i = 0; i < count; i++) {
              const y = count > 1 ? top + step * i : top + innerHeight / 2;
              arr.push({
                x,
                y,
                value: layer.values[i] ?? 0,
                label: layer.labels ? layer.labels[i] : null,
                radius: layer.radius,
                align: layer.align,
              });
            }
            return arr;
          });

          const maxW1 = this.maxAbs(this.agent.W1);
          const maxW2 = this.maxAbs(this.agent.W2);

          ctx.lineCap = 'round';
          // 输入->隐藏
          for (let h = 0; h < this.agent.hiddenSize; h++) {
            for (let i = 0; i < this.agent.inputSize; i++) {
              const weight = this.agent.W1[h][i];
              const { color, width: w } = this.connectionStyle(weight, maxW1);
              ctx.strokeStyle = color;
              ctx.lineWidth = w;
              ctx.beginPath();
              ctx.moveTo(positions[0][i].x, positions[0][i].y);
              ctx.lineTo(positions[1][h].x, positions[1][h].y);
              ctx.stroke();
            }
          }

          // 隐藏->输出
          for (let o = 0; o < this.agent.outputSize; o++) {
            for (let h = 0; h < this.agent.hiddenSize; h++) {
              const weight = this.agent.W2[o][h];
              const { color, width: w } = this.connectionStyle(weight, maxW2);
              ctx.strokeStyle = color;
              ctx.lineWidth = w;
              ctx.beginPath();
              ctx.moveTo(positions[1][h].x, positions[1][h].y);
              ctx.lineTo(positions[2][o].x, positions[2][o].y);
              ctx.stroke();
            }
          }

          // 绘制节点
          positions.forEach((layer, layerIdx) => {
            layer.forEach((node, nodeIdx) => {
              const { fill, stroke } = this.nodeFill(node.value);
              ctx.beginPath();
              ctx.fillStyle = fill;
              ctx.strokeStyle = stroke;
              ctx.lineWidth = 1.2;
              ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              if (layerIdx === 0 || layerIdx === 2) {
                const valueText = node.value.toFixed(2);
                const offset = layerIdx === 0 ? -node.radius - 16 : node.radius + 16;
                const textX = node.x + offset;
                const label = node.label ?? `${layerIdx}-${nodeIdx}`;
                ctx.font = '11px "Segoe UI", sans-serif';
                ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
                ctx.textAlign = layerIdx === 0 ? 'right' : 'left';
                ctx.fillText(label, textX, node.y - 6);
                ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
                ctx.fillText(valueText, textX, node.y + 8);
              }
            });
          });

          ctx.font = '12px "JetBrains Mono", monospace';
          ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
          ctx.textAlign = 'left';
          const baseY = height - 52;
          ctx.fillText(`Last episode reward: ${this.metrics.lastReward.toFixed(1)}`, 20, baseY);
          ctx.fillText(`Moving average reward: ${this.metrics.movingAverage.toFixed(1)}`, 20, baseY + 16);
          ctx.fillText(`Best reward: ${this.metrics.bestReward.toFixed(1)}  |  Learning rate: ${this.metrics.learningRate.toFixed(3)}`, 20, baseY + 32);
        }
      }

      // --- 强化学习循环 ---
      class Trainer {
        constructor(env, agent, renderer, rewardChart, statsEl, networkViz) {
          this.env = env;
          this.agent = agent;
          this.renderer = renderer;
          this.rewardChart = rewardChart;
          this.statsEl = statsEl;
          this.networkViz = networkViz;
          this.training = false;
          this.bestReward = 0;
          this.bestWeights = null;
          this.episode = 0;
          this.totalSteps = 0;
          this.gamma = 0.99;
          this.baseline = 0;
          this.baselineAlpha = 0.05;
          this.lastReward = 0;
          this.movingAvgReward = 0;
          this.movingAvgAlpha = 0.05;
        }

        runEpisode(explore = true, maxSteps = 500) {
          const trajectory = [];
          let state = this.env.reset();
          let totalReward = 0;
          for (let t = 0; t < maxSteps; t++) {
            let action, probs, hidden;
            if (explore) {
              const result = this.agent.act(state);
              action = result.action;
              probs = result.probs;
              hidden = result.hidden;
              if (this.networkViz && t % 2 === 0) {
                this.networkViz.update(state, hidden, probs);
              }
            } else {
              const greedy = this.agent.actGreedy(state);
              action = greedy.action;
              probs = greedy.probs;
              hidden = greedy.hidden;
              if (this.networkViz && t % 2 === 0) {
                this.networkViz.update(state, hidden, probs);
              }
            }
            const { state: nextState, reward, done } = this.env.step(action);
            totalReward += reward;
            if (explore) {
              trajectory.push({ state: [...state], hidden: [...hidden], probs: [...probs], action, reward });
            }
            state = nextState;
            if (explore && t % 5 === 0) {
              this.renderer.draw(this.env);
            }
            if (done) break;
          }

          if (explore && trajectory.length) {
            let G = 0;
            for (let i = trajectory.length - 1; i >= 0; i--) {
              G = trajectory[i].reward + this.gamma * G;
              trajectory[i].return = G;
            }
            const baselineBefore = this.baseline;
            const target = trajectory[0].return;
            this.baseline = (1 - this.baselineAlpha) * this.baseline + this.baselineAlpha * target;
            for (const step of trajectory) {
              step.advantage = step.return - baselineBefore;
            }
          }
          return { trajectory, totalReward };
        }

        snapshotWeights() {
          return {
            W1: this.agent.W1.map(row => [...row]),
            b1: [...this.agent.b1],
            W2: this.agent.W2.map(row => [...row]),
            b2: [...this.agent.b2],
          };
        }

        restoreWeights(weights) {
          this.agent.W1 = weights.W1.map(row => [...row]);
          this.agent.b1 = [...weights.b1];
          this.agent.W2 = weights.W2.map(row => [...row]);
          this.agent.b2 = [...weights.b2];
        }

        async trainLoop() {
          if (this.training) return;
          this.training = true;
          while (this.training) {
            const { trajectory, totalReward } = this.runEpisode(true);
            if (trajectory.length) {
              this.agent.update(trajectory);
            }
            this.episode += 1;
            this.totalSteps += trajectory.length;
            this.rewardChart.push(totalReward);
            this.lastReward = totalReward;
            if (this.movingAvgReward === 0) {
              this.movingAvgReward = totalReward;
            } else {
              this.movingAvgReward = (1 - this.movingAvgAlpha) * this.movingAvgReward + this.movingAvgAlpha * totalReward;
            }

            if (totalReward > this.bestReward) {
              this.bestReward = totalReward;
              this.bestWeights = this.snapshotWeights();
            }

            this.updateStats(totalReward);
            if (this.networkViz) {
              this.networkViz.setMetrics({
                lastReward: this.lastReward,
                movingAverage: this.movingAvgReward,
                learningRate: this.agent.lr,
                bestReward: this.bestReward,
              });
            }
            await new Promise(r => requestAnimationFrame(r));
          }
        }

        stopTraining() {
          this.training = false;
        }

        updateStats(lastReward = 0) {
          this.statsEl.innerHTML = `Episode: ${this.episode}<br/>` +
            `总更新步数: ${this.totalSteps}<br/>` +
            `当前奖励: ${lastReward.toFixed(1)}<br/>` +
            `最佳奖励: ${this.bestReward.toFixed(1)}<br/>` +
            `奖励移动平均: ${this.movingAvgReward.toFixed(1)}`;
        }

        async playBest(renderer, duration = 15) {
          if (!this.bestWeights) return;
          const backup = this.snapshotWeights();
          this.restoreWeights(this.bestWeights);
          const start = performance.now();
          let done = false;
          let state = this.env.reset();
          while (performance.now() - start < duration * 1000 && !done) {
            const decision = this.agent.actGreedy(state);
            if (this.networkViz) {
              this.networkViz.update(state, decision.hidden, decision.probs);
              this.networkViz.setMetrics({
                bestReward: this.bestReward,
                learningRate: this.agent.lr,
              });
            }
            const step = this.env.step(decision.action);
            state = step.state;
            renderer.draw(this.env);
            done = step.done;
            await new Promise(r => requestAnimationFrame(r));
          }
          this.restoreWeights(backup);
        }
      }

      // --- 主流程 ---
  const worldCanvas = document.getElementById('world');
  const rewardCanvas = document.getElementById('rewardChart');
  const statsEl = document.getElementById('stats');
  const networkCanvas = document.getElementById('networkViz');
  const startTrainBtn = document.getElementById('startTrain');
  const pauseTrainBtn = document.getElementById('pauseTrain');
  const playBestBtn = document.getElementById('playBest');

  if (!(worldCanvas instanceof HTMLCanvasElement) ||
      !(rewardCanvas instanceof HTMLCanvasElement) ||
      !(networkCanvas instanceof HTMLCanvasElement) ||
      !(statsEl instanceof HTMLElement) ||
      !(startTrainBtn instanceof HTMLButtonElement) ||
      !(pauseTrainBtn instanceof HTMLButtonElement) ||
      !(playBestBtn instanceof HTMLButtonElement)) {
    console.warn('CartPole 页面元素缺失，无法初始化。');
    return () => {};
  }

  pauseTrainBtn.disabled = true;
  playBestBtn.disabled = true;

  const renderer = new Renderer(worldCanvas);
  const rewardChart = new RewardChart(rewardCanvas);
  const env = new CartPole();
  const agent = new MLP(4, 16, 2);
  const networkViz = new NetworkVisualizer(networkCanvas, agent);
  const trainer = new Trainer(env, agent, renderer, rewardChart, statsEl, networkViz);
  trainer.updateStats();

  const initialForward = agent.forward(env.state());
  networkViz.update(env.state(), initialForward.h, initialForward.probs);
  networkViz.setMetrics({ learningRate: agent.lr });

  let animating = false;
  let frameId = 0;

  const loop = () => {
    if (!animating) return;
    renderer.draw(env);
    frameId = requestAnimationFrame(loop);
  };

  const onStartTrain = async () => {
    startTrainBtn.disabled = true;
    pauseTrainBtn.disabled = false;
    playBestBtn.disabled = false;
    animating = true;
    loop();
    trainer.trainLoop();
  };

  const onPauseTrain = () => {
    trainer.stopTraining();
    startTrainBtn.disabled = false;
    pauseTrainBtn.disabled = true;
  };

  const onPlayBest = async () => {
    const wasTraining = trainer.training;
    if (wasTraining) {
      trainer.stopTraining();
      await new Promise(r => requestAnimationFrame(r));
    }
    animating = false;
    await trainer.playBest(renderer);
    animating = true;
    loop();
    if (wasTraining) {
      trainer.trainLoop();
    }
  };

  startTrainBtn.addEventListener('click', onStartTrain);
  pauseTrainBtn.addEventListener('click', onPauseTrain);
  playBestBtn.addEventListener('click', onPlayBest);

  renderer.draw(env);

  return () => {
    animating = false;
    trainer.stopTraining();
    if (frameId) {
      cancelAnimationFrame(frameId);
    }
    startTrainBtn.removeEventListener('click', onStartTrain);
    pauseTrainBtn.removeEventListener('click', onPauseTrain);
    playBestBtn.removeEventListener('click', onPlayBest);
  };
}
