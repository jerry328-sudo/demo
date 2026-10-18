(() => {
'use strict';
const { CartPole, Policy, Trainer, seededRandom, MAX_STEPS, example } = globalThis.CartPoleDemo;

const $ = id => document.getElementById(id);
let trainer = new Trainer(42);
let training = false, trainTimer = null, targetEpisodes = 400;
let followTraining = false, shownBest = null;
const before = new Policy(seededRandom(42));
const learned = new Policy();
learned.load(example.parameters);
const mine = new Policy();
let policy = before;
let env, decision, shownDecision, score = 0, episodeFinishedAt = null;
let previousTime = performance.now(), debt = 0;
const status = $('status');

// Playback has its own environment and clock; it never trains or modifies weights.
function restartPlayback() {
  env = new CartPole(seededRandom(9001));
  score = 0;
  debt = 0;
  episodeFinishedAt = null;
  decision = policy.act(env.state());
  shownDecision = decision;
  $('playback-status').textContent = '正在观察策略';
}

function selectPolicy() {
  const mode = $('policy').value;
  policy = mode === 'example' ? learned : mode === 'mine' ? mine : before;
  $('policy-description').textContent = mode === 'example'
    ? `同一算法训练 ${example.episodes} 回合；另用 ${example.heldOutEpisodes} 个初始状态测试，平均 ${example.heldOutMean.toFixed(0)} / 500。`
    : mode === 'mine' ? '播放你训练时在 10 回合评估中平均分最高的策略；播放期间不学习。'
      : '随机初始化的网络，还没有学习过。切换策略会从相同的初始状态重放，方便比较。';
  restartPlayback();
}

function updateTrainingStats(result) {
  $('episodes').textContent = trainer.episodes;
  $('steps').textContent = trainer.steps.toLocaleString('zh-CN');
  $('training-score').textContent = result ? result.mean.toFixed(1) : '—';
  $('best-score').textContent = trainer.bestParameters ? trainer.bestScore.toFixed(1) : '等待评估';
  $('training-progress').value = Math.min(trainer.episodes, targetEpisodes);
  $('training-progress').max = targetEpisodes;
  $('train').textContent = training ? '暂停训练' : trainer.episodes ? '继续训练' : '开始训练';
  $('my-policy').disabled = !trainer.bestParameters;
  if (trainer.bestParameters && shownBest !== trainer.bestParameters) {
    mine.load(trainer.bestParameters);
    shownBest = trainer.bestParameters;
    if (followTraining) {
      $('policy').value = 'mine';
      followTraining = false;
      selectPolicy();
    }
  }
  drawChart();
}

function trainNext() {
  if (!training) return;
  const result = trainer.trainBatch();
  if (trainer.episodes >= targetEpisodes) {
    training = false;
    status.textContent = `已完成 ${trainer.episodes} 回合，保留了评估平均分最高的策略。可以继续训练或切换策略比较。`;
  }
  updateTrainingStats(result);
  if (training) trainTimer = setTimeout(trainNext, 80);
}

$('train').addEventListener('click', () => {
  training = !training;
  if (training) {
    if (trainer.episodes >= targetEpisodes) targetEpisodes += 400;
    followTraining = true;
    if (trainer.bestParameters) {
      $('policy').value = 'mine';
      selectPolicy();
      followTraining = false;
    }
    status.textContent = '训练中：每 8 回合汇总经验更新一次；每 40 回合单独评估。播放窗口会显示你的最优策略。';
    trainNext();
  } else {
    clearTimeout(trainTimer);
    followTraining = false;
    status.textContent = '训练已暂停，权重与进度已保留。小车仍可播放，不再更新模型。';
    updateTrainingStats({ mean: trainer.history.at(-1) });
  }
});

$('reset').addEventListener('click', () => {
  clearTimeout(trainTimer);
  training = false;
  followTraining = false;
  trainer = new Trainer(42);
  shownBest = null;
  targetEpisodes = 400;
  $('policy').value = 'before';
  selectPolicy();
  status.textContent = '已回到训练前。点击开始训练，让网络通过奖励学习。';
  updateTrainingStats();
});
$('policy').addEventListener('change', () => { followTraining = false; selectPolicy(); });
$('replay').addEventListener('click', restartPlayback);

// Canvas sizes follow CSS and device pixel ratio. Draw in CSS pixels, including on phones.
const surfaces = new Map();
for (const id of ['world', 'rewardChart', 'networkViz']) {
  const canvas = $(id);
  const surface = { canvas, ctx: canvas.getContext('2d'), width: 0, height: 0 };
  surfaces.set(id, surface);
  new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    surface.width = rect.width; surface.height = rect.height;
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    surface.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChart();
  }).observe(canvas);
}

function clear(id) {
  const surface = surfaces.get(id);
  const { ctx, width, height } = surface;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);
  return surface;
}

function text(ctx, value, x, y, color = '#cbd5e1', align = 'left', size = 12) {
  ctx.font = `${size}px "Segoe UI", "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

function drawWorld() {
  const { ctx, width: w, height: h } = clear('world');
  const margin = 32, y = h * 0.77;
  const x = w / 2 + env.x / 2.4 * (w / 2 - margin);
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(w - margin, y); ctx.stroke();
  ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w / 2, 65); ctx.lineTo(w / 2, y + 12); ctx.stroke();
  ctx.setLineDash([]);
  text(ctx, '−2.4 m', margin, y + 25, '#94a3b8');
  text(ctx, '+2.4 m', w - margin, y + 25, '#94a3b8', 'right');
  ctx.fillStyle = '#38bdf8'; ctx.fillRect(x - 26, y - 24, 52, 24);
  const length = Math.min(h * 0.42, 116);
  const px = x + length * Math.sin(env.theta), py = y - 24 - length * Math.cos(env.theta);
  ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(px, py); ctx.stroke();
  ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
  text(ctx, `本回合 ${score} / ${MAX_STEPS} 分`, 16, 27, '#f1f5f9', 'left', 15);
  text(ctx, env.done ? (env.steps >= MAX_STEPS && score === MAX_STEPS ? '达到上限 ✓' : '本回合结束') : (shownDecision.action ? '向右推 →' : '← 向左推'), w - 16, 27, '#7dd3fc', 'right');
}

function drawChart() {
  const surface = surfaces.get('rewardChart');
  if (!surface || !surface.width) return;
  const { ctx, width: w, height: h } = clear('rewardChart');
  const left = 36, right = w - 12, top = 18, bottom = h - 27;
  const y = value => bottom - value / MAX_STEPS * (bottom - top);
  const x = episodes => left + episodes / Math.max(400, trainer.episodes) * (right - left);
  for (const score of [0, 250, 500]) {
    ctx.strokeStyle = '#263449'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left, y(score)); ctx.lineTo(right, y(score)); ctx.stroke();
    text(ctx, score, left - 6, y(score) + 4, '#94a3b8', 'right', 10);
  }
  const line = (points, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    points.forEach((point, i) => i ? ctx.lineTo(x(point.episodes), y(point.mean)) : ctx.moveTo(x(point.episodes), y(point.mean)));
    ctx.stroke();
    for (const point of points) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x(point.episodes), y(point.mean), 2, 0, Math.PI * 2); ctx.fill();
    }
  };
  line(trainer.history.map((mean, i) => ({ episodes: (i + 1) * 8, mean })), '#4ade80');
  line(trainer.evaluations, '#7dd3fc');
  text(ctx, '0', left, h - 8, '#94a3b8', 'left', 10);
  text(ctx, `${Math.max(400, trainer.episodes)} 回合`, right, h - 8, '#94a3b8', 'right', 10);
  if (!trainer.history.length) text(ctx, '开始训练后，这里显示真实得分', w / 2, h / 2, '#94a3b8', 'center');
}

function drawNetwork() {
  const { ctx, width: w, height: h } = clear('networkViz');
  const prediction = shownDecision;
  const xs = [Math.max(62, w * 0.17), w / 2, w - Math.max(62, w * 0.17)];
  const labels = [['位置', '速度', '角度', '角速度'], [], ['向左', '向右']];
  const values = [prediction.input, prediction.hidden, prediction.probs];
  const positions = values.map((layer, k) => layer.map((_, i) => ({ x: xs[k], y: 63 + i / (layer.length - 1) * (h - 116) })));
  for (let k = 0; k < 2; k++) {
    for (let from = 0; from < values[k].length; from++) {
      for (let to = 0; to < values[k + 1].length; to++) {
        const weight = policy.parameters[k === 0 ? to * 4 + from : 40 + to * 8 + from];
        ctx.strokeStyle = weight >= 0 ? 'rgba(56,189,248,0.28)' : 'rgba(248,113,113,0.28)';
        ctx.lineWidth = Math.min(2, 0.4 + Math.abs(weight));
        ctx.beginPath(); ctx.moveTo(positions[k][from].x, positions[k][from].y);
        ctx.lineTo(positions[k + 1][to].x, positions[k + 1][to].y); ctx.stroke();
      }
    }
  }
  ['4 个观察值', '8 个隐藏节点', '2 个动作'].forEach((label, k) => text(ctx, label, xs[k], 24, '#cbd5e1', 'center', 11));
  positions.forEach((layer, k) => layer.forEach((point, i) => {
    ctx.fillStyle = values[k][i] >= 0 ? '#38bdf8' : '#f87171';
    ctx.beginPath(); ctx.arc(point.x, point.y, k === 1 ? 5 : 8, 0, Math.PI * 2); ctx.fill();
    if (k !== 1) {
      text(ctx, labels[k][i], point.x, point.y - 16, '#e2e8f0', 'center', 11);
      text(ctx, k === 2 ? `${Math.round(values[k][i] * 100)}%` : values[k][i].toFixed(2), point.x, point.y + 23, '#94a3b8', 'center', 11);
    }
  }));
}

let lastTextUpdate = 0;
function animate(now) {
  const elapsed = Math.min((now - previousTime) / 1000, 0.1);
  previousTime = now;
  if (env.done) {
    debt = 0;
    if (now - episodeFinishedAt > 900) {
      env.reset(); score = 0; episodeFinishedAt = null;
      decision = policy.act(env.state());
      $('playback-status').textContent = '新回合：重新尝试';
    }
  } else {
    debt += elapsed;
    while (debt >= env.tau && !env.done) {
      decision = policy.act(env.state());
      score += env.step(decision.action).reward;
      debt -= env.tau;
      if (env.done) {
        episodeFinishedAt = now;
        $('playback-status').textContent = score === MAX_STEPS ? '成功保持 500 步（10 秒），即将开始新回合。' : '杆倾斜超过 12° 或小车越界，稍后自动重试。';
      }
    }
  }
  if (now - lastTextUpdate > 80) {
    lastTextUpdate = now;
    shownDecision = decision;
    drawNetwork();
    const [x, velocity, angle, angularVelocity] = shownDecision.state;
    $('state-x').textContent = `${x.toFixed(2)} m`;
    $('state-v').textContent = `${velocity.toFixed(2)} m/s`;
    $('state-angle').textContent = `${(angle / Math.PI * 180).toFixed(1)}°`;
    $('state-omega').textContent = `${angularVelocity.toFixed(2)} rad/s`;
    $('decision').textContent = `${shownDecision.action ? '向右推' : '向左推'} · 左 ${Math.round(shownDecision.probs[0] * 100)}% / 右 ${Math.round(shownDecision.probs[1] * 100)}%`;
    $('world').setAttribute('aria-label', `小车与倒立摆动画：本回合 ${score} / ${MAX_STEPS} 分，${env.done ? '本回合结束' : shownDecision.action ? '向右推' : '向左推'}。`);
  }
  drawWorld();
  requestAnimationFrame(animate);
}

selectPolicy();
updateTrainingStats();
requestAnimationFrame(animate);

})();
