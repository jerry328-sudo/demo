/* =========================================================
 * basics.js —— 第 1 节：图的表示 + 消息传递动画
 * ========================================================= */
'use strict';

registerSection('basics', () => {
  /* ---------- 1.1 图结构 ---------- */
  const gv = new GraphView($('#basics-graph'), TOY);
  gv.onHover = i => `<div class="t-title">节点 ${i}（社区 ${'AB'[TOY.nodes[i].group]}）</div>特征 x = ${fmtVec(TOY.X[i], 1)}<br>度 d = ${TOY.deg[i]}<br>邻居：${TOY.nbrs[i].join(', ')}`;

  /* ---------- 邻接矩阵 ---------- */
  let adjMode = 'A';
  const adjCtrl = UI.seg(null, [
    { value: 'A', label: 'A（原始）' },
    { value: 'AI', label: 'Â = A + I（加自环）' },
    { value: 'norm', label: 'D̂^-1/2 Â D̂^-1/2（GCN 归一化）' }
  ], adjMode, v => { adjMode = v; drawAdj(); });
  $('#adj-controls').append(adjCtrl);
  const n = TOY.n, cell = 36, off = 26;
  const adjSvg = s('svg', { viewBox: `0 0 ${off + n * cell + 4} ${off + n * cell + 4}`, class: 'viz', style: 'max-width:360px;margin:0 auto' });
  $('#adj-matrix').append(adjSvg);

  function adjValue(i, j) {
    const a = TOY.nbrs[i].includes(j) ? 1 : 0;
    if (adjMode === 'A') return a;
    const ai = a + (i === j ? 1 : 0);
    if (adjMode === 'AI') return ai;
    return ai / Math.sqrt((TOY.deg[i] + 1) * (TOY.deg[j] + 1));
  }
  function drawAdj(hlRow = null) {
    adjSvg.innerHTML = '';
    const maxV = adjMode === 'norm' ? 0.5 : 1;
    for (let k = 0; k < n; k++) {
      s('text', { x: off + k * cell + cell / 2, y: 16, 'text-anchor': 'middle', class: 'axis-title', text: k }, adjSvg);
      s('text', { x: 12, y: off + k * cell + cell / 2 + 4, 'text-anchor': 'middle', class: 'axis-title', text: k }, adjSvg);
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = adjValue(i, j);
      const step = v === 0 ? -1 : clamp(Math.round(v / maxV * 5), 1, 6);
      const fill = step < 0 ? 'var(--surface-2)' : `var(${SEQ_VARS[step]})`;
      const rect = s('rect', { x: off + j * cell + 1, y: off + i * cell + 1, width: cell - 2, height: cell - 2, rx: 4, fill }, adjSvg);
      if (hlRow != null && i !== hlRow && j !== hlRow) rect.style.opacity = 0.35;
      if (v !== 0) s('text', {
        x: off + j * cell + cell / 2, y: off + i * cell + cell / 2 + 4, 'text-anchor': 'middle',
        style: `font-size:${adjMode === 'norm' ? 10.5 : 12}px;fill:${step >= 4 ? '#fff' : 'var(--ink)'};pointer-events:none;font-variant-numeric:tabular-nums`,
        text: adjMode === 'norm' ? fmt(v, 2) : v
      }, adjSvg);
      rect.addEventListener('mousemove', e => {
        const desc = i === j ? `节点 ${i} 的自环` : (TOY.nbrs[i].includes(j) ? `节点 ${i} 与 ${j} 相连` : `节点 ${i} 与 ${j} 不相连`);
        let extra = '';
        if (adjMode === 'norm' && v !== 0) extra = `<br>= 1 / √(${TOY.deg[i] + 1} × ${TOY.deg[j] + 1})`;
        Tooltip.show(`<div class="t-title">第 ${i} 行，第 ${j} 列</div>${desc}<br>值 = ${fmt(v, 3)}${extra}`, e);
        gv.resetStyle();
        if (i !== j && TOY.nbrs[i].includes(j)) gv.styleEdge(i, j, { stroke: 'var(--accent)', width: 4 });
        gv.select(i);
      });
      rect.addEventListener('mouseleave', () => { Tooltip.hide(); gv.resetStyle(); });
    }
    $('#adj-caption').textContent = {
      A: '第 i 行第 j 列 = 1 表示 i 与 j 相连',
      AI: '对角线变成 1：每个节点"连向自己"',
      norm: '每个位置除以 √(d̂ᵢ·d̂ⱼ)，GCN 真正用的矩阵'
    }[adjMode];
  }
  drawAdj();
  gv.onClick = i => drawAdj(i);

  /* ---------- 特征矩阵 ---------- */
  $('#feat-table').innerHTML = `<table><tr><th>节点</th><th>维度 0</th><th>维度 1</th><th>社区</th><th>度</th></tr>${TOY.X.map((x, i) => `<tr><td>${chip(i)}</td><td>${fmt(x[0], 1)}</td><td>${fmt(x[1], 1)}</td><td>${'AB'[TOY.nodes[i].group]}</td><td>${TOY.deg[i]}</td></tr>`).join('')
    }</table><p class="small muted" style="margin-bottom:0">社区 A 的节点"维度 0"较大，社区 B 的节点"维度 1"较大。真实数据中特征可能是词袋向量、原子类型等，维度可达上千。</p>`;

  /* ---------- edge_index ---------- */
  const src = [], dst = [];
  TOY.edges.forEach(([a, b]) => { src.push(a, b); dst.push(b, a); });
  const pad = v => String(v).padStart(2, ' ');
  $('#edge-index').innerHTML = `<div>源节点   [${src.map(pad).join(',')}]</div><div>目标节点 [${dst.map(pad).join(',')}]</div>`.replace(/ /g, '&nbsp;');

  /* ---------- 1.2 消息传递动画 ---------- */
  const mp = { target: 3, phase: 0, all: false, anim: null };
  const mgv = new GraphView($('#mp-graph'), TOY);
  const stepNames = ['① 收集消息', '② 聚合', '③ 更新'];
  $('#mp-steps').innerHTML = stepNames.map((t, k) => `<span class="step" data-k="${k + 1}">${t}</span>`).join('');
  const playBtn = h('button', { class: 'btn primary', type: 'button', text: '▶ 播放' });
  const stepBtn = h('button', { class: 'btn', type: 'button', text: '单步 →' });
  const resetBtn = h('button', { class: 'btn', type: 'button', text: '重置' });
  const allCb = UI.checkbox('所有节点同时更新', null, false, v => { mp.all = v; reset(); });
  $('#mp-controls').append(h('div', { class: 'btn-row' }, [playBtn, stepBtn, resetBtn]), allCb,
    h('span', { class: 'kbd-note', text: '提示：点击图中节点切换目标节点' }));

  const meanNbr = i => scale(TOY.nbrs[i].reduce((acc, j) => add(acc, TOY.X[j]), [0, 0]), 1 / TOY.deg[i]);
  const updated = i => scale(add(TOY.X[i], meanNbr(i)), 0.5);

  function paint() {
    $$('#mp-steps .step').forEach(el => el.classList.toggle('on', +el.dataset.k === mp.phase));
    mgv.resetStyle();
    const targets = mp.all ? TOY.nodes.map((_, i) => i) : [mp.target];
    if (!mp.all) {
      mgv.select(mp.target);
      TOY.nodes.forEach((_, k) => {
        if (k !== mp.target && !TOY.nbrs[mp.target].includes(k)) mgv.nodeEls[k].g.style.opacity = 0.3;
      });
      TOY.nbrs[mp.target].forEach(j => mgv.styleEdge(mp.target, j, { stroke: 'var(--accent)', width: 3 }));
    } else if (mp.phase >= 1) {
      TOY.edges.forEach(([a, b]) => mgv.styleEdge(a, b, { stroke: 'var(--accent)', width: 2.5 }));
    }
    // 特征文字
    TOY.nodes.forEach((nd, k) => {
      const f = mgv.nodeEls[k].feat;
      if (mp.phase === 3 && targets.includes(k)) { f.textContent = fmtVec(updated(k)); f.style.fill = 'var(--accent)'; f.style.fontWeight = 700; }
      else { f.textContent = fmtVec(nd.feat, 1); f.style.fill = ''; f.style.fontWeight = ''; }
    });
    if (mp.phase === 2 && !mp.all) {
      const nd = TOY.nodes[mp.target];
      s('text', { x: nd.x, y: nd.y - 30, class: 'g-elabel', style: 'font-size:13px', text: 'mean ' + fmtVec(meanNbr(mp.target)) }, mgv.gLabels);
    }
    detail();
  }

  function detail() {
    const el = $('#mp-detail');
    if (mp.all) {
      const rows = TOY.nodes.map((_, i) => `<tr><td>${chip(i)}</td><td>${fmtVec(TOY.X[i], 1)}</td><td>${mp.phase >= 2 ? fmtVec(meanNbr(i)) : '…'}</td><td>${mp.phase >= 3 ? `<span class="hl">${fmtVec(updated(i))}</span>` : '…'}</td></tr>`).join('');
      el.innerHTML = `<p style="margin-top:0">${['所有节点都按同样的规则、<b>同时</b>进行计算。注意：计算时每个节点用的都是邻居的<b>旧</b>特征，而不是刚更新过的。',
        '<b>① 收集</b>：每条边在两个方向上各传一条消息（无向图）。',
        '<b>② 聚合</b>：每个节点对收到的消息取平均。',
        '<b>③ 更新</b>：每个节点得到新特征，这一层结束。下一层会在新特征上重复同样的过程。'][mp.phase]}</p>
        <table><tr><th>节点</th><th>旧特征 x</th><th>邻居平均</th><th>新特征 h'</th></tr>${rows}</table>`;
      return;
    }
    const i = mp.target, nb = TOY.nbrs[i];
    const msgRows = nb.map(j => `<tr><td>${chip(j)} → ${i}</td><td>${fmtVec(TOY.X[j], 1)}</td></tr>`).join('');
    const parts = [
      `<p style="margin-top:0">目标节点：${chip(i)}，它有 <b>${nb.length}</b> 个邻居：${nb.map(j => chip(j)).join('')}</p>
       <p>点击 <b>▶ 播放</b> 观看一层消息传递的三个步骤。</p>`,
      `<p style="margin-top:0"><b>① 收集</b>：每个邻居 j 把自己的特征作为"消息"发给节点 ${i}。</p>
       <table><tr><th>消息方向</th><th>消息内容 x<sub>j</sub></th></tr>${msgRows}</table>
       <p class="small muted">真实模型里消息通常是 W·x<sub>j</sub>（先做线性变换），GAT 等模型还会给每条消息乘一个权重。</p>`,
      `<p style="margin-top:0"><b>② 聚合</b>：把 ${nb.length} 条消息合并成一条。这里用<b>平均</b>：</p>
       <div class="res">(${nb.map(j => fmtVec(TOY.X[j], 1)).join(' + ')}) / ${nb.length} = <b>${fmtVec(meanNbr(i))}</b></div>
       <p class="small muted">邻居数量不固定，所以聚合函数必须能处理任意个输入，并且与顺序无关。</p>`,
      `<p style="margin-top:0"><b>③ 更新</b>：结合节点自己的旧特征得到新特征。这里用最简单的规则"自己与邻居平均各占一半"：</p>
       <div class="res">h'<sub>${i}</sub> = 0.5 × ${fmtVec(TOY.X[i], 1)} + 0.5 × ${fmtVec(meanNbr(i))} = <b class="hl">${fmtVec(updated(i))}</b></div>
       <p>节点 ${i} 的新特征"吸收"了邻居的信息。${TOY.nodes[i].group === 0 && nb.some(j => TOY.nodes[j].group === 1) ? '它有来自另一个社区的邻居，所以特征向另一社区偏移了一些。' : ''}</p>
       <p class="small muted">真实模型中，这一步就是各个 GNN 的区别所在：GCN 用度数归一化加权，GAT 用注意力加权，GraphSAGE 对自己和邻居用不同的 W，GIN 用求和 + MLP。</p>`
    ];
    el.innerHTML = parts[mp.phase];
  }

  function animateParticles(done) {
    const pairs = mp.all ? TOY.edges.flatMap(([a, b]) => [[a, b], [b, a]]) : TOY.nbrs[mp.target].map(j => [j, mp.target]);
    const dots = pairs.map(([a]) => s('circle', { r: 6, fill: groupColor(TOY.nodes[a].group), stroke: 'var(--surface)', 'stroke-width': 1.5 }, mgv.gOverlay));
    const t0 = performance.now(), dur = 1100;
    cancelAnimationFrame(mp.anim);
    const tick = now => {
      const t = clamp((now - t0) / dur, 0, 1), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      pairs.forEach(([a, b], k) => {
        const A = TOY.nodes[a], B = TOY.nodes[b];
        dots[k].setAttribute('cx', A.x + (B.x - A.x) * e);
        dots[k].setAttribute('cy', A.y + (B.y - A.y) * e);
      });
      if (t < 1) mp.anim = requestAnimationFrame(tick);
      else { mgv.gOverlay.innerHTML = ''; done && done(); }
    };
    mp.anim = requestAnimationFrame(tick);
  }

  let playing = false;
  function goPhase(p, then) {
    mp.phase = p; paint();
    if (p === 1) animateParticles(then);
    else if (then) setTimeout(then, 1200);
  }
  function play() {
    if (playing) return;
    playing = true; playBtn.disabled = stepBtn.disabled = true;
    goPhase(1, () => goPhase(2, () => goPhase(3, () => { playing = false; playBtn.disabled = stepBtn.disabled = false; })));
  }
  function reset() {
    cancelAnimationFrame(mp.anim); mgv.gOverlay.innerHTML = '';
    playing = false; playBtn.disabled = stepBtn.disabled = false;
    mp.phase = 0; paint();
  }
  playBtn.addEventListener('click', play);
  stepBtn.addEventListener('click', () => {
    if (playing) return;
    const next = mp.phase >= 3 ? 1 : mp.phase + 1;
    mp.phase = next; paint();
    if (next === 1) animateParticles();
  });
  resetBtn.addEventListener('click', reset);
  mgv.onClick = i => { if (playing) return; mp.target = i; if (mp.all) { mp.all = false; allCb.input.checked = false; } reset(); };
  mgv.onHover = i => `节点 ${i}：x = ${fmtVec(TOY.X[i], 1)}`;
  paint();
});
