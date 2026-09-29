/* =========================================================
 * train.js —— 第 7 节：在浏览器里真实训练一个 GCN
 * 前向 / 反向传播 / Adam 全部手动实现，与 PyTorch 的数学定义一致
 * ========================================================= */
'use strict';

/* ---------------- 训练器 ---------------- */
class GCNTrainer {
  /**
   * cfg: { useGraph, layers, hidden, dropout, lr, wd, seed }
   * data: { n, C, F, X, y, edges, train: [idx] }
   */
  constructor(cfg, data) {
    this.cfg = cfg; this.d = data;
    this.rng = mulberry32(cfg.seed * 1234567 + 89);
    this.P = gcnPropagator(data.n, data.edges, cfg.useGraph);   // MLP = 传播矩阵取单位阵
    const dims = [data.F];
    for (let l = 0; l < cfg.layers - 1; l++) dims.push(cfg.hidden);
    dims.push(data.C);
    this.dims = dims;
    // Glorot 均匀初始化（与 PyG 的 GCNConv 默认一致），偏置初始化为 0
    this.W = []; this.b = [];
    for (let l = 0; l < cfg.layers; l++) {
      const a = Math.sqrt(6 / (dims[l] + dims[l + 1]));
      this.W.push(Array.from({ length: dims[l] }, () => Float64Array.from({ length: dims[l + 1] }, () => (this.rng() * 2 - 1) * a)));
      this.b.push(new Float64Array(dims[l + 1]));
    }
    const zeros = arr => arr.map(x => (x instanceof Float64Array ? new Float64Array(x.length) : x.map(r => new Float64Array(r.length))));
    this.mW = zeros(this.W); this.vW = zeros(this.W); this.mb = zeros(this.b); this.vb = zeros(this.b);
    this.t = 0; this.epoch = 0;
    this.isTrain = new Array(data.n).fill(false);
    data.train.forEach(i => { this.isTrain[i] = true; });
  }
  prop(H) {
    const n = H.length, dd = H[0].length, O = Array.from({ length: n }, () => new Float64Array(dd));
    for (let i = 0; i < n; i++) for (const [j, w] of this.P[i]) { const hj = H[j], oi = O[i]; for (let k = 0; k < dd; k++) oi[k] += w * hj[k]; }
    return O;
  }
  static mm(A, W) {   // A: n×k, W: k×c
    const n = A.length, K = W.length, C = W[0].length, O = Array.from({ length: n }, () => new Float64Array(C));
    for (let i = 0; i < n; i++) for (let k = 0; k < K; k++) { const a = A[i][k]; if (a === 0) continue; const wk = W[k], oi = O[i]; for (let j = 0; j < C; j++) oi[j] += a * wk[j]; }
    return O;
  }
  forward(training) {
    const { layers, dropout } = this.cfg;
    const cache = [];
    let H = this.d.X.map(r => Float64Array.from(r));
    for (let l = 0; l < layers; l++) {
      let mask = null;
      if (training && dropout > 0) {
        const keep = 1 / (1 - dropout);
        mask = H.map(r => Float64Array.from(r, () => (this.rng() < dropout ? 0 : keep)));
        H = H.map((r, i) => r.map((v, k) => v * mask[i][k]));
      }
      const A = this.prop(H);                          // Â · H
      const Z = GCNTrainer.mm(A, this.W[l]);           // (Â H) W
      Z.forEach(r => { for (let k = 0; k < r.length; k++) r[k] += this.b[l][k]; });
      cache.push({ mask, A, Z });
      H = l < layers - 1 ? Z.map(r => r.map(v => (v > 0 ? v : 0))) : Z;   // ReLU（最后一层不加）
    }
    return { out: H, cache };
  }
  static softmax(z) {
    const m = Math.max(...z), e = Array.from(z, v => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0);
    return e.map(v => v / s);
  }
  /** 训练一个 epoch，并在 eval 模式下评估 */
  step() {
    const { lr, wd, layers } = this.cfg, { y, train, n, C } = this.d;
    const { out, cache } = this.forward(true);
    let loss = 0;
    let dZ = Array.from({ length: n }, () => new Float64Array(C));
    for (const i of train) {
      const p = GCNTrainer.softmax(out[i]);
      loss -= Math.log(p[y[i]] + 1e-12);
      for (let k = 0; k < C; k++) dZ[i][k] = (p[k] - (k === y[i] ? 1 : 0)) / train.length;
    }
    loss /= train.length;
    this.t++;
    const b1 = 0.9, b2 = 0.999, eps = 1e-8, c1 = 1 - Math.pow(b1, this.t), c2 = 1 - Math.pow(b2, this.t);
    for (let l = layers - 1; l >= 0; l--) {
      const { A, mask } = cache[l], W = this.W[l];
      const K = W.length, Cc = W[0].length;
      // dW = Aᵀ dZ, db = Σ dZ
      const dW = Array.from({ length: K }, () => new Float64Array(Cc)), db = new Float64Array(Cc);
      for (let i = 0; i < n; i++) {
        const dz = dZ[i], ai = A[i];
        for (let c = 0; c < Cc; c++) db[c] += dz[c];
        for (let k = 0; k < K; k++) { const a = ai[k]; if (a === 0) continue; const row = dW[k]; for (let c = 0; c < Cc; c++) row[c] += a * dz[c]; }
      }
      // 反传到上一层：dH = Âᵀ (dZ Wᵀ)，再乘 dropout 掩码与 ReLU 导数
      let dPrev = null;
      if (l > 0) {
        const dA = dZ.map(dz => { const o = new Float64Array(K); for (let k = 0; k < K; k++) { let s = 0; const wk = W[k]; for (let c = 0; c < Cc; c++) s += dz[c] * wk[c]; o[k] = s; } return o; });
        let dH = this.prop(dA);   // Â 对称，Âᵀ = Â
        if (mask) dH = dH.map((r, i) => r.map((v, k) => v * mask[i][k]));
        const Zp = cache[l - 1].Z;
        dPrev = dH.map((r, i) => r.map((v, k) => (Zp[i][k] > 0 ? v : 0)));
      } else if (mask) { /* 输入层不需要继续反传 */ }
      // Adam（weight_decay 与 torch.optim.Adam 一致：作为 L2 项加到梯度上）
      for (let k = 0; k < K; k++) for (let c = 0; c < Cc; c++) {
        const g = dW[k][c] + wd * W[k][c];
        const m = this.mW[l][k][c] = b1 * this.mW[l][k][c] + (1 - b1) * g;
        const v = this.vW[l][k][c] = b2 * this.vW[l][k][c] + (1 - b2) * g * g;
        W[k][c] -= lr * (m / c1) / (Math.sqrt(v / c2) + eps);
      }
      for (let c = 0; c < Cc; c++) {
        const g = db[c];
        const m = this.mb[l][c] = b1 * this.mb[l][c] + (1 - b1) * g;
        const v = this.vb[l][c] = b2 * this.vb[l][c] + (1 - b2) * g * g;
        this.b[l][c] -= lr * (m / c1) / (Math.sqrt(v / c2) + eps);
      }
      dZ = dPrev;
    }
    this.epoch++;
    return Object.assign({ epoch: this.epoch, trainLoss: loss }, this.evaluate());
  }
  evaluate() {
    const { out } = this.forward(false), { y, n } = this.d;
    let trC = 0, trN = 0, teC = 0, teN = 0, teLoss = 0;
    const probs = [], pred = [];
    for (let i = 0; i < n; i++) {
      const p = GCNTrainer.softmax(out[i]);
      const k = p.indexOf(Math.max(...p));
      probs.push(p); pred.push(k);
      if (this.isTrain[i]) { trN++; trC += k === y[i]; }
      else { teN++; teC += k === y[i]; teLoss -= Math.log(p[y[i]] + 1e-12); }
    }
    return { trainAcc: trC / trN, testAcc: teC / teN, testLoss: teLoss / teN, pred, probs };
  }
}

/* ---------------- 页面 ---------------- */
registerSection('train', () => {
  const G = getSBM();
  const train = [];
  for (let c = 0; c < G.C; c++) { const idx = G.y.map((v, i) => (v === c ? i : -1)).filter(i => i >= 0); train.push(...idx.slice(0, 3)); }
  const data = { n: G.n, C: G.C, F: G.F, X: G.X8, y: G.y, edges: G.edges, train };
  const isTrain = new Set(train);

  const HIDDEN = [2, 4, 8, 16, 32, 64];
  const WD = [0, 5e-5, 5e-4, 5e-3, 5e-2];
  const DEFAULT = { model: 'gcn', layers: 2, hidden: 16, dropout: 0.5, lr: 0.01, wd: 5e-4, epochs: 200, seed: 1 };
  const cfg = Object.assign({}, DEFAULT);
  const run = { trainer: null, hist: [], raf: null, running: false, speed: 2, last: null };

  /* ----- 图 ----- */
  const graph = { nodes: G.layout.map((p, i) => ({ x: p[0], y: p[1], group: G.y[i] })), edges: G.edges };
  const gv = new GraphView($('#train-graph'), graph, { width: 560, height: 380, r: 11, showFeat: false, idLabel: i => 'ABC'[G.y[i]] });
  gv.nodeEls.forEach((ne, i) => {
    ne.ring.setAttribute('r', 14);
    if (isTrain.has(i)) { ne.ring.style.opacity = 1; ne.ring.style.strokeWidth = 3; }
  });
  gv.onHover = i => {
    const ev = run.last;
    const probs = ev ? ev.probs[i].map((p, k) => `${'ABC'[k]}: ${fmt(p * 100, 0)}%`).join('　') : '';
    return `<div class="t-title">节点 ${i}（${isTrain.has(i) ? '有标签，参与训练' : '无标签，用于测试'}）</div>真实类别：${'ABC'[G.y[i]]}<br>${ev ? `预测类别：${'ABC'[ev.pred[i]]}<br><span class="muted">${probs}</span>` : ''}`;
  };

  /* ----- 统计 & 图表 ----- */
  const stats = $('#train-stats');
  const lossChart = new LineChart($('#train-loss'), { width: 460, height: 190, xLabel: 'epoch', yLabel: 'loss', yMaxCap: 3 });
  const accChart = new LineChart($('#train-acc'), { width: 460, height: 190, xLabel: 'epoch', yLabel: '准确率', yDomain: [0, 1], yFormat: v => (v * 100).toFixed(0) + '%' });

  function renderAll() {
    const ev = run.last;
    gv.gOverlay.innerHTML = '';
    G.y.forEach((c, i) => {
      gv.nodeFill(i, ev ? groupColor(ev.pred[i]) : 'var(--node-idle)');
      if (ev && ev.pred[i] !== c) {
        const nd = graph.nodes[i];
        s('text', { x: nd.x + 11, y: nd.y - 9, style: 'fill:var(--bad);font-size:13px;font-weight:700;pointer-events:none', text: '✕' }, gv.gOverlay);
      }
    });
    const hs = run.hist;
    const bestIdx = hs.reduce((b, r, k) => (r.testAcc > (hs[b]?.testAcc ?? -1) ? k : b), -1);
    const stat = (k, v) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    stats.innerHTML =
      stat('Epoch', `${run.trainer ? run.trainer.epoch : 0} / ${cfg.epochs}`) +
      stat('训练 loss', ev && hs.length ? fmt(hs[hs.length - 1].trainLoss, 3) : '—') +
      stat('测试准确率', ev ? fmt(ev.testAcc * 100, 1) + '%' : '—') +
      stat('最高测试准确率', bestIdx >= 0 ? `${fmt(hs[bestIdx].testAcc * 100, 1)}% <span class="small muted">@${hs[bestIdx].epoch}</span>` : '—');
    lossChart.o.xDomain = accChart.o.xDomain = [0, cfg.epochs];
    lossChart.update([
      { name: '训练', color: 'var(--c1)', values: hs.map(r => [r.epoch, r.trainLoss]) },
      { name: '测试', color: 'var(--c2)', values: hs.map(r => [r.epoch, r.testLoss]) }
    ]);
    accChart.update([
      { name: '训练', color: 'var(--c1)', values: hs.map(r => [r.epoch, r.trainAcc]) },
      { name: '测试', color: 'var(--c2)', values: hs.map(r => [r.epoch, r.testAcc]) }
    ]);
  }

  function diagnose() {
    const hs = run.hist, tip = $('#train-tip');
    if (!hs.length) { tip.innerHTML = '<b>提示：</b>先用推荐默认值点"开始训练"，再逐个改变超参数进行对比。每次改变超参数都会重置模型。'; return; }
    const last = hs[hs.length - 1];
    const best = hs.reduce((b, r) => (r.testAcc > b.testAcc ? r : b), hs[0]);
    const minTestLoss = Math.min(...hs.map(r => r.testLoss));
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    const recent = hs.slice(-20), recentTrainLoss = avg(recent.map(r => r.trainLoss));
    const recentGap = avg(recent.map(r => r.trainAcc - r.testAcc));
    const tail = hs.slice(-30).map(r => r.trainLoss);
    const jitter = tail.length > 5 ? Math.max(...tail) - Math.min(...tail) : 0;
    const msgs = [];
    if (!isFinite(last.trainLoss) || (cfg.lr >= 0.1 && jitter > 0.5)) msgs.push('<b>学习率过大</b>：loss 大幅震荡甚至发散，参数每一步都"迈过头"了。试试把 lr 降到 0.01。');
    if (last.trainAcc < 0.9 && cfg.lr <= 0.002) msgs.push('<b>学习率太小 / 训练轮数不够</b>：训练准确率还没上去，模型还没学完。增大 lr 或 epochs。');
    if (last.trainAcc < 0.9 && cfg.hidden <= 2) msgs.push('<b>hidden_channels 太小</b>：模型容量不足，连训练集都拟合不好（欠拟合）。');
    else if (cfg.hidden <= 2) msgs.push(`<b>hidden_channels 很小</b>：训练集虽然能拟合，但每个节点只剩 ${cfg.hidden} 维表示，3 个类别挤在很小的空间里，泛化变差（对比推荐默认的测试准确率）。`);
    if (cfg.dropout >= 0.8) msgs.push('<b>dropout 很大</b>：训练时大部分信息被丢弃，曲线抖动明显、学习变慢。');
    if (cfg.wd >= 5e-3) msgs.push('<b>weight_decay 较大</b>：权重被强力压小，模型偏向"保守"，可能欠拟合。');
    if (cfg.model === 'mlp') msgs.push('<b>没有使用图结构</b>：MLP 只看每个节点自己的噪声特征，测试准确率明显低于 GCN。这正是 GNN 的价值所在。');
    if (cfg.model === 'gcn' && cfg.layers >= 5) msgs.push('<b>层数较深</b>：多次平滑后不同类别的表示趋于相同（过平滑），且更难训练。');
    if (last.trainAcc === 1 && recentTrainLoss < 0.05 && recentGap > 0.08 && cfg.lr < 0.1) msgs.push(`<b>过拟合迹象</b>：训练 loss 接近 0、训练准确率 100%，但测试准确率低了约 ${Math.round(recentGap * 100)}%，也低于第 ${best.epoch} 轮的最高值。模型开始"背"训练集了。可以加大 dropout / weight_decay，或在验证集表现最好时早停。`);
    if (!msgs.length) msgs.push('训练正常：loss 平稳下降，测试准确率稳定。');
    msgs.push(`<span class="muted">测试准确率最高出现在第 ${best.epoch} 轮（${fmt(best.testAcc * 100, 1)}%）。实际项目中应该用<b>验证集</b>来决定何时停止，而不是测试集。</span>`);
    tip.innerHTML = msgs.join('<br>');
  }

  function reset() {
    cancelAnimationFrame(run.raf); run.running = false;
    run.trainer = new GCNTrainer({ useGraph: cfg.model === 'gcn', layers: cfg.layers, hidden: cfg.hidden, dropout: cfg.dropout, lr: cfg.lr, wd: cfg.wd, seed: cfg.seed }, data);
    run.hist = [];
    run.last = run.trainer.evaluate();
    startBtn.textContent = '▶ 开始训练';
    renderAll(); diagnose();
  }
  function loop() {
    if (!run.running) return;
    for (let k = 0; k < run.speed && run.trainer.epoch < cfg.epochs; k++) {
      const r = run.trainer.step();
      run.last = r;
      run.hist.push({ epoch: r.epoch, trainLoss: r.trainLoss, testLoss: r.testLoss, trainAcc: r.trainAcc, testAcc: r.testAcc });
    }
    renderAll();
    if (run.trainer.epoch >= cfg.epochs) { run.running = false; startBtn.textContent = '↻ 重新训练'; diagnose(); return; }
    run.raf = requestAnimationFrame(loop);
  }

  /* ----- 控件 ----- */
  const startBtn = h('button', { class: 'btn primary', type: 'button', text: '▶ 开始训练' });
  startBtn.addEventListener('click', () => {
    if (run.running) { run.running = false; startBtn.textContent = '▶ 继续'; diagnose(); return; }
    if (run.trainer.epoch >= cfg.epochs) reset();
    run.running = true; startBtn.textContent = '⏸ 暂停';
    run.raf = requestAnimationFrame(loop);
  });
  const resetBtn = h('button', { class: 'btn', type: 'button', text: '重置' });
  resetBtn.addEventListener('click', reset);

  const lrExp = v => Math.pow(10, v);
  const fmtLr = v => { const x = lrExp(v); return x >= 0.01 ? +x.toPrecision(2) + '' : x.toExponential(1); };
  const ctrls = {
    model: UI.seg('模型', [{ value: 'gcn', label: 'GCN' }, { value: 'mlp', label: 'MLP（不用图）' }], cfg.model, v => { cfg.model = v; reset(); }),
    layers: UI.slider('num_layers', '', { min: 1, max: 8, step: 1, value: cfg.layers }, v => { cfg.layers = v; reset(); }),
    hidden: UI.slider('hidden_channels', '', { min: 0, max: HIDDEN.length - 1, step: 1, value: HIDDEN.indexOf(cfg.hidden), format: v => HIDDEN[v] }, v => { cfg.hidden = HIDDEN[v]; reset(); }),
    dropout: UI.slider('dropout', '', { min: 0, max: 0.9, step: 0.1, value: cfg.dropout, format: v => v.toFixed(1) }, v => { cfg.dropout = v; reset(); }),
    lr: UI.slider('lr', '', { min: -4, max: 0, step: 0.1, value: Math.log10(cfg.lr), format: fmtLr }, v => { cfg.lr = +fmtLr(v); reset(); }),
    wd: UI.slider('weight_decay', '', { min: 0, max: WD.length - 1, step: 1, value: WD.indexOf(cfg.wd), format: v => (WD[v] === 0 ? '0' : WD[v].toExponential(0)) }, v => { cfg.wd = WD[v]; reset(); }),
    epochs: UI.slider('epochs', '', { min: 50, max: 500, step: 50, value: cfg.epochs }, v => { cfg.epochs = v; if (run.trainer.epoch > v) reset(); else { renderAll(); } }),
    seed: UI.seg('随机种子', [1, 2, 3], cfg.seed, v => { cfg.seed = +v; reset(); })
  };
  const speed = UI.seg('速度', [{ value: 1, label: '慢' }, { value: 2, label: '中' }, { value: 8, label: '快' }], run.speed, v => { run.speed = +v; });
  $('#train-controls').append(h('div', { class: 'btn-row' }, [startBtn, resetBtn]), ...Object.values(ctrls), speed);

  function applyPreset(p) {
    Object.assign(cfg, DEFAULT, p);
    ctrls.model.set(cfg.model);
    ctrls.layers.set(cfg.layers);
    ctrls.hidden.set(HIDDEN.indexOf(cfg.hidden));
    ctrls.dropout.set(cfg.dropout);
    ctrls.lr.set(Math.log10(cfg.lr));
    ctrls.wd.set(WD.indexOf(cfg.wd));
    ctrls.epochs.set(cfg.epochs);
    ctrls.seed.set(cfg.seed);
    reset();
    run.running = true; startBtn.textContent = '⏸ 暂停';
    run.raf = requestAnimationFrame(loop);
  }
  const PRESETS = [
    ['推荐默认', {}],
    ['不用图（MLP）', { model: 'mlp' }],
    ['学习率过大', { lr: 0.5 }],
    ['学习率过小', { lr: 0.0001 }],
    ['去掉正则化', { hidden: 64, dropout: 0, wd: 0, epochs: 400 }],
    ['层数过深', { layers: 8 }],
    ['hidden 过小', { hidden: 2, dropout: 0 }]
  ];
  $('#train-presets').append(h('span', { class: 'ctrl', html: '<b>一键对比：</b>' }),
    ...PRESETS.map(([name, p]) => { const b = h('button', { class: 'btn', type: 'button', text: name }); b.addEventListener('click', () => applyPreset(p)); return b; }));

  reset();

  renderParams($('#train-params'), [
    { name: 'num_layers', demo: true, where: '模型结构：堆叠几层 GNN', mean: '决定感受野（能看到几跳邻居）。见第 6 节。', up: '看得更远，但容易过平滑、更难训练、更慢。', down: '只利用很近的邻居信息；1 层 GCN 相当于线性模型。', typical: '节点分类 2（最常用）~3；图分类 3~5' },
    { name: 'hidden_channels', demo: true, where: '模型结构：隐藏层维度', mean: '中间层每个节点表示向量的长度，即模型的"宽度"。', up: '容量更大，能拟合更复杂的模式；但参数多，小数据集上容易过拟合，训练更慢。', down: '容量不足，欠拟合（训练准确率也不高）。', typical: '16（GCN 论文在 Cora 上）、64、128、256' },
    { name: 'dropout', demo: true, where: 'F.dropout / torch.nn.Dropout', mean: '训练时以概率 p 随机把部分特征置 0（其余乘 1/(1-p)），迫使模型不依赖少数特征，是最常用的防过拟合手段。<code>model.eval()</code> 后自动关闭。', up: '正则化更强；过大会导致欠拟合、曲线抖动。', down: '更容易过拟合。', typical: 'GCN 0.5；GAT 0.6；大数据集 0.1~0.3' },
    { name: 'lr', demo: true, where: '优化器：torch.optim.Adam(lr=...)', mean: '学习率：每次参数更新迈多大的步子。通常是最影响训练结果的超参数。', up: '收敛快，但过大时 loss 震荡甚至发散（NaN）。', down: '稳定但很慢，可能在有限 epoch 内学不完。', typical: 'GCN 0.01；GAT 0.005；大模型 0.001' },
    { name: 'weight_decay', demo: true, where: '优化器：torch.optim.Adam(weight_decay=...)', mean: 'L2 正则：在梯度上加 λ·w，把权重往 0 拉，限制模型复杂度。', up: '正则化更强，防过拟合；过大时欠拟合。', down: '为 0 时没有 L2 约束，小数据集上容易过拟合。', typical: '5e-4（Cora 等小图的经典设置）；大图常为 0', note: '演示中作用于所有权重。PyG 官方示例常只对第一层施加 weight_decay。' },
    { name: 'epochs', demo: true, where: '训练循环', mean: '把整个训练集完整训练多少轮。', up: '训练更充分，但可能过拟合、浪费时间。', down: '可能还没收敛。', typical: '200 左右；配合<b>早停</b>（early stopping）：验证集指标连续若干轮（patience，如 50~100）不提升就停止，并恢复最佳模型。' },
    { name: 'optimizer', where: '优化器', mean: '参数更新的算法。GNN 中最常用 Adam（自适应学习率，对 lr 不太敏感）。', typical: 'Adam / AdamW' },
    { name: 'activation', where: '层与层之间的激活函数', mean: '引入非线性。没有激活函数时，多层 GNN 等价于一层线性变换加多次平滑。', typical: 'ReLU（GCN、SAGE、GIN）；ELU（GAT 原论文）' },
    { name: 'batch_size', where: 'DataLoader / NeighborLoader', mean: '图分类：每批多少张图；大图节点分类：每批多少个种子节点。小图（如本页、Cora）通常整图训练，不需要这个参数。', up: '训练更稳定、更快（GPU 并行），显存占用大。', down: '梯度噪声大，但有时泛化更好。', typical: '图分类 32 / 64 / 128；NeighborLoader 512 / 1024' }
  ]);
  renderTex($('#train'));
});
