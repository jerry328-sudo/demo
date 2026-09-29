/* =========================================================
 * depth.js —— 第 6 节：感受野 + 过平滑
 * ========================================================= */
'use strict';

let SBM = null;
const getSBM = () => (SBM = SBM || makeSBM(7));

registerSection('depth', () => {
  /* ---------- 6.1 感受野 ---------- */
  const rf = { sel: 0, k: 2 };
  const gv = new GraphView($('#rf-graph'), TOY);
  const HOP_STEPS = [6, 4, 3, 2, 1];   // 跳数越远颜色越浅
  function bfs(src) {
    const d = new Array(TOY.n).fill(Infinity); d[src] = 0;
    const q = [src];
    while (q.length) { const u = q.shift(); TOY.nbrs[u].forEach(v => { if (d[v] === Infinity) { d[v] = d[u] + 1; q.push(v); } }); }
    return d;
  }
  function render() {
    const d = bfs(rf.sel);
    gv.resetStyle(); gv.select(rf.sel);
    TOY.nodes.forEach((_, k) => {
      const idText = gv.nodeEls[k].g.querySelector('text.id');
      if (d[k] <= rf.k) {
        const step = HOP_STEPS[Math.min(d[k], 4)];
        gv.nodeFill(k, `var(${SEQ_VARS[step]})`);
        idText.style.fill = step >= 3 ? '#fff' : '#0b0b0b';
      } else {
        gv.nodeFill(k, 'var(--node-idle)');
        idText.style.fill = 'var(--muted)';
      }
    });
    TOY.edges.forEach(([a, b]) => {
      if (Math.min(d[a], d[b]) < rf.k) gv.styleEdge(a, b, { stroke: 'var(--accent)', width: 3 });
    });
    const byHop = [];
    d.forEach((v, k) => { if (v <= rf.k) (byHop[v] = byHop[v] || []).push(k); });
    const covered = d.filter(v => v <= rf.k).length;
    $('#rf-detail').innerHTML = `
      <table><tr><th>跳数</th><th>节点</th><th>在第几层"被看到"</th></tr>
      ${byHop.map((l, hop) => `<tr><td>${hop}</td><td>${l.map(k => chip(k)).join('')}</td><td>${hop === 0 ? '自身（第 0 层）' : `第 ${hop} 层起`}</td></tr>`).join('')}</table>
      <div class="res">${rf.k} 层 GNN 之后，节点 ${rf.sel} 的表示依赖 <b>${covered}</b> / ${TOY.n} 个节点。${covered === TOY.n ? '已经覆盖整张图。' : ''}</div>
      <p class="small muted">真实图中，这个数字随层数<b>指数增长</b>：如果平均每个节点有 10 个邻居，2 层约涉及 100 个节点，3 层约 1000 个。这就是 GraphSAGE 需要"邻居采样"的原因，也是层数不宜过多的原因之一。</p>`;
  }
  gv.onClick = i => { rf.sel = i; render(); };
  gv.onHover = i => `节点 ${i}<br><span class="muted">点击设为中心节点</span>`;
  $('#rf-controls').append(
    UI.slider('num_layers', '层数', { min: 0, max: 4, step: 1, value: rf.k }, v => { rf.k = v; render(); }),
    h('span', { class: 'kbd-note', text: '颜色越深 = 离中心越近；紫色边 = 信息传递经过的边' })
  );
  render();

  /* ---------- 6.2 过平滑 ---------- */
  const G = getSBM();
  const P = gcnPropagator(G.n, G.edges);
  const KMAX = 40;
  const hist = [G.X2];
  for (let k = 1; k <= KMAX; k++) {
    const X = hist[k - 1];
    hist.push(X.map((_, i) => P[i].reduce((acc, [j, w]) => add(acc, scale(X[j], w)), [0, 0])));
  }
  function ratio(X) {
    let intra = 0, ni = 0, inter = 0, ne = 0;
    for (let i = 0; i < G.n; i++) for (let j = i + 1; j < G.n; j++) {
      const d = Math.hypot(X[i][0] - X[j][0], X[i][1] - X[j][1]);
      if (G.y[i] === G.y[j]) { intra += d; ni++; } else { inter += d; ne++; }
    }
    return (inter / ne) / (intra / ni);
  }
  const ratios = hist.map(ratio);
  const xs = hist.flat().map(v => v[0]), ys = hist.flat().map(v => v[1]);
  const padR = (a, b) => [a - (b - a) * 0.05, b + (b - a) * 0.05];
  const domain = [padR(Math.min(...xs), Math.max(...xs)), padR(Math.min(...ys), Math.max(...ys))];

  const sc = new FeatureScatter($('#os-scatter'), { width: 440, height: 330 });
  const chart = new LineChart($('#os-chart'), { width: 460, height: 260, xLabel: '传播层数 k', yLabel: '类间 / 类内 距离', yDomain: [0, Math.ceil(Math.max(...ratios) * 2) / 2], xDomain: [0, KMAX] });
  const os = { k: 0, timer: null };
  const best = ratios.indexOf(Math.max(...ratios));
  function renderOS() {
    const X = hist[os.k];
    sc.update(X.map((v, i) => ({ id: i, to: v, group: G.y[i], tip: `节点 ${i}（社区 ${'ABC'[G.y[i]]}）<br>${fmtVec(v)}` })), { domain });
    chart.update([{ name: '可区分度', color: 'var(--c1)', values: ratios.map((r, k) => [k, r]) }], os.k);
    $('#os-k').innerHTML = `k = <b>${os.k}</b>，可区分度 = <b>${fmt(ratios[os.k], 2)}</b>${os.k === best ? '（最高）' : ''}`;
  }
  const slider = UI.slider('k', '传播层数', { min: 0, max: KMAX, step: 1, value: 0 }, v => { os.k = v; renderOS(); });
  const play = h('button', { class: 'btn primary', type: 'button', text: '▶ 自动播放' });
  play.addEventListener('click', () => {
    if (os.timer) { clearInterval(os.timer); os.timer = null; play.textContent = '▶ 自动播放'; return; }
    if (os.k >= KMAX) os.k = 0;
    play.textContent = '⏸ 暂停';
    os.timer = setInterval(() => {
      os.k++; slider.set(os.k); renderOS();
      if (os.k >= KMAX) { clearInterval(os.timer); os.timer = null; play.textContent = '▶ 自动播放'; }
    }, os.k < 6 ? 450 : 160);
  });
  $('#os-controls').append(slider, play,
    h('span', { class: 'kbd-note', text: `提示：k = ${best} 左右可区分度最高，之后持续下降` }));
  renderOS();
});
