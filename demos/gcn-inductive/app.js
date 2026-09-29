import { original, separate, infer, probabilities } from './model.js';

const state = { mode: 'node', depth: 2, feature: 'negative', attached: new Set([2]), selected: 2 };
const svgNS = 'http://www.w3.org/2000/svg';
const elements = {
  graph: document.querySelector('#graph'),
  stageTitle: document.querySelector('#stage-title'),
  stageCaption: document.querySelector('#stage-caption'),
  modeHelp: document.querySelector('#mode-help'),
  featureControl: document.querySelector('#feature-control'),
  depth: document.querySelector('#depth'),
  depthValue: document.querySelector('#depth-value'),
  selectedName: document.querySelector('#selected-name'),
  beforeValue: document.querySelector('#before-value'),
  afterValue: document.querySelector('#after-value'),
  beforeTrack: document.querySelector('#before-track'),
  afterTrack: document.querySelector('#after-track'),
  selectedDelta: document.querySelector('#selected-delta'),
  experimentNote: document.querySelector('#experiment-note'),
  comparisonCaption: document.querySelector('#comparison-caption'),
  depthChart: document.querySelector('#depth-chart')
};

let weights;

function svg(tag, attributes = {}, content) {
  const element = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (content !== undefined) element.textContent = content;
  return element;
}

function drawLine(from, to, className) {
  elements.graph.append(svg('line', { x1: from[0], y1: from[1], x2: to[0], y2: to[1], class: className }));
}

function drawNode(point, label, probability, options = {}) {
  const group = svg('g', {
    class: `graph-node ${options.kind || 'original'} ${options.selected ? 'selected' : ''} ${options.connected ? 'connected' : ''}`,
    transform: `translate(${point[0]} ${point[1]})`
  });
  if (options.index !== undefined) {
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', `节点 ${label}，蓝类概率 ${(probability * 100).toFixed(1)}%，${state.mode === 'node' ? '点击切换连接并查看预测' : '点击查看预测'}`);
    const activate = () => {
      state.selected = options.index;
      if (state.mode === 'node') {
        if (state.attached.has(options.index)) state.attached.delete(options.index);
        else state.attached.add(options.index);
      }
      render();
      elements.graph.querySelectorAll('.graph-node.original')[options.index]?.focus();
    };
    group.addEventListener('click', activate);
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
    });
  }
  if (options.selected || options.connected) group.append(svg('circle', { r: 38, class: 'node-halo' }));
  group.append(svg('circle', { r: 28, class: 'node-disc', fill: probability >= 0.5 ? '#71d1e2' : '#f3a875' }));
  group.append(svg('text', { class: 'node-letter', 'text-anchor': 'middle', dy: '0.36em' }, label));
  if (options.index !== undefined) group.append(svg('text', { class: 'node-probability', 'text-anchor': 'middle', y: 53 }, `${(probability * 100).toFixed(0)}%`));
  elements.graph.append(group);
}

function drawGraph(after) {
  elements.graph.replaceChildren(
    svg('title', { id: 'graph-title' }, '测试图节点及新增节点'),
    svg('desc', { id: 'graph-desc' }, '点击原有节点查看预测变化；接入节点模式下点击可切换连接。')
  );
  const detached = state.mode === 'graph';
  const compact = window.matchMedia('(max-width: 700px)').matches;
  elements.graph.setAttribute('viewBox', compact ? `0 0 360 ${detached ? 470 : 430}` : '0 0 760 440');
  const points = compact
    ? detached
      ? [[48, 212], [105, 146], [178, 176], [248, 150], [300, 101], [308, 218], [174, 73]]
      : [[45, 271], [109, 218], [180, 224], [247, 208], [306, 145], [308, 301], [179, 83]]
    : detached ? original.points.map(([x, y]) => [58 + x * 0.55, 72 + y * 0.71]) : original.points;
  const added = compact ? [181, 357] : [340, 370];
  const newPoints = compact ? [[58, 397], [128, 355], [221, 397], [303, 354]] : separate.points;

  if (detached) {
    elements.graph.append(svg('line', compact
      ? { x1: 23, x2: 337, y1: 280, y2: 280, class: 'graph-divider' }
      : { x1: 458, x2: 458, y1: 66, y2: 368, class: 'graph-divider' }));
    elements.graph.append(svg('text', { x: compact ? 30 : 58, y: compact ? 35 : 54, class: 'graph-region' }, '原有测试图'));
    elements.graph.append(svg('text', { x: compact ? 30 : 503, y: compact ? 320 : 54, class: 'graph-region' }, '新加入 · 独立图'));
  }

  for (const [i, j] of original.edges) drawLine(points[i], points[j], 'edge');
  if (!detached) {
    for (const i of state.attached) drawLine(points[i], added, 'edge edge-added');
    drawNode(added, 'N+', state.feature === 'negative' ? 0.03 : 0.97, { kind: 'added' });
  } else {
    const newGraphPredictions = infer(separate.signals, separate.edges, state.depth, weights);
    for (const [i, j] of separate.edges) drawLine(newPoints[i], newPoints[j], 'edge edge-separate');
    newPoints.forEach((point, i) => drawNode(point, separate.names[i], newGraphPredictions[i], { kind: 'added' }));
  }
  points.forEach((point, i) => drawNode(point, original.names[i], after[i], {
    index: i, selected: state.selected === i, connected: !detached && state.attached.has(i)
  }));
}

function signedPoints(delta) {
  if (Math.abs(delta) < 0.0005) return '0.0 pp';
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta * 100).toFixed(1)} pp`;
}

function renderComparison() {
  elements.depthChart.replaceChildren();
  for (let depth = 1; depth <= 4; depth++) {
    const { before, after } = probabilities({ ...state, depth }, weights);
    const delta = after[state.selected] - before[state.selected];
    const affected = before.filter((value, i) => Math.abs(after[i] - value) > 0.0005).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `depth-row ${state.depth === depth ? 'active' : ''}`;
    button.setAttribute('aria-label', `${depth} 层 GCN，节点 ${original.names[state.selected]} 变化 ${signedPoints(delta)}，${affected} 个原有节点变化；点击选择`);
    button.innerHTML = `<span class="depth-name">${depth} <small>层 GCN</small></span><span class="delta-axis"><span class="delta-fill"></span></span><strong class="depth-delta">${signedPoints(delta)}</strong><span class="affected">${affected} / 7 个节点变化</span>`;
    const fill = button.querySelector('.delta-fill');
    const width = Math.min(Math.abs(delta) * 180, 48);
    fill.style.width = `${width}%`;
    fill.style.left = delta < 0 ? `${50 - width}%` : '50%';
    fill.dataset.direction = delta < 0 ? 'negative' : 'positive';
    button.addEventListener('click', () => { state.depth = depth; render(); });
    elements.depthChart.append(button);
  }
}

function render() {
  const { before, after } = probabilities(state, weights);
  const selectedBefore = before[state.selected];
  const selectedAfter = after[state.selected];
  const delta = selectedAfter - selectedBefore;
  const affected = before.filter((value, i) => Math.abs(after[i] - value) > 0.0005).length;
  const max = Math.max(...before.map((value, i) => Math.abs(after[i] - value)));

  elements.stageTitle.textContent = state.mode === 'node' ? '接入一个新节点' : '加入一张独立图';
  elements.stageCaption.textContent = state.mode === 'node'
    ? '点击原有节点，切换它与 N+ 的连接并查看预测'
    : '点击原有节点，查看独立图加入前后的预测';
  elements.modeHelp.textContent = state.mode === 'node'
    ? '新节点接到测试图上，改变局部邻接关系和度归一化。'
    : '两张图不相连，原有测试图的输入完全不变。';
  elements.featureControl.hidden = state.mode === 'graph';
  elements.depth.value = state.depth;
  elements.depthValue.textContent = `${state.depth} 层`;
  elements.selectedName.textContent = original.names[state.selected];
  elements.beforeValue.textContent = `${(selectedBefore * 100).toFixed(1)}%`;
  elements.afterValue.textContent = `${(selectedAfter * 100).toFixed(1)}%`;
  elements.beforeTrack.style.width = `${selectedBefore * 100}%`;
  elements.afterTrack.style.width = `${selectedAfter * 100}%`;
  elements.selectedDelta.textContent = `预测变化 ${signedPoints(delta)}`;
  elements.selectedDelta.dataset.direction = delta < -0.0005 ? 'negative' : delta > 0.0005 ? 'positive' : 'none';
  elements.comparisonCaption.textContent = `当前观察：节点 ${original.names[state.selected]}`;
  elements.experimentNote.textContent = state.mode === 'graph'
    ? '原图 7 个节点的预测均保持不变；独立图只产生自己的预测。'
    : state.attached.size === 0
      ? 'N+ 尚未连接原图，7 个原有节点的预测保持不变。'
      : `当前 ${affected} / 7 个原有节点的蓝类概率变化至少 0.05 个百分点；最大变化 ${(max * 100).toFixed(1)} 个百分点。`;
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
  document.querySelectorAll('[data-feature]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.feature === state.feature)));
  drawGraph(after);
  renderComparison();
}

document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  state.mode = button.dataset.mode;
  render();
}));
document.querySelectorAll('[data-feature]').forEach(button => button.addEventListener('click', () => {
  state.feature = button.dataset.feature;
  render();
}));
elements.depth.addEventListener('input', event => { state.depth = Number(event.target.value); render(); });
window.matchMedia('(max-width: 700px)').addEventListener('change', () => { if (weights) render(); });

try {
  const response = await fetch('./weights.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  weights = await response.json();
  render();
} catch (error) {
  elements.experimentNote.textContent = '模型权重加载失败。请通过本地静态服务器打开页面，并刷新重试。';
  console.error('Failed to load frozen GCN weights:', error);
}
