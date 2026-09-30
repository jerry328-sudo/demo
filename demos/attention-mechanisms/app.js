import { scaledDotAttention, additiveAttention, attentionMatrix, twoHeadAttention,
  graphAttention, gatedFeatures } from './math.js';

const defaults = () => ({
  core: {
    method: 'dot', q: [1, 0.5], keys: [[1, 0], [0.4, 1], [-0.7, 0.7], [0, -1]],
    values: [[1, 0], [0, 1], [-1, 0], [0, -1]], mask: [true, true, true, true],
    selected: 0, temperature: 1
  },
  self: { vectors: [[1, 0], [0.4, 1], [-0.7, 0.7], [0, -1]], selected: 0, temperature: 1 },
  cross: { queries: [[1, 0.5], [-0.6, 1]], sources: [[1, 0], [0.4, 1], [-0.7, 0.7], [0, -1]], selected: 0, source: 0, temperature: 1 },
  multi: { vectors: [[1, 0], [0.4, 1], [-0.7, 0.7], [0, -1]], selected: 0, temperature: 1 },
  graph: { nodes: [[1, 0.5], [1, 0], [0.4, 1], [-0.7, 0.7], [0, -1]], included: [true, true, true, true, false], selected: 1 },
  gate: { channels: [[1, 1.2, 0.2, 0.4], [0.3, 1.4, 1.2, 0.5], [0.2, 0.3, 0.8, 1.5]], channel: 0, position: 0 }
});

const modes = {
  core: ['01', '点积与加性注意力', '同一组查询、键和值，比较两种计算匹配分数的方法。',
    '四个候选项共用一个 softmax；V 可以与 K 不同。'],
  self: ['02', '自注意力', '每个位置依次作为查询，查看它对同一组位置分配的权重。',
    'Q、K、V 均来自同一组输入。为隔离注意力算法，这里取投影矩阵 W_Q = W_K = W_V = I。'],
  cross: ['03', '交叉注意力', '查询来自集合 A，键和值来自集合 B；每个查询有自己的一组权重。',
    '两个集合的向量维度均为 2；本例投影取恒等映射，重点观察输入来源的变化。'],
  multi: ['04', '多头注意力', '两个头分别读取向量的第 1、第 2 个分量，再拼接输出。',
    '此例 W_Q、W_K、W_V 分别选取一个坐标，dₖ = 1；拼接后 W_O = I。实际模型中的投影矩阵通常是学习得到的。'],
  graph: ['05', '图注意力', '中心节点只对已连接的自身和邻居计算权重。',
    '固定 W = I、a = (−0.6, 0.8, 0.2, 0.5)，用于展示 GAT 的邻居打分。真实训练会学习这些参数。'],
  gate: ['06', '通道与空间注意力', '给每个通道或位置各自算一个门控值，并逐元素相乘。',
    '这里以固定函数 sigmoid(2 × (均值 − 0.6)) 演示门控。它不是训练后的 SE 或 CBAM 模块；两组输出分别独立作用于原输入。']
};

let state = defaults();
let mode = new URL(location.href).searchParams.get('mode');
if (!modes[mode]) mode = 'core';

const $ = selector => document.querySelector(selector);
const f = value => (Math.abs(value) < 0.0005 ? 0 : value).toFixed(2);
const vec = (values, tone = '') => `<span class="vector ${tone}">(${values.map(value => `<b>${f(value)}</b>`).join('')})</span>`;
const bar = (weight, warm = false) => `<span class="bar-value"><span class="bar-track"><span class="bar-fill ${warm ? 'warm' : ''}" style="width:${Math.max(0, Math.min(100, weight * 100))}%"></span></span><span class="number">${f(weight)}</span></span>`;
const steps = labels => `<div class="step-strip">${labels.map((label, index) => `${index ? '<i>→</i>' : ''}<span>${label}</span>`).join('')}</div>`;
const result = (label, values, detail) => `<div class="result-box"><div><strong>${label}</strong><small>${detail}</small></div>${vec(values, 'accent')}</div>`;
const chips = (labels, selected, action) => `<div class="chip-row">${labels.map((label, index) =>
  `<button type="button" class="chip" data-action="${action}" data-index="${index}" aria-pressed="${selected === index}">${label}</button>`).join('')}</div>`;
const group = (title, content, hint = '') => `<fieldset class="control-group"><legend>${title}</legend>${hint ? `<p class="control-hint">${hint}</p>` : ''}${content}</fieldset>`;
const range = (label, path, value, min = -2, max = 2, step = 0.1) =>
  `<div class="control-row"><label><span>${label}</span><output>${f(value)}</output></label><input aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-range="${path}"></div>`;
const vectorControls = (title, path, vector) => group(title, vector.map((value, index) =>
  range(`第 ${index + 1} 个分量`, `${path}.${index}`, value)).join(''));
const temperatureControl = key => group('分数温度 τ', range('τ', `${key}.temperature`, state[key].temperature, 0.3, 2.5, 0.1), 'τ 越小，softmax 权重通常越集中。');

function miniWeights(weights, labels, warm = false) {
  return `<div class="mini-weights">${weights.map((weight, index) =>
    `<div class="mini-weight"><span>${labels[index]}</span><span class="bar-track"><span class="bar-fill ${warm ? 'warm' : ''}" style="width:${weight * 100}%"></span></span><b>${f(weight)}</b></div>`).join('')}</div>`;
}

function coreVisual() {
  const s = state.core;
  const calc = (s.method === 'dot' ? scaledDotAttention : additiveAttention)(s.q, s.keys, s.values, { temperature: s.temperature, mask: s.mask });
  const expScores = calc.scores.map((score, index) => s.mask[index] ? Math.exp(score) : 0);
  const denominator = expScores.reduce((sum, value) => sum + value, 0);
  $('#formula').textContent = s.method === 'dot'
    ? 'sᵢ = (q · kᵢ) / (√2 × τ)     αᵢ = softmax(s)ᵢ     y = Σᵢ αᵢ vᵢ'
    : 'sᵢ = [tanh(q₁ + kᵢ₁) + 0.6 tanh(q₂ + kᵢ₂)] / τ     αᵢ = softmax(s)ᵢ     y = Σᵢ αᵢ vᵢ';
  $('#visual').innerHTML = `
    <p class="caption">当前查询 ${vec(s.q)}。K 用来算分数，V 是最终参与加权求和的向量。点击右侧候选项标签可编辑相应的 K、V。</p>
    ${steps(['查询 q 与每个键 kᵢ 计算分数', '仅对未屏蔽项做 softmax', '对值 vᵢ 加权求和'])}
    <div class="table-scroll"><table class="weight-table"><thead><tr><th>候选</th><th>键 kᵢ</th><th>分数 sᵢ</th><th>exp(sᵢ)</th><th>权重 αᵢ</th><th>值 vᵢ</th><th>贡献 αᵢ vᵢ</th></tr></thead><tbody>
    ${s.keys.map((key, index) => `<tr class="${!s.mask[index] ? 'masked' : s.selected === index ? 'selected' : ''}"><td><strong>${'ABCD'[index]}</strong>${s.mask[index] ? '' : ' · 屏蔽'}</td><td>${vec(key)}</td><td class="number">${s.mask[index] ? f(calc.scores[index]) : '—'}</td><td class="number">${s.mask[index] ? f(expScores[index]) : '—'}</td><td>${bar(calc.weights[index])}</td><td>${vec(s.values[index])}</td><td>${vec(s.values[index].map(value => value * calc.weights[index]))}</td></tr>`).join('')}
    </tbody></table></div>${result('输出 y', calc.output, `softmax 分母 Σ exp(sᵢ) = ${f(denominator)}；权重之和 ${f(calc.weights.reduce((a, b) => a + b, 0))}`)}`;
}

function matrixTable(rows, rowLabels, colLabels, selected, action) {
  return `<div class="matrix-wrap"><table class="matrix"><thead><tr><th>Q / K</th>${colLabels.map(label => `<th>${label}</th>`).join('')}</tr></thead><tbody>${rows.map((row, index) =>
    `<tr><th><button type="button" class="row-select" data-action="${action}" data-index="${index}" aria-pressed="${selected === index}" aria-label="查看查询 ${rowLabels[index]}">${rowLabels[index]}</button></th>${row.weights.map((weight, col) =>
      `<td><button type="button" data-action="${action}" data-index="${index}" aria-pressed="${selected === index}" aria-label="查询 ${rowLabels[index]} 对键 ${colLabels[col]} 的权重 ${f(weight)}" style="background:rgba(17,107,98,${f(0.12 + weight * 0.67)})">${f(weight)}</button></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function matrixVisual(type) {
  const s = state[type];
  const queries = type === 'self' ? s.vectors : s.queries;
  const sources = type === 'self' ? s.vectors : s.sources;
  const rows = attentionMatrix(queries, sources, sources, s.temperature);
  const rowLabels = queries.map((_, index) => type === 'self' ? 'ABCD'[index] : `A${index + 1}`);
  const colLabels = sources.map((_, index) => type === 'self' ? 'ABCD'[index] : `B${index + 1}`);
  const selected = rows[s.selected];
  $('#formula').textContent = `Q = ${type === 'self' ? 'K = V = X' : 'A；K = V = B'}     S = QKᵀ / (√2 × τ)     P = row-softmax(S)     Y = PV`;
  $('#visual').innerHTML = `
    <p class="caption">每一行是一条查询，每一列是一个键。单击一行，查看该查询的输入向量、权重和输出。颜色深浅与格内权重对应。</p>
    ${steps([type === 'self' ? '同一集合产生 Q、K、V' : 'A 产生 Q，B 产生 K 和 V', '每行独立 softmax', '每行得到一个输出向量'])}
    <div class="matrix-layout">${matrixTable(rows, rowLabels, colLabels, s.selected, 'select-query')}
    <div class="detail-card"><h3>查询 ${rowLabels[s.selected]}</h3><div class="vector-line"><span class="vector-label">q</span>${vec(queries[s.selected])}</div>${miniWeights(selected.weights, colLabels)}
    <div class="vector-line"><span class="vector-label">输出</span>${vec(selected.output, 'accent')}</div><p>${type === 'self' ? '对角格表示当前位置关注自身。' : '查询 A 不出现在候选列中，候选列全部来自 B。'}</p></div></div>
    ${type === 'cross' ? `<p class="caption" style="margin-top:17px">A：${s.queries.map((v, i) => `A${i + 1} ${vec(v)}`).join('　')}<br>B：${s.sources.map((v, i) => `B${i + 1} ${vec(v)}`).join('　')}</p>` : ''}`;
}

function multiVisual() {
  const s = state.multi, q = s.vectors[s.selected];
  const heads = twoHeadAttention(q, s.vectors, s.temperature);
  const output = heads.map(head => head.output[0]);
  $('#formula').textContent = 'headₕ = softmax[(QW_Q⁽ʰ⁾)(KW_K⁽ʰ⁾)ᵀ / τ] (VW_V⁽ʰ⁾)     y = concat(head₁, head₂) W_O';
  $('#visual').innerHTML = `<p class="caption">同一个查询 ${'ABCD'[s.selected]} ${vec(q)} 分给两个头。每个头分别算一组权重，并观察向量的一个不同分量。</p>
    ${steps(['按坐标投影成两个头', '各自计算 softmax 和加权输出', '拼接两个标量'])}
    <div class="head-grid">${heads.map((head, index) => `<div class="head-card"><h3>头 ${index + 1}</h3><p>只看第 ${index + 1} 个分量 · q = ${f(q[index])} · dₖ = 1</p>
      ${miniWeights(head.weights, ['A','B','C','D'], index === 1)}<div class="vector-line"><span class="vector-label">头输出</span>${vec(head.output, index === 1 ? 'warm' : 'accent')}</div></div>`).join('')}</div>
    ${result('拼接后的输出 y', output, `(${f(heads[0].output[0])}, ${f(heads[1].output[0])})，本例 W_O = I`)}`;
}

function graphVisual() {
  const s = state.graph;
  const calc = graphAttention(s.nodes[0], s.nodes, s.included);
  $('#formula').textContent = 'e₀ⱼ = LeakyReLU[aᵀ (Wh₀ || Whⱼ)]     α₀ⱼ = softmaxⱼ∈N(0) e₀ⱼ     h′₀ = Σⱼ∈N(0) α₀ⱼ Whⱼ';
  const coords = [[50,49],[16,19],[79,19],[18,80],[81,80]];
  $('#visual').innerHTML = `<p class="caption">实线表示参与聚合的边；虚线表示当前未连接。切换右侧的边后，中心节点的候选集合和输出立即变化。</p>
    <div class="graph-layout"><div class="graph-map" aria-label="中心节点和四个邻居的连接示意">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${coords.slice(1).map(([x,y], i) => `<line x1="50" y1="49" x2="${x}" y2="${y}" class="${s.included[i + 1] ? '' : 'inactive'}"/>`).join('')}</svg>
      ${s.nodes.map((node, index) => `<button type="button" class="graph-node ${index === 0 ? 'center' : s.included[index] ? '' : 'inactive'}" data-node="${index}" data-action="select-node" aria-label="编辑节点 ${index === 0 ? '中心' : 'ABCD'[index - 1]}，特征 ${node.map(f).join('、')}">${index === 0 ? '中心' : 'ABCD'[index - 1]}<small>${node.map(f).join(', ')}</small></button>`).join('')}
    </div><div><div class="table-scroll"><table class="weight-table"><thead><tr><th>节点</th><th>分数 e</th><th>权重 α</th></tr></thead><tbody>${calc.scores.map((score, index) => `<tr class="${s.included[index] ? '' : 'masked'}"><td>${index === 0 ? '中心（自环）' : 'ABCD'[index - 1]}</td><td class="number">${s.included[index] ? f(score) : '—'}</td><td>${bar(calc.weights[index])}</td></tr>`).join('')}</tbody></table></div>${result('中心节点的新表示', calc.output, '只对中心及已连接邻居的特征加权求和')}</div></div>`;
}

function gateVisual() {
  const s = state.gate, resultData = gatedFeatures(s.channels);
  $('#formula').textContent = 'm_c = meanₚ(X_cₚ)，g_c = sigmoid[2(m_c − 0.6)]，Y_cₚ = g_c X_cₚ；空间门控将 c 与 p 对调';
  $('#visual').innerHTML = `<p class="caption">输入是 3 个通道 × 4 个位置。左侧对每个通道跨位置求均值；右侧对每个位置跨通道求均值。两者分别作用于原始输入。</p>
    <div class="feature-grid"><span class="head">输入 X</span>${['位置 1','位置 2','位置 3','位置 4'].map(label => `<span class="head">${label}</span>`).join('')}
    ${s.channels.map((row, index) => `<span class="head">通道 ${index + 1}</span>${row.map(value => `<span class="number">${f(value)}</span>`).join('')}`).join('')}</div>
    <div class="gate-grid"><div class="gate-card"><h3>通道加权</h3><p>每行一个 sigmoid 门控；同一通道的四个值共用权重。</p>
      ${resultData.channelGates.map((weight, index) => `<div class="gate-row"><span>通道 ${index + 1}</span><span class="bar-track"><span class="bar-fill" style="width:${weight * 100}%"></span></span><b>${f(weight)}</b></div>`).join('')}
      <p class="caption">通道均值：${resultData.channelMeans.map(f).join(' / ')}</p></div>
    <div class="gate-card"><h3>空间加权</h3><p>每列一个 sigmoid 门控；同一位置的三个通道共用权重。</p>
      ${resultData.spatialGates.map((weight, index) => `<div class="gate-row"><span>位置 ${index + 1}</span><span class="bar-track"><span class="bar-fill warm" style="width:${weight * 100}%"></span></span><b>${f(weight)}</b></div>`).join('')}
      <p class="caption">位置均值：${resultData.spatialMeans.map(f).join(' / ')}</p></div></div>
    <h3 class="subhead">逐元素乘权重后的结果</h3><div class="gate-grid"><div class="detail-card"><h3>仅通道门控</h3>${featureTable(resultData.channelOutput)}</div><div class="detail-card"><h3>仅空间门控</h3>${featureTable(resultData.spatialOutput)}</div></div>`;
}

function featureTable(channels) {
  return `<div class="feature-grid"><span></span>${[1,2,3,4].map(n => `<span class="head">位置 ${n}</span>`).join('')}${channels.map((row, index) => `<span class="head">通道 ${index + 1}</span>${row.map(value => `<span class="number">${f(value)}</span>`).join('')}`).join('')}</div>`;
}

function renderVisual() {
  const meta = modes[mode];
  $('#mode-index').textContent = `${meta[0]} / 06`;
  $('#mode-title').textContent = meta[1];
  $('#mode-summary').textContent = meta[2];
  $('#method-note').innerHTML = `<strong>本例设定：</strong>${meta[3]}`;
  ({ core: coreVisual, self: () => matrixVisual('self'), cross: () => matrixVisual('cross'),
    multi: multiVisual, graph: graphVisual, gate: gateVisual })[mode]();
}

function renderControls() {
  const s = state[mode];
  let html = '';
  if (mode === 'core') {
    html += group('分数函数', `<div class="chip-row"><button type="button" class="chip" data-action="method" data-method="dot" aria-pressed="${s.method === 'dot'}">缩放点积</button><button type="button" class="chip" data-action="method" data-method="add" aria-pressed="${s.method === 'add'}">加性</button></div>`);
    html += vectorControls('查询 q', 'core.q', s.q);
    html += group('编辑候选项', chips(['A','B','C','D'], s.selected, 'select-item'));
    html += vectorControls(`键 k${'ABCD'[s.selected]}`, `core.keys.${s.selected}`, s.keys[s.selected]);
    html += vectorControls(`值 v${'ABCD'[s.selected]}`, `core.values.${s.selected}`, s.values[s.selected]);
    html += group('参与 softmax', s.mask.map((checked, index) => `<label class="check-row"><input type="checkbox" data-mask="${index}" ${checked ? 'checked' : ''}>候选 ${'ABCD'[index]}</label>`).join(''));
    html += temperatureControl('core');
  } else if (mode === 'self' || mode === 'multi') {
    html += group('选中查询', chips(['A','B','C','D'], s.selected, 'select-query'));
    html += vectorControls(`位置 ${'ABCD'[s.selected]} 的输入 x`, `${mode}.vectors.${s.selected}`, s.vectors[s.selected]);
    html += group('编辑其他位置', chips(['A','B','C','D'], s.selected, 'select-query'), '改变任一输入，也会改变其他查询的键和值。');
    html += temperatureControl(mode);
  } else if (mode === 'cross') {
    html += group('集合 A：选中查询', chips(['A1','A2'], s.selected, 'select-query'));
    html += vectorControls(`查询 A${s.selected + 1}`, `cross.queries.${s.selected}`, s.queries[s.selected]);
    html += group('集合 B：选中键 / 值', chips(['B1','B2','B3','B4'], s.source, 'select-source'));
    html += vectorControls(`来源 B${s.source + 1}`, `cross.sources.${s.source}`, s.sources[s.source]);
    html += temperatureControl('cross');
  } else if (mode === 'graph') {
    html += group('编辑节点', chips(['中心','A','B','C','D'], s.selected, 'select-node'));
    html += vectorControls(`节点 ${s.selected === 0 ? '中心' : 'ABCD'[s.selected - 1]} 的特征`, `graph.nodes.${s.selected}`, s.nodes[s.selected]);
    html += group('与中心连接的边', s.included.slice(1).map((checked, index) => `<label class="check-row"><input type="checkbox" data-edge="${index + 1}" ${checked ? 'checked' : ''}>中心 — ${'ABCD'[index]}</label>`).join(''), '中心的自环始终保留。');
  } else {
    html += group('选中通道', chips(['1','2','3'], s.channel, 'select-channel'));
    html += group('选中位置', chips(['1','2','3','4'], s.position, 'select-position'));
    html += group(`输入 X[通道 ${s.channel + 1}, 位置 ${s.position + 1}]`, range('特征值', `gate.channels.${s.channel}.${s.position}`, s.channels[s.channel][s.position], 0, 2, 0.1));
  }
  $('#controls').innerHTML = html;
}

function render() {
  document.querySelectorAll('[data-mode]').forEach(button => {
    if (button.dataset.mode === mode) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
  renderControls(); renderVisual();
}

document.querySelector('.mode-nav').addEventListener('click', event => {
  const button = event.target.closest('[data-mode]');
  if (!button) return;
  mode = button.dataset.mode;
  const url = new URL(location.href); url.searchParams.set('mode', mode);
  history.replaceState(null, '', url);
  render();
});

$('#reset').addEventListener('click', () => { state[mode] = defaults()[mode]; render(); });
$('#controls').addEventListener('input', event => {
  const input = event.target;
  if (!input.matches('[data-range]')) return;
  const parts = input.dataset.range.split('.');
  let ref = state;
  for (const part of parts.slice(0, -1)) ref = ref[part];
  ref[parts.at(-1)] = Number(input.value);
  input.closest('.control-row').querySelector('output').textContent = f(Number(input.value));
  renderVisual();
});
$('#controls').addEventListener('change', event => {
  const input = event.target;
  if (input.matches('[data-mask]')) {
    const mask = state.core.mask, index = Number(input.dataset.mask);
    if (!input.checked && mask.filter(Boolean).length === 1) { input.checked = true; return; }
    mask[index] = input.checked;
  } else if (input.matches('[data-edge]')) state.graph.included[Number(input.dataset.edge)] = input.checked;
  else return;
  renderVisual();
});

function handleAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const index = Number(button.dataset.index);
  const action = button.dataset.action;
  if (action === 'method') state.core.method = button.dataset.method;
  if (action === 'select-item') state.core.selected = index;
  if (action === 'select-query') state[mode].selected = index;
  if (action === 'select-source') state.cross.source = index;
  if (action === 'select-node') state.graph.selected = Number(button.dataset.node ?? button.dataset.index);
  if (action === 'select-channel') state.gate.channel = index;
  if (action === 'select-position') state.gate.position = index;
  render();
}
$('#controls').addEventListener('click', handleAction);
$('#visual').addEventListener('click', handleAction);
render();
