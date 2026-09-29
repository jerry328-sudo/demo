/* =========================================================
 * models.js —— GCN / GraphSAGE / GAT / GIN 四个模型页
 * 所有数值都在示例小图上真实计算（W 取单位矩阵）
 * ========================================================= */
'use strict';

/* ---------------- 通用：模型探索器 ---------------- */
function makeExplorer(prefix, onRender, sel = 3) {
  const ex = { sel };
  ex.gv = new GraphView($(`#${prefix}-graph`), TOY);
  ex.sc = new FeatureScatter($(`#${prefix}-scatter`));
  ex.gv.onClick = i => { ex.sel = i; ex.render(); };
  ex.gv.onHover = i => `节点 ${i}：x = ${fmtVec(TOY.X[i], 1)}，度 = ${TOY.deg[i]}<br><span class="muted">点击查看它的计算</span>`;
  ex.render = () => {
    ex.gv.resetStyle();
    ex.gv.select(ex.sel);
    $(`#${prefix}-sel`).innerHTML = `目标节点 ${chip(ex.sel)}`;
    onRender(ex);
  };
  return ex;
}

/**
 * 在图上画出"指向选中节点"的各条消息及其权重
 * items: [{ j, w, label, dash, dim }]；j === i 表示自环
 */
function drawIncoming(gv, i, items) {
  const maxW = Math.max(...items.filter(it => !it.dim).map(it => Math.abs(it.w)), 1e-9);
  TOY.nodes.forEach((_, k) => {
    if (k !== i && !items.some(it => it.j === k)) gv.nodeEls[k].g.style.opacity = 0.3;
  });
  items.forEach(it => {
    const width = it.dim ? 1.4 : 1.5 + 6.5 * Math.abs(it.w) / maxW;
    const stroke = it.dim ? 'var(--muted)' : 'var(--accent)';
    if (it.j === i) gv.selfLoop(i, { stroke, width, dash: it.dash }, it.label);
    else {
      gv.styleEdge(i, it.j, { stroke, width, dash: it.dash });
      gv.edgeLabel(it.j, i, it.label, 0.45);
    }
  });
}

/** 所有节点的输入 → 输出 散点 */
function scatterAll(sc, outs, sel, opts = {}) {
  sc.update(TOY.nodes.map((nd, i) => ({
    id: i, from: TOY.X[i], to: outs[i], group: nd.group, strong: i === sel, label: i
  })), opts);
}

const vecCell = v => `<span class="mono">${fmtVec(v)}</span>`;

/* =========================================================
 * GCN
 * ========================================================= */
registerSection('gcn', () => {
  const st = { addSelfLoops: true, improved: false, normalize: true };

  function coefs(i) {
    const self = st.normalize && st.addSelfLoops;
    const fill = st.improved ? 2 : 1;
    const dh = k => TOY.deg[k] + (self ? fill : 0);
    const rows = TOY.nbrs[i].map(j => ({
      j, coef: st.normalize ? 1 / Math.sqrt(dh(i) * dh(j)) : 1,
      how: st.normalize ? `1/√(${dh(i)}×${dh(j)})` : '1'
    }));
    if (self) rows.unshift({ j: i, self: true, coef: fill / dh(i), how: `${fill}/√(${dh(i)}×${dh(i)})` });
    return { rows, dh };
  }
  const outOf = i => coefs(i).rows.reduce((acc, r) => add(acc, scale(TOY.X[r.j], r.coef)), [0, 0]);

  const cSelf = UI.checkbox('加自环', 'add_self_loops', st.addSelfLoops, v => { st.addSelfLoops = v; ex.render(); });
  const cImp = UI.checkbox('自环权重 = 2', 'improved', st.improved, v => { st.improved = v; ex.render(); });
  const cNorm = UI.checkbox('对称归一化', 'normalize', st.normalize, v => { st.normalize = v; ex.render(); });
  $('#gcn-controls').append(cNorm, cSelf, cImp, h('span', { class: 'kbd-note', id: 'gcn-note' }));

  const ex = makeExplorer('gcn', ex => {
    const i = ex.sel, { rows, dh } = coefs(i);
    cSelf.classList.toggle('disabled', !st.normalize); cSelf.input.disabled = !st.normalize;
    cImp.classList.toggle('disabled', !(st.normalize && st.addSelfLoops)); cImp.input.disabled = !(st.normalize && st.addSelfLoops);
    $('#gcn-note').textContent = !st.normalize ? 'PyG 只在归一化时添加自环：normalize=False 时不加自环（新版本会直接报错提示）'
      : (!st.addSelfLoops ? 'improved 只改变自环权重，没有自环时它不起作用' : '');

    drawIncoming(ex.gv, i, rows.map(r => ({ j: r.j, w: r.coef, label: fmt(r.coef, 2) })));
    const out = outOf(i);
    const body = rows.map(r => `<tr><td>${chip(r.j)}${r.self ? '<span class="tag">自环</span>' : ''}</td>
      <td>${st.normalize ? dh(r.j) : '—'}</td><td class="mono small">${r.how}</td><td><b>${fmt(r.coef, 3)}</b></td>
      <td>${vecCell(TOY.X[r.j])}</td><td>${vecCell(scale(TOY.X[r.j], r.coef))}</td></tr>`).join('');
    const sumC = rows.reduce((a, r) => a + r.coef, 0);
    $('#gcn-detail').innerHTML = `
      <table><tr><th>来源 j</th><th>d̂ⱼ</th><th>系数公式</th><th>系数 cᵢⱼ</th><th>xⱼ</th><th>cᵢⱼ · xⱼ</th></tr>${body}
      <tr class="sum"><td>合计</td><td></td><td></td><td>${fmt(sumC, 3)}</td><td></td><td>${vecCell(out)}</td></tr></table>
      <div class="res">h'<sub>${i}</sub> = <b>${fmtVec(out)}</b> <span class="muted small">（W = I，未加 bias）</span></div>
      <p class="small muted">${st.normalize
        ? `节点 ${i} 自身 d̂ = ${dh(i)}。系数之和 ${fmt(sumC, 2)} ${Math.abs(sumC - 1) < 0.08 ? '接近 1，相当于"加权平均"' : '不严格等于 1：对称归一化不是真正的平均，度数小的节点系数和偏大，度数大的偏小'}。`
        : '没有归一化：每个邻居权重都是 1，结果就是邻居特征直接求和，数值随度数增大。'}</p>`;
    scatterAll(ex.sc, TOY.nodes.map((_, k) => outOf(k)), i);
  }, 6);
  ex.render();

  renderParams($('#gcn-params'), [
    { name: 'in_channels', def: '必填', mean: '输入特征的维度，即每个节点特征向量的长度。', typical: '由数据决定（如 Cora 为 1433）；设为 <code>-1</code> 可让 PyG 在第一次前向传播时自动推断。', note: '不是"调"出来的，第二层起等于上一层的输出维度。' },
    { name: 'out_channels', def: '必填', mean: '输出维度，即这一层给每个节点产生的新表示的长度。中间层的 out_channels 就是常说的 <b>hidden_channels</b>；最后一层通常等于类别数。', up: '表示能力更强，但参数更多、更容易过拟合、更慢。', down: '形成"信息瓶颈"，可能连训练集都拟合不好。', typical: '隐藏层 16 / 64 / 128 / 256' },
    { name: 'normalize', def: 'True', demo: true, mean: '是否做对称归一化 <span class="tex" data-tex="\\hat{D}^{-1/2}\\hat{A}\\hat{D}^{-1/2}"></span>（同时决定是否加自环）。', on: '邻居消息按度数加权，结果近似"加权平均"，数值稳定。', off: '直接对邻居求和，度数大的节点数值会很大，训练不稳定。适用于你已经提前把边权归一化好的情况。', typical: '保持 True' },
    { name: 'add_self_loops', def: 'True', demo: true, mean: '是否给每个节点加一条指向自己的边，让节点在聚合时<b>包含自身特征</b>。', on: '新表示 = 自己 + 邻居的加权组合。', off: '新表示只来自邻居，自己原有的信息会丢失（除非另外加残差）。', typical: '保持 True；如果图里已经有自环，可设为 False' },
    { name: 'improved', def: 'False', demo: true, mean: '改进版 GCN：自环的权重从 1 变成 2，即 <span class="tex" data-tex="\\hat{A} = A + 2I"></span>。', on: '节点更"看重自己"，自身信息保留得更多，平滑程度降低。', off: '标准 GCN。', typical: 'False；邻居噪声较大时可以试试 True' },
    { name: 'cached', def: 'False', mean: '是否缓存第一次计算出的归一化邻接矩阵，之后直接复用。', on: '省去重复计算，训练更快。<b>只适用于图结构在训练中不变</b>的全图训练（transductive）。', off: '每次前向都重新计算；小批量训练、每次输入不同子图时必须为 False。', typical: 'Cora 等全图训练可设 True' },
    { name: 'bias', def: 'True', mean: '是否在输出上加一个可学习的偏置向量 <span class="tex" data-tex="\\mathbf{b}"></span>。', on: '模型多一点灵活性（整体平移输出）。', off: '后面紧跟 BatchNorm 时偏置是多余的，可以关掉。', typical: 'True' }
  ]);
  renderTex($('#gcn'));
});

/* =========================================================
 * GraphSAGE
 * ========================================================= */
registerSection('sage', () => {
  const st = { aggr: 'mean', root: true, normalize: false, k: 'all', seed: 1 };

  function sampled(i) {
    const nb = TOY.nbrs[i];
    if (st.k === 'all' || nb.length <= st.k) return nb.slice();
    const r = mulberry32(st.seed * 997 + i * 13);
    const pool = nb.slice();
    for (let a = pool.length - 1; a > 0; a--) { const b = Math.floor(r() * (a + 1)); [pool[a], pool[b]] = [pool[b], pool[a]]; }
    return pool.slice(0, st.k).sort((a, b) => a - b);
  }
  function compute(i) {
    const S = sampled(i);
    let agg = [0, 0], winners = null;
    if (st.aggr === 'max') {
      agg = [-Infinity, -Infinity]; winners = [null, null];
      S.forEach(j => TOY.X[j].forEach((v, d) => { if (v > agg[d]) { agg[d] = v; winners[d] = j; } }));
    } else {
      S.forEach(j => { agg = add(agg, TOY.X[j]); });
      if (st.aggr === 'mean') agg = scale(agg, 1 / S.length);
    }
    const pre = st.root ? add(TOY.X[i], agg) : agg;
    const nrm = norm(pre);
    const out = st.normalize && nrm > 0 ? scale(pre, 1 / nrm) : pre;
    return { S, agg, winners, pre, nrm, out };
  }

  const resample = h('button', { class: 'btn', type: 'button', text: '🎲 重新采样' });
  resample.addEventListener('click', () => { st.seed++; ex.render(); });
  $('#sage-controls').append(
    UI.seg('aggr', ['mean', 'max', 'sum'], st.aggr, v => { st.aggr = v; ex.render(); }),
    UI.checkbox('加上自身项', 'root_weight', st.root, v => { st.root = v; ex.render(); }),
    UI.checkbox('L2 归一化输出', 'normalize', st.normalize, v => { st.normalize = v; ex.render(); }),
    UI.seg('num_neighbors', [{ value: 'all', label: '全部' }, { value: 1, label: '1' }, { value: 2, label: '2' }], st.k, v => { st.k = v === 'all' ? 'all' : +v; ex.render(); }),
    resample
  );

  const ex = makeExplorer('sage', ex => {
    const i = ex.sel, r = compute(i), S = r.S;
    const items = TOY.nbrs[i].map(j => {
      const inS = S.includes(j);
      if (!inS) return { j, w: 0, label: '未采样', dash: '5 4', dim: true };
      let label, w = 1;
      if (st.aggr === 'mean') { w = 1 / S.length; label = `1/${S.length}`; }
      else if (st.aggr === 'sum') label = '1';
      else {
        const dims = [0, 1].filter(d => r.winners[d] === j);
        label = dims.length ? 'max: 维' + dims.join(',') : '未胜出';
        w = dims.length ? 1 : 0.15;
      }
      return { j, w, label };
    });
    if (st.root) items.push({ j: i, w: st.aggr === 'mean' ? 1 : 1, label: 'W₁ 自身' });
    drawIncoming(ex.gv, i, items);

    const rows = TOY.nbrs[i].map(j => {
      const inS = S.includes(j);
      const x = TOY.X[j];
      const cells = st.aggr === 'max' && inS
        ? x.map((v, d) => r.winners[d] === j ? `<span class="hl">${fmt(v)}</span>` : fmt(v)).join(', ')
        : x.map(v => fmt(v)).join(', ');
      return `<tr class="${inS ? '' : 'dim'}"><td>${chip(j)}</td><td class="mono">[${cells}]</td><td>${inS ? '已采样' : '未采样（本轮忽略）'}</td></tr>`;
    }).join('');
    const aggName = { mean: '平均', max: '逐维取最大', sum: '求和' }[st.aggr];
    $('#sage-detail').innerHTML = `
      <table><tr><th>邻居 j</th><th>xⱼ</th><th>采样</th></tr>${rows}
      <tr class="sum"><td>AGG</td><td>${vecCell(r.agg)}</td><td>${aggName}（${S.length} 个邻居）</td></tr></table>
      <table style="margin-top:8px">
        <tr><td>自身项 W₁·x<sub>${i}</sub></td><td>${st.root ? vecCell(TOY.X[i]) : '<span class="muted">root_weight=False，不加</span>'}</td></tr>
        <tr><td>邻居项 W₂·AGG</td><td>${vecCell(r.agg)}</td></tr>
        <tr class="sum"><td>相加</td><td>${vecCell(r.pre)}</td></tr>
        ${st.normalize ? `<tr><td>除以长度 ‖h‖ = ${fmt(r.nrm, 3)}</td><td>${vecCell(r.out)}</td></tr>` : ''}
      </table>
      <div class="res">h'<sub>${i}</sub> = <b>${fmtVec(r.out)}</b></div>
      ${st.k !== 'all' && TOY.deg[i] > st.k ? `<p class="small muted">节点 ${i} 有 ${TOY.deg[i]} 个邻居，本轮只随机采样了 ${st.k} 个。点"重新采样"看看结果如何变化。</p>` : ''}`;
    $('#sage-scatter-note').textContent = st.normalize ? '虚线圆 = 单位圆' : '';
    scatterAll(ex.sc, TOY.nodes.map((_, k) => compute(k).out), i, { unitCircle: st.normalize });
  });
  ex.render();

  renderParams($('#sage-params'), [
    { name: 'in_channels', def: '必填', where: 'SAGEConv', mean: '输入特征维度。也可以传一个元组 <code>(源节点维度, 目标节点维度)</code>，用于二部图（如用户 - 商品）。', typical: '由数据决定，或设为 -1 自动推断' },
    { name: 'out_channels', def: '必填', where: 'SAGEConv', mean: '输出表示的维度。', up: '容量更大，更慢，更易过拟合。', down: '信息瓶颈。', typical: '64 / 128 / 256' },
    { name: 'aggr', def: "'mean'", where: 'SAGEConv', demo: true, mean: '邻居的聚合函数。常用 <code>"mean"</code>、<code>"max"</code>、<code>"sum"</code>，也支持 <code>"lstm"</code> 等更复杂的聚合器。', note: '<b>mean</b>：平稳，对度数不敏感；<b>max</b>：抓住邻居中最突出的特征；<b>sum</b>：保留"有几个邻居"的信息，但数值随度数增长。', typical: "'mean'" },
    { name: 'root_weight', def: 'True', where: 'SAGEConv', demo: true, mean: '是否加上"自身"这条独立通道 <span class="tex" data-tex="\\mathbf{W}_1\\mathbf{x}_i"></span>。', on: '自己和邻居分开学习权重，保留自身信息。', off: '输出只由邻居决定。', typical: 'True' },
    { name: 'normalize', def: 'False', where: 'SAGEConv', demo: true, mean: '是否对输出做 L2 归一化，使每个节点的输出向量长度为 1。', on: '只保留方向，所有节点表示在同一尺度上。常用于无监督训练节点嵌入（再用余弦相似度比较）。', off: '保留向量长度信息。', typical: '有监督分类 False；无监督嵌入 True' },
    { name: 'project', def: 'False', where: 'SAGEConv', mean: '聚合之前，先对每个邻居的特征做一次"线性变换 + ReLU"。对应原论文中的 pooling 聚合器。', on: '聚合器更灵活，参数更多。', off: '直接聚合原始特征。', typical: 'False' },
    { name: 'bias', def: 'True', where: 'SAGEConv', mean: '是否加可学习偏置。', typical: 'True' },
    { name: 'num_neighbors', def: '必填', where: 'NeighborLoader（数据加载器参数）', demo: true, mean: '每一层（每一跳）采样多少个邻居，列表长度应等于 GNN 层数。例如 <code>[25, 10]</code> 表示第 1 跳采样 25 个、第 2 跳对每个邻居再采样 10 个。<code>-1</code> 表示取全部邻居。', up: '估计更准确、方差更小，但计算量和显存迅速增长（每跳相乘）。', down: '更快更省显存，但结果随机性更大。', typical: '[25, 10]、[15, 10, 5]' },
    { name: 'batch_size', def: '1', where: 'NeighborLoader', mean: '每个小批量里有多少个"种子节点"（真正要计算输出、计算损失的节点）。它们的多跳邻居会被一起采样进来。', up: '梯度更稳定，GPU 利用率高，但显存占用更大。', down: '更新更频繁、更省显存，但梯度噪声大。', typical: '512 / 1024' }
  ]);
  renderTex($('#sage'));
});

/* =========================================================
 * GAT
 * ========================================================= */
/* 预设的 4 个注意力头（真实模型中这些都是学出来的） */
const GAT_HEADS = [
  { src: [2, -2], dst: [0.5, 0.5], desc: '偏好"维度 0"大的邻居' },
  { src: [-2, 2], dst: [0.5, 0.5], desc: '偏好"维度 1"大的邻居' },
  { src: [3, -3], dst: [-2.5, -2.5], desc: '打分大多为负，用来观察 negative_slope' },
  { src: [1.5, 2.5], dst: [-1.5, 0.5], desc: '混合偏好' }
];

registerSection('gat', () => {
  const st = { heads: 4, head: 0, concat: true, slope: 0.2, selfLoops: true, train: false, p: 0.5, seed: 1 };

  function headCompute(i, k) {
    const hd = GAT_HEADS[k];
    const cand = (st.selfLoops ? [i] : []).concat(TOY.nbrs[i]);
    const rows = cand.map(j => {
      const raw = dot(hd.dst, TOY.X[i]) + dot(hd.src, TOY.X[j]);
      return { j, raw, e: raw > 0 ? raw : st.slope * raw };
    });
    const m = Math.max(...rows.map(r => r.e));
    const Z = rows.reduce((a, r) => a + Math.exp(r.e - m), 0);
    rows.forEach(r => {
      r.alpha = Math.exp(r.e - m) / Z;
      r.dropped = st.train && st.p > 0 && mulberry32(st.seed * 7919 + k * 1009 + i * 31 + r.j)() < st.p;
      r.final = st.train ? (r.dropped ? 0 : r.alpha / (1 - st.p)) : r.alpha;
    });
    const out = rows.reduce((acc, r) => add(acc, scale(TOY.X[r.j], r.final)), [0, 0]);
    return { rows, out };
  }
  function fullOut(i) {
    const outs = Array.from({ length: st.heads }, (_, k) => headCompute(i, k).out);
    return st.concat ? outs.flat() : scale(outs.reduce((a, b) => add(a, b), [0, 0]), 1 / st.heads);
  }

  const headSeg = h('div', { class: 'ctrl' });
  function buildHeadSeg() {
    headSeg.innerHTML = '';
    const seg = UI.seg('查看', Array.from({ length: st.heads }, (_, k) => ({ value: k, label: '头 ' + (k + 1) })), st.head, v => { st.head = +v; ex.render(); });
    headSeg.append(seg);
  }
  const pSlider = UI.slider('dropout', '', { min: 0, max: 0.9, step: 0.1, value: st.p, format: v => v.toFixed(1) }, v => { st.p = v; ex.render(); });
  const resample = h('button', { class: 'btn', type: 'button', text: '🎲 重新采样 dropout' });
  resample.addEventListener('click', () => { st.seed++; ex.render(); });
  $('#gat-controls').append(
    UI.slider('heads', '', { min: 1, max: 4, step: 1, value: st.heads }, v => { st.heads = v; st.head = Math.min(st.head, v - 1); buildHeadSeg(); ex.render(); }),
    headSeg,
    UI.checkbox('拼接多头', 'concat', st.concat, v => { st.concat = v; ex.render(); }),
    UI.slider('negative_slope', '', { min: 0, max: 1, step: 0.05, value: st.slope, format: v => v.toFixed(2) }, v => { st.slope = v; ex.render(); }),
    UI.checkbox('', 'add_self_loops', st.selfLoops, v => { st.selfLoops = v; ex.render(); }),
    UI.checkbox('训练模式（启用 dropout）', null, st.train, v => { st.train = v; ex.render(); }),
    pSlider, resample
  );
  buildHeadSeg();

  const ex = makeExplorer('gat', ex => {
    const i = ex.sel, k = st.head, { rows, out } = headCompute(i, k);
    pSlider.classList.toggle('disabled', !st.train); pSlider.input.disabled = !st.train; resample.disabled = !st.train;
    drawIncoming(ex.gv, i, rows.map(r => ({
      j: r.j, w: r.final, dim: r.dropped, dash: r.dropped ? '5 4' : null,
      label: r.dropped ? '丢弃' : fmt(r.final, 2)
    })));
    const body = rows.map(r => `<tr class="${r.dropped ? 'dim' : ''}"><td>${chip(r.j)}${r.j === i ? '<span class="tag">自环</span>' : ''}</td>
      <td>${vecCell(TOY.X[r.j])}</td><td>${fmt(r.raw)}</td><td>${fmt(r.e)}</td><td><b>${fmt(r.alpha, 3)}</b></td>
      ${st.train ? `<td>${r.dropped ? '丢弃 → 0' : fmt(r.final, 3)}</td>` : ''}<td>${vecCell(scale(TOY.X[r.j], r.final))}</td></tr>`).join('');
    const dimOut = st.concat ? 2 * st.heads : 2;
    const fo = fullOut(i);
    $('#gat-detail').innerHTML = `
      <p style="margin-top:0" class="small">正在查看 <b>头 ${k + 1}</b>：${GAT_HEADS[k].desc}。<span class="muted">a<sub>src</sub> = ${fmtVec(GAT_HEADS[k].src, 1)}，a<sub>dst</sub> = ${fmtVec(GAT_HEADS[k].dst, 1)}</span></p>
      <table><tr><th>邻居 j</th><th>xⱼ</th><th>打分</th><th>LeakyReLU</th><th>α（softmax）</th>${st.train ? '<th>dropout 后</th>' : ''}<th>α · xⱼ</th></tr>${body}
      <tr class="sum"><td>合计</td><td></td><td></td><td></td><td>${fmt(rows.reduce((a, r) => a + r.alpha, 0), 3)}</td>${st.train ? '<td></td>' : ''}<td>${vecCell(out)}</td></tr></table>
      <div class="res">头 ${k + 1} 的输出：<b>${fmtVec(out)}</b><br>
      最终输出（${st.heads} 个头，${st.concat ? '拼接' : '取平均'}）：<b class="mono">${fmtVec(fo)}</b><br>
      <span class="small muted">输出维度 = ${st.concat ? `heads × out_channels = ${st.heads} × 2` : 'out_channels'} = <b>${dimOut}</b></span></div>
      ${st.train ? '<p class="small muted">训练模式：每个注意力系数以概率 p 被置 0，保留下来的除以 (1-p)，保证期望不变。推理时（model.eval()）dropout 自动关闭。</p>' : ''}`;
    $('#gat-scatter-note').textContent = st.concat ? `concat=True：输出是 ${dimOut} 维，这里只画头 ${k + 1} 的 2 维部分` : `concat=False：${st.heads} 个头的平均`;
    const outs = TOY.nodes.map((_, n) => st.concat ? headCompute(n, k).out : fullOut(n));
    scatterAll(ex.sc, outs, i);
  });
  ex.render();

  renderParams($('#gat-params'), [
    { name: 'in_channels', def: '必填', mean: '输入特征维度。如果上一层是 concat=True 的 GAT，这里要填 <code>上一层 heads × out_channels</code>。', typical: '由数据或上一层决定' },
    { name: 'out_channels', def: '必填', mean: '<b>每个头</b>的输出维度。', note: 'concat=True 时这一层真正的输出维度是 heads × out_channels。', typical: '隐藏层 8 × 8 头（原论文 Cora 设置）；或 64' },
    { name: 'heads', def: '1', demo: true, mean: '注意力头的数量。每个头有独立的 W 和 a，各自计算一套注意力，可以关注不同类型的邻居。', up: '注意力更稳定、表达更丰富；但计算量和显存按头数线性增长。', down: '更快，但单个头的注意力可能不稳定。', typical: '隐藏层 4~8；输出层 1（或多个头取平均）' },
    { name: 'concat', def: 'True', demo: true, mean: '多个头的输出如何合并。', on: '拼接：输出维度 = heads × out_channels，保留各头的全部信息。', off: '取平均：输出维度 = out_channels，更稳定。', typical: '隐藏层 True；最后一层（输出类别）False' },
    { name: 'negative_slope', def: '0.2', demo: true, mean: '计算注意力打分时，LeakyReLU 在负半轴的斜率。', up: '趋近 1 时，负分之间的差异被完整保留，注意力分布更"尖锐"。', down: '趋近 0 时，所有负分都被压到接近 0，负分邻居之间变得不可区分，注意力趋于平均。', typical: '0.2，几乎不需要调' },
    { name: 'dropout', def: '0.0', demo: true, mean: '<b>注意力系数</b>的 dropout 概率：训练时随机让节点"忽略"一部分邻居。注意它不同于对特征做 dropout（那通常在层与层之间另外加）。', up: '正则化更强，防止过度依赖某几个邻居；过大时学习困难。', down: '更容易过拟合。', typical: '0.6（原论文 Cora）；大数据集 0~0.2' },
    { name: 'add_self_loops', def: 'True', demo: true, mean: '是否把节点自己也作为一个"邻居"参与注意力计算。', on: '节点可以决定"多听自己一点"。', off: '只关注邻居。', typical: 'True' },
    { name: 'edge_dim', def: 'None', mean: '边特征的维度。设置后，边特征（如化学键类型、距离）也会参与注意力打分。', typical: '没有边特征时为 None' },
    { name: 'bias', def: 'True', mean: '是否加可学习偏置。', typical: 'True' },
    { name: 'GATv2Conv', where: '相关的改进版本', mean: '原始 GAT 的打分是 <span class="tex" data-tex="\\mathbf{a}_{dst}^\\top \\mathbf{W}\\mathbf{x}_i + \\mathbf{a}_{src}^\\top \\mathbf{W}\\mathbf{x}_j"></span>，两部分只是简单相加，所以所有节点对邻居的<b>排序几乎相同</b>（"静态注意力"）。GATv2 把 LeakyReLU 放到两者相加之后、与 a 相乘之前，实现"动态注意力"。', note: '参数与 GATConv 基本一致，可直接替换，通常效果更好。' }
  ]);
  renderTex($('#gat'));
});

/* =========================================================
 * GIN
 * ========================================================= */
registerSection('gin', () => {
  /* ---------- 5.1 区分能力实验 ---------- */
  const B = [1, 0], O = [0, 1];
  const CASES = [
    { title: '情况 1：邻居数量不同', g1: [B, B], g2: [B], note: '两个蓝邻居 vs 一个蓝邻居' },
    { title: '情况 2：比例不同', g1: [B, O], g2: [B, O, O], note: '蓝:橙 = 1:1 vs 1:2' },
    { title: '情况 3：比例相同、数量不同', g1: [B, O], g2: [B, B, O, O], note: '1 蓝 1 橙 vs 2 蓝 2 橙' }
  ];
  const aggs = {
    mean: l => scale(l.reduce(add, [0, 0]), 1 / l.length),
    max: l => [Math.max(...l.map(v => v[0])), Math.max(...l.map(v => v[1]))],
    sum: l => l.reduce(add, [0, 0])
  };
  const power = $('#gin-power');
  const grid = h('div', { class: 'grid-3' });
  power.append(grid);
  const star = (nbrs) => {
    const W = 150, H = 104, cx = W / 2, cy = 84;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'viz', style: 'max-width:150px' });
    nbrs.forEach((v, k) => {
      const a = -Math.PI / 2 + (k - (nbrs.length - 1) / 2) * 0.85;
      const x = cx + Math.cos(a) * 58, y = cy + Math.sin(a) * 62;
      s('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: 'var(--edge)', 'stroke-width': 1.6 }, svg);
      s('circle', { cx: x, cy: y, r: 10, fill: v[0] ? 'var(--c1)' : 'var(--c2)', stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
    });
    s('circle', { cx, cy, r: 12, fill: 'var(--muted)', stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
    return svg;
  };
  CASES.forEach(c => {
    const rows = Object.entries(aggs).map(([name, f]) => {
      const a = f(c.g1), b = f(c.g2);
      const same = Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
      return `<tr><td class="mono">${name}</td><td>${vecCell(a)}</td><td>${vecCell(b)}</td><td>${same ? '<span class="no">✗ 相同，无法区分</span>' : '<span class="ok">✓ 能区分</span>'}</td></tr>`;
    }).join('');
    const pair = h('div', { style: 'display:flex;justify-content:space-around;align-items:center' }, [
      h('div', { style: 'text-align:center' }, [star(c.g1), h('div', { class: 'small muted', text: '图 1' })]),
      h('div', { class: 'muted', text: 'vs' }),
      h('div', { style: 'text-align:center' }, [star(c.g2), h('div', { class: 'small muted', text: '图 2' })])
    ]);
    grid.append(h('div', { class: 'card' }, [
      h('h3', { style: 'margin-top:0', text: c.title }),
      h('div', { class: 'small muted', text: c.note }),
      pair,
      h('div', { class: 'calc', html: `<table><tr><th>聚合</th><th>图 1</th><th>图 2</th><th></th></tr>${rows}</table>` })
    ]));
  });
  power.append(h('div', { class: 'callout', html: '<b>结论：</b>只有 <b>sum</b> 在三种情况下都能区分。mean 只记住了"比例"，max 只记住了"有没有"，而 sum 同时记住了"有什么"和"有多少"。这就是 GIN 选择求和的理由；后面的 MLP 则保证模型能把不同的和映射成不同的输出。' }));

  /* ---------- 5.2 示例图上的一层 GIN ---------- */
  const st = { eps: 0 };
  const outOf = i => TOY.nbrs[i].reduce((acc, j) => add(acc, TOY.X[j]), scale(TOY.X[i], 1 + st.eps));
  $('#gin-controls').append(
    UI.slider('eps', 'ε', { min: -1, max: 2, step: 0.1, value: st.eps, format: v => v.toFixed(1) }, v => { st.eps = v; ex.render(); }),
    h('span', { class: 'kbd-note', html: '自身权重 = 1 + ε' })
  );
  const ex = makeExplorer('gin', ex => {
    const i = ex.sel, w = 1 + st.eps;
    const items = [{ j: i, w: Math.max(Math.abs(w), 0.05), label: `1+ε = ${fmt(w, 1)}` }].concat(TOY.nbrs[i].map(j => ({ j, w: 1, label: '1' })));
    drawIncoming(ex.gv, i, items);
    const out = outOf(i);
    const rows = [`<tr><td>${chip(i)}<span class="tag">自身</span></td><td>${fmt(w, 1)}</td><td>${vecCell(TOY.X[i])}</td><td>${vecCell(scale(TOY.X[i], w))}</td></tr>`]
      .concat(TOY.nbrs[i].map(j => `<tr><td>${chip(j)}</td><td>1</td><td>${vecCell(TOY.X[j])}</td><td>${vecCell(TOY.X[j])}</td></tr>`)).join('');
    $('#gin-detail').innerHTML = `
      <table><tr><th>来源</th><th>权重</th><th>xⱼ</th><th>权重 · xⱼ</th></tr>${rows}
      <tr class="sum"><td>求和</td><td></td><td></td><td>${vecCell(out)}</td></tr></table>
      <div class="res">MLP 的输入 = <b>${fmtVec(out)}</b><br><span class="small muted">之后会再经过 MLP（例如 Linear → BatchNorm → ReLU → Linear）得到 h'<sub>${i}</sub></span></div>
      <p class="small muted">节点 ${i} 有 ${TOY.deg[i]} 个邻居，所以结果的"规模"大约是单个特征的 ${fmt(TOY.deg[i] + w, 1)} 倍。</p>`;
    scatterAll(ex.sc, TOY.nodes.map((_, k) => outOf(k)), i);
  });
  ex.render();

  renderParams($('#gin-params'), [
    { name: 'nn', def: '必填', mean: '一个 <code>torch.nn.Module</code>，即公式中的 MLP。输入输出维度由它决定（GINConv 自己没有 in/out_channels 参数）。', typical: '两层 MLP：Linear(in, hidden) → BatchNorm → ReLU → Linear(hidden, hidden)。PyG 提供 <code>torch_geometric.nn.MLP</code> 可以快速构造。', note: 'MLP 的<b>隐藏维度</b>和<b>层数</b>就是 GIN 的主要容量超参数：常用 hidden 64~300，2 层。' },
    { name: 'eps', def: '0.0', demo: true, mean: '自身特征的额外权重 ε，自身的系数是 1 + ε。它让模型能区分"自己"和"邻居"：如果自身和邻居权重完全相同，某些结构会被混淆。', up: '节点更看重自己。', down: 'ε = -1 时完全忽略自身。', typical: '0' },
    { name: 'train_eps', def: 'False', mean: '是否把 ε 设为可学习参数。', on: 'ε 由训练数据决定（论文中称 GIN-ε）。', off: 'ε 固定为初始值（GIN-0）。论文实验中两者效果相近，GIN-0 往往泛化稍好。', typical: 'False' },
    { name: '读出函数 Readout', where: 'global_add_pool / global_mean_pool / global_max_pool', mean: '图分类任务中，把一张图里所有节点的表示汇总成一个<b>图向量</b>，再送进分类器。', note: 'GIN 论文推荐用 <b>sum</b>（global_add_pool）以保持区分能力，并把<b>每一层</b>的读出结果拼接起来，同时利用浅层（局部）和深层（全局）的信息。', typical: 'global_add_pool' },
    { name: 'num_layers', where: '模型结构', mean: '堆叠多少层 GINConv。图分类任务中通常比节点分类更深。', typical: '3~5 层（配合 BatchNorm 与各层读出拼接）' },
    { name: 'GINEConv', where: '相关变体', mean: '当边带有特征（如化学键类型）时使用，消息变为 <span class="tex" data-tex="\\text{ReLU}(\\mathbf{x}_j + \\mathbf{e}_{ji})"></span>。多出参数 <code>edge_dim</code>。', typical: '分子数据集（OGB-molhiv 等）常用' }
  ]);
  renderTex($('#gin'));
});
