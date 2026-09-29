import { original, additions, graphAt, infer, probabilities } from './model.js?v=3';

const state = { step: 1, depth: 2, selected: 2 };
const ns = 'http://www.w3.org/2000/svg';
const $ = selector => document.querySelector(selector);
const elements = {
  beforeGraph: $('#before-graph'), afterGraph: $('#after-graph'),
  beforeDescription: $('#before-description'), afterDescription: $('#after-description'),
  explanation: $('#step-explanation'), result: $('#selected-result'),
  nodeResults: $('#node-results'), depthResults: $('#depth-results'),
  depthBeforeHead: $('#depth-before-head'), depthAfterHead: $('#depth-after-head')
};
let weights;

const mobilePoints = [
  [60, 130], [158, 75], [158, 190], [275, 110], [250, 285],
  [290, 380], [165, 430], [270, 505], [60, 265], [70, 390],
  [175, 315], [300, 210], [65, 650], [135, 595], [175, 710], [270, 615], [300, 735]
];

function svg(tag, attributes = {}, content) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (content !== undefined) node.textContent = content;
  return node;
}

function percent(value) { return `${(value * 100).toFixed(1)}%`; }
function feature(value) { return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`; }
function difference(before, after) {
  const points = (after - before) * 100;
  if (Math.abs(points) < 0.05) return '0.0';
  return `${points > 0 ? '+' : '−'}${Math.abs(points).toFixed(1)}`;
}

function currentNewEdges() {
  if (state.step < 3) return additions[state.step - 1].edges;
  return graphAt(3).edges.slice(graphAt(2).edges.length);
}

function position(graph, index, compact) {
  return compact ? mobilePoints[index] : graph.points[index];
}

function drawGraph(target, graph, predictions, phase, before, after) {
  const compact = window.matchMedia('(max-width: 700px)').matches;
  target.setAttribute('viewBox', compact
    ? `0 0 360 ${state.step === 3 ? 790 : 555}`
    : `0 0 600 ${state.step === 3 ? 645 : 425}`);
  target.replaceChildren();

  if (state.step === 3) {
    const guide = compact ? 565 : 445;
    target.append(svg('line', { x1: 20, y1: guide, x2: compact ? 340 : 580, y2: guide, class: 'subgraph-guide' }));
    target.append(svg('text', { x: 24, y: guide + 21, class: 'subgraph-label' },
      phase === 'before' ? '此时还没有新子图' : '本步新接入的五篇论文'));
  }

  const newEdges = currentNewEdges();
  for (const [i, j] of graph.edges) {
    const added = phase === 'after' && newEdges.some(([a, b]) => a === i && b === j);
    const [x1, y1] = position(graph, i, compact);
    const [x2, y2] = position(graph, j, compact);
    target.append(svg('line', { x1, y1, x2, y2, class: added ? 'edge edge-new' : 'edge' }));
  }

  graph.names.forEach((name, index) => {
    const [x, y] = position(graph, index, compact);
    const isNew = phase === 'after' && (state.step === 3 ? index >= 12 : index === 9 + state.step);
    const changed = index < original.names.length && Math.abs(after[index] - before[index]) >= 0.01;
    const selected = state.selected === index;
    const group = svg('g', {
      transform: `translate(${x} ${y})`,
      class: `paper-node ${isNew ? 'new' : ''} ${changed ? 'changed' : ''} ${selected ? 'selected' : ''}`
    });
    group.append(svg('rect', { x: -44, y: -30, width: 88, height: 60, rx: 10, class: 'paper-box' }));
    group.append(svg('text', { x: 0, y: -12, 'text-anchor': 'middle', class: 'paper-title' }, `${name} · ${graph.topics[index]}`));
    group.append(svg('text', { x: 0, y: 3, 'text-anchor': 'middle', class: 'paper-feature' }, `x ${feature(graph.signals[index])}`));
    group.append(svg('text', { x: 0, y: 21, 'text-anchor': 'middle', class: 'paper-prediction' }, `AI ${percent(predictions[index])}`));
    group.append(svg('title', {}, `论文 ${name} ${graph.topics[index]}，关键词得分 ${feature(graph.signals[index])}，AI 概率 ${percent(predictions[index])}`));
    if (index < original.names.length || (phase === 'after' && index >= original.names.length)) {
      group.setAttribute('role', 'button');
      group.setAttribute('tabindex', '0');
      group.setAttribute('aria-label', `查看论文 ${name}：关键词得分 ${feature(graph.signals[index])}，AI 概率 ${percent(predictions[index])}`);
      const select = () => {
        state.selected = index;
        render();
        target.querySelectorAll('.paper-node')[index]?.focus();
      };
      group.addEventListener('click', select);
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
      });
    }
    target.append(group);
  });
}

function renderNodeTable(data) {
  elements.nodeResults.replaceChildren();
  data.afterGraph.names.forEach((name, index) => {
    const row = document.createElement('tr');
    if (index === state.selected) row.classList.add('row-selected');
    if (index >= data.beforeGraph.names.length) row.classList.add('row-new');
    const nameCell = document.createElement('th');
    nameCell.scope = 'row';
    const select = document.createElement('button');
    select.type = 'button';
    select.textContent = `${name} · ${data.afterGraph.topics[index]}`;
    select.addEventListener('click', () => { state.selected = index; render(); });
    nameCell.append(select);
    const featureCell = document.createElement('td');
    featureCell.textContent = feature(data.afterGraph.signals[index]);
    const beforeCell = document.createElement('td');
    beforeCell.textContent = index < data.before.length ? percent(data.before[index]) : '尚不存在';
    const afterCell = document.createElement('td');
    afterCell.textContent = percent(data.after[index]);
    const deltaCell = document.createElement('td');
    deltaCell.textContent = index < data.before.length ? difference(data.before[index], data.after[index]) : '—';
    if (index < data.before.length && Math.abs(data.after[index] - data.before[index]) >= 0.01) deltaCell.classList.add('large-change');
    row.append(nameCell, featureCell, beforeCell, afterCell, deltaCell);
    elements.nodeResults.append(row);
  });
}

function renderDepthTable() {
  elements.depthResults.replaceChildren();
  const selectedName = graphAt(state.step).names[state.selected];
  elements.depthBeforeHead.textContent = `${selectedName}：加入前 AI 概率`;
  elements.depthAfterHead.textContent = `${selectedName}：加入后 AI 概率`;
  for (let depth = 1; depth <= 4; depth++) {
    const result = probabilities({ step: state.step, depth }, weights);
    const existsBefore = state.selected < result.before.length;
    const affected = original.names.filter((_, index) => Math.abs(result.after[index] - result.before[index]) >= 0.01);
    const row = document.createElement('tr');
    if (depth === state.depth) row.classList.add('row-selected');
    const level = document.createElement('th');
    level.scope = 'row';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${depth} 层`;
    button.setAttribute('aria-label', `切换到 ${depth} 层 GCN`);
    button.addEventListener('click', () => { state.depth = depth; render(); });
    level.append(button);
    const cells = [
      existsBefore ? percent(result.before[state.selected]) : '尚不存在',
      percent(result.after[state.selected]),
      existsBefore ? difference(result.before[state.selected], result.after[state.selected]) : '—',
      `${affected.length} / 10（${affected.length ? affected.join('、') : '无'}）`
    ];
    row.append(level, ...cells.map(text => { const cell = document.createElement('td'); cell.textContent = text; return cell; }));
    elements.depthResults.append(row);
  }
}

function render() {
  const data = probabilities(state, weights);
  if (state.selected >= data.after.length) state.selected = 2;
  const beforeCount = data.beforeGraph.names.length;
  const afterCount = data.afterGraph.names.length;
  elements.beforeDescription.textContent = `${beforeCount} 篇论文 · ${data.beforeGraph.edges.length} 条引用边`;
  elements.afterDescription.textContent = `${afterCount} 篇论文 · ${data.afterGraph.edges.length} 条引用边`;
  elements.explanation.textContent = [
    '原图有 10 篇论文和 18 条引用边。本步新增论文 K（材料模拟），新边连接 C、J。',
    '在已有 K 的图上新增论文 L（计算方法），新边连接 D、K。',
    '在已有 K、L 的图上接入五篇论文 M–Q。新子图有内部引用边，并通过 C–M、J–Q 两条边连接原图。'
  ][state.step - 1];
  drawGraph(elements.beforeGraph, data.beforeGraph, data.before, 'before', data.before, data.after);
  drawGraph(elements.afterGraph, data.afterGraph, data.after, 'after', data.before, data.after);
  const name = data.afterGraph.names[state.selected];
  const topic = data.afterGraph.topics[state.selected];
  const signal = feature(data.afterGraph.signals[state.selected]);
  const existsBefore = state.selected < data.before.length;
  elements.result.innerHTML = existsBefore
    ? `<div><span>当前选中</span><strong>${name} · ${topic}</strong><small>关键词得分 x = ${signal}</small></div><div class="result-numbers"><span>加入前 AI 概率 <b>${percent(data.before[state.selected])}</b></span><span class="result-arrow">→</span><span>加入后 AI 概率 <b>${percent(data.after[state.selected])}</b></span><em>变化 ${difference(data.before[state.selected], data.after[state.selected])} 个百分点</em></div>`
    : `<div><span>当前选中 · 本步新增</span><strong>${name} · ${topic}</strong><small>关键词得分 x = ${signal}</small></div><div class="result-numbers"><span>加入前 <b>尚不存在</b></span><span class="result-arrow">→</span><span>加入后 AI 概率 <b>${percent(data.after[state.selected])}</b></span></div>`;
  renderNodeTable(data);
  renderDepthTable();
  document.querySelectorAll('[data-step]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.step) === state.step)));
  document.querySelectorAll('[data-depth]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.depth) === state.depth)));
}

document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => {
  state.step = Number(button.dataset.step);
  state.selected = state.step === 2 ? 3 : 2;
  render();
}));
document.querySelectorAll('[data-depth]').forEach(button => button.addEventListener('click', () => {
  state.depth = Number(button.dataset.depth);
  render();
}));
window.matchMedia('(max-width: 700px)').addEventListener('change', () => { if (weights) render(); });

try {
  const response = await fetch('./weights.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  weights = await response.json();
  render();
} catch (error) {
  elements.explanation.textContent = '模型权重加载失败，请刷新页面。';
  console.error('GCN weights failed to load:', error);
}
