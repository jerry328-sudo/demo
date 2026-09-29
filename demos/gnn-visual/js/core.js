/* =========================================================
 * core.js —— 公共工具：DOM/SVG 辅助、主题、路由、图/散点/折线组件、示例数据
 * ========================================================= */
'use strict';

const SVGNS = 'http://www.w3.org/2000/svg';

/** 创建 HTML 元素 */
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c != null) el.append(c);
  return el;
}

/** 创建 SVG 元素 */
function s(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'text') el.textContent = v;
    // SVG 的 fill/stroke 属性不支持 CSS 变量，改写到 style 上，这样切换主题时颜色自动更新
    else if ((k === 'fill' || k === 'stroke') && typeof v === 'string' && v.includes('var(')) el.style.setProperty(k, v);
    else el.setAttribute(k, v);
  }
  if (parent) parent.appendChild(el);
  return el;
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (v, d = 2) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(d);
const fmtVec = (v, d = 2) => '[' + v.map(x => fmt(x, d)).join(', ') + ']';
const add = (a, b) => a.map((x, i) => x + b[i]);
const scale = (a, k) => a.map(x => x * k);
const dot = (a, b) => a.reduce((acc, x, i) => acc + x * b[i], 0);
const norm = a => Math.sqrt(dot(a, a));

/** 可复现的伪随机数 */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  let u = 0; while (!u) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/* ---------------- 颜色 ---------------- */
const GROUP_VARS = ['--c1', '--c2', '--c3'];
const groupColor = g => `var(${GROUP_VARS[g]})`;
const SEQ_VARS = ['--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6', '--seq-7'];

/* ---------------- Tooltip ---------------- */
const Tooltip = (() => {
  let el;
  function ensure() { if (!el) { el = h('div', { class: 'tooltip' }); document.body.append(el); } return el; }
  return {
    show(html, evt) {
      const t = ensure(); t.innerHTML = html; t.classList.add('show');
      const pad = 14, w = t.offsetWidth, hh = t.offsetHeight;
      let x = evt.clientX + pad, y = evt.clientY + pad;
      if (x + w > window.innerWidth - 8) x = evt.clientX - w - pad;
      if (y + hh > window.innerHeight - 8) y = evt.clientY - hh - pad;
      t.style.left = x + 'px'; t.style.top = y + 'px';
    },
    hide() { if (el) el.classList.remove('show'); }
  };
})();

/* ---------------- 公式渲染 ---------------- */
function renderTex(root = document) {
  $$('[data-tex]', root).forEach(el => {
    if (el.dataset.rendered) return;
    const tex = el.dataset.tex;
    const display = el.classList.contains('tex-block');
    if (window.katex) {
      try { katex.render(tex, el, { displayMode: display, throwOnError: false, strict: 'ignore' }); el.dataset.rendered = '1'; }
      catch (e) { el.textContent = tex; }
    } else {
      el.textContent = tex;
    }
  });
}
function tex(str, block = false) {
  return `<span class="${block ? 'tex tex-block' : 'tex'}" data-tex="${str.replace(/"/g, '&quot;')}"></span>`;
}

/* ---------------- 控件工厂 ---------------- */
const UI = {
  checkbox(label, pname, value, onChange) {
    const input = h('input', { type: 'checkbox' }); input.checked = value;
    const wrap = h('label', { class: 'ctrl' }, [input, pname ? h('span', { class: 'pname', text: pname }) : null, label ? h('span', { text: label }) : null]);
    input.addEventListener('change', () => onChange(input.checked));
    wrap.input = input;
    return wrap;
  },
  slider(pname, label, { min, max, step, value, format = v => v }, onInput) {
    const input = h('input', { type: 'range', min, max, step }); input.value = value;
    const val = h('span', { class: 'val', text: format(+value) });
    const wrap = h('label', { class: 'ctrl' }, [h('span', { class: 'pname', text: pname }), label ? h('span', { class: 'muted small', text: label }) : null, input, val]);
    input.addEventListener('input', () => { val.textContent = format(+input.value); onInput(+input.value); });
    wrap.input = input;
    wrap.set = v => { input.value = v; val.textContent = format(+v); };
    return wrap;
  },
  seg(pname, options, value, onChange) {
    const seg = h('div', { class: 'seg' });
    const btns = options.map(o => {
      const opt = typeof o === 'object' ? o : { value: o, label: String(o) };
      const b = h('button', { type: 'button', text: opt.label });
      b.dataset.value = opt.value;
      b.addEventListener('click', () => { set(opt.value); onChange(opt.value); });
      seg.append(b);
      return [opt.value, b];
    });
    function set(v) { btns.forEach(([val, b]) => b.classList.toggle('on', String(val) === String(v))); }
    set(value);
    const wrap = h('div', { class: 'ctrl' }, [pname ? h('span', { class: 'pname', text: pname }) : null, seg]);
    wrap.set = set;
    return wrap;
  }
};

/* ---------------- 超参数卡片 ---------------- */
/**
 * params: [{ name, def, where, mean, up, down, typical, demo }]
 *  up / down：调大/调小（或 开启/关闭）会怎样；如果是布尔值可用 on / off
 */
function renderParams(container, params) {
  const wrap = h('div', { class: 'params' });
  params.forEach(p => {
    const rows = [];
    const row = (k, v) => v && rows.push(h('div', { class: 'p-row' }, [h('span', { class: 'k', text: k }), h('span', { html: v })]));
    row('开启时', p.on); row('关闭时', p.off);
    row('调大', p.up); row('调小', p.down);
    row('常用值', p.typical);
    row('备注', p.note);
    wrap.append(h('div', { class: 'param' }, [
      h('div', { class: 'p-head' }, [
        h('span', { class: 'p-name', text: p.name }),
        p.def != null ? h('span', { class: 'p-def', text: '默认 ' + p.def }) : null,
        p.demo ? h('span', { class: 'p-badge', text: '上方可调' }) : null
      ]),
      p.where ? h('div', { class: 'p-where', text: p.where }) : null,
      h('div', { class: 'p-mean', html: p.mean }),
      ...rows
    ]));
  });
  container.append(wrap);
}

/* ---------------- 图可视化组件 ---------------- */
class GraphView {
  /**
   * @param container  DOM
   * @param graph      { nodes: [{x, y, group, feat}], edges: [[a,b]] }
   * @param opts       { width, height, r, showFeat, idLabel }
   */
  constructor(container, graph, opts = {}) {
    this.g = graph;
    this.o = Object.assign({ width: 560, height: 320, r: 16, showFeat: true, idLabel: i => String(i) }, opts);
    const { width, height } = this.o;
    this.svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'viz', role: 'img' });
    container.append(this.svg);
    this.gLoops = s('g', {}, this.svg);
    this.gEdges = s('g', {}, this.svg);
    this.gNodes = s('g', {}, this.svg);
    this.gLabels = s('g', {}, this.svg);
    this.gOverlay = s('g', {}, this.svg);
    this.edgeEls = new Map();
    graph.edges.forEach(([a, b]) => {
      const A = graph.nodes[a], B = graph.nodes[b];
      const line = s('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: 'g-edge' }, this.gEdges);
      this.edgeEls.set(this.key(a, b), line);
    });
    this.nodeEls = graph.nodes.map((n, i) => {
      const g = s('g', { class: 'g-node', transform: `translate(${n.x},${n.y})` }, this.gNodes);
      const ring = s('circle', { r: this.o.r + 5, class: 'ring' }, g);
      const body = s('circle', { r: this.o.r, class: 'body' }, g);
      s('text', { class: 'id', text: this.o.idLabel(i) }, g);
      let feat = null;
      if (this.o.showFeat && n.feat) feat = s('text', { class: 'feat', y: this.o.r + 16, text: fmtVec(n.feat, 1) }, g);
      body.addEventListener('click', () => this.onClick && this.onClick(i));
      body.addEventListener('mousemove', e => this.onHover && Tooltip.show(this.onHover(i), e));
      body.addEventListener('mouseleave', () => Tooltip.hide());
      return { g, body, ring, feat };
    });
    this.resetStyle();
  }
  key(a, b) { return a < b ? `${a}-${b}` : `${b}-${a}`; }
  edge(a, b) { return this.edgeEls.get(this.key(a, b)); }
  nodeFill(i, color) { this.nodeEls[i].body.style.fill = color; }
  resetStyle() {
    this.edgeEls.forEach(l => { l.style.stroke = ''; l.style.strokeWidth = ''; l.style.opacity = ''; l.style.strokeDasharray = ''; });
    this.g.nodes.forEach((n, i) => {
      this.nodeEls[i].body.style.fill = n.group != null ? groupColor(n.group) : 'var(--muted)';
      this.nodeEls[i].g.style.opacity = '';
      this.nodeEls[i].g.classList.remove('selected');
    });
    this.gLoops.innerHTML = ''; this.gLabels.innerHTML = '';
  }
  select(i) { this.nodeEls.forEach((n, k) => n.g.classList.toggle('selected', k === i)); }
  styleEdge(a, b, st) {
    const l = this.edge(a, b); if (!l) return;
    if (st.stroke) l.style.stroke = st.stroke;
    if (st.width != null) l.style.strokeWidth = st.width;
    if (st.opacity != null) l.style.opacity = st.opacity;
    l.style.strokeDasharray = st.dash || '';
  }
  /** 在边上（靠近 target 一侧）写标签 */
  edgeLabel(src, dst, text, t = 0.5) {
    const A = this.g.nodes[src], B = this.g.nodes[dst];
    const x = A.x + (B.x - A.x) * t, y = A.y + (B.y - A.y) * t;
    s('text', { x, y, class: 'g-elabel', text }, this.gLabels);
  }
  /** 画自环（节点正上方的小圈） */
  selfLoop(i, st = {}, label = null) {
    const n = this.g.nodes[i], r = this.o.r;
    const d = `M ${n.x - 7} ${n.y - r + 2} C ${n.x - 26} ${n.y - r - 34}, ${n.x + 26} ${n.y - r - 34}, ${n.x + 7} ${n.y - r + 2}`;
    s('path', { d, class: 'g-edge', style: `stroke:${st.stroke || 'var(--edge)'};stroke-width:${st.width || 1.6};${st.dash ? 'stroke-dasharray:' + st.dash : ''}` }, this.gLoops);
    if (label) s('text', { x: n.x, y: n.y - r - 32, class: 'g-elabel', text: label }, this.gLabels);
  }
  hint(text) {
    s('text', { x: 8, y: this.o.height - 8, class: 'g-hint', text }, this.gLabels);
  }
}

/* ---------------- 散点图：特征空间 ---------------- */
class FeatureScatter {
  constructor(container, opts = {}) {
    this.o = Object.assign({ width: 420, height: 300, m: { t: 14, r: 16, b: 38, l: 44 }, xLabel: '特征维度 0', yLabel: '特征维度 1' }, opts);
    const { width, height } = this.o;
    this.svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'viz' });
    container.append(this.svg);
    const defs = s('defs', {}, this.svg);
    this.markerId = 'arr' + Math.random().toString(36).slice(2, 8);
    const mk = s('marker', { id: this.markerId, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    s('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--muted)' }, mk);
    this.root = s('g', {}, this.svg);
  }
  /**
   * points: [{ id, from?:[x,y], to:[x,y], group, strong, label }]
   * opts: { domain?:[[x0,x1],[y0,y1]], unitCircle?:bool }
   */
  update(points, opts = {}) {
    const { width, height, m } = this.o;
    const W = width - m.l - m.r, H = height - m.t - m.b;
    this.root.innerHTML = '';
    let dom = opts.domain;
    if (!dom) {
      const xs = [0], ys = [0];
      points.forEach(p => { [p.from, p.to].forEach(v => { if (v) { xs.push(v[0]); ys.push(v[1]); } }); });
      if (opts.unitCircle) { xs.push(-1, 1); ys.push(-1, 1); }
      const pad = (a, b) => { const d = (b - a) || 1; return [a - d * 0.08, b + d * 0.08]; };
      dom = [pad(Math.min(...xs), Math.max(...xs)), pad(Math.min(...ys), Math.max(...ys))];
    }
    const X = v => m.l + (v - dom[0][0]) / (dom[0][1] - dom[0][0]) * W;
    const Y = v => m.t + H - (v - dom[1][0]) / (dom[1][1] - dom[1][0]) * H;
    this.X = X; this.Y = Y;
    // 网格与坐标轴
    const ticks = (a, b) => niceTicks(a, b, 5);
    const gAx = s('g', { class: 'axis' }, this.root);
    ticks(dom[0][0], dom[0][1]).forEach(t => {
      s('line', { x1: X(t), x2: X(t), y1: m.t, y2: m.t + H, class: 'gridline' }, gAx);
      s('text', { x: X(t), y: m.t + H + 15, 'text-anchor': 'middle', text: +t.toFixed(2) }, gAx);
    });
    ticks(dom[1][0], dom[1][1]).forEach(t => {
      s('line', { x1: m.l, x2: m.l + W, y1: Y(t), y2: Y(t), class: 'gridline' }, gAx);
      s('text', { x: m.l - 6, y: Y(t) + 4, 'text-anchor': 'end', text: +t.toFixed(2) }, gAx);
    });
    if (dom[0][0] <= 0 && dom[0][1] >= 0) s('line', { x1: X(0), x2: X(0), y1: m.t, y2: m.t + H, stroke: 'var(--axis)' }, gAx);
    if (dom[1][0] <= 0 && dom[1][1] >= 0) s('line', { x1: m.l, x2: m.l + W, y1: Y(0), y2: Y(0), stroke: 'var(--axis)' }, gAx);
    s('text', { x: m.l + W / 2, y: height - 4, 'text-anchor': 'middle', class: 'axis-title', text: this.o.xLabel }, this.root);
    s('text', { x: 12, y: m.t + H / 2, 'text-anchor': 'middle', class: 'axis-title', transform: `rotate(-90 12 ${m.t + H / 2})`, text: this.o.yLabel }, this.root);
    if (opts.unitCircle) {
      const rx = X(1) - X(0), ry = Y(0) - Y(1);
      s('ellipse', { cx: X(0), cy: Y(0), rx, ry, fill: 'none', stroke: 'var(--accent)', 'stroke-dasharray': '4 4', opacity: 0.7 }, this.root);
    }
    // 箭头：from -> to
    const gA = s('g', {}, this.root);
    points.forEach(p => {
      if (!p.from) return;
      const x1 = X(p.from[0]), y1 = Y(p.from[1]), x2 = X(p.to[0]), y2 = Y(p.to[1]);
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 8) return;
      const k = (len - 7) / len;
      s('line', { x1, y1, x2: x1 + (x2 - x1) * k, y2: y1 + (y2 - y1) * k, stroke: 'var(--muted)', 'stroke-width': p.strong ? 2 : 1, opacity: p.strong ? 0.95 : 0.45, 'marker-end': `url(#${this.markerId})` }, gA);
    });
    const gP = s('g', {}, this.root);
    points.forEach(p => {
      const col = groupColor(p.group);
      if (p.from) s('circle', { cx: X(p.from[0]), cy: Y(p.from[1]), r: 4.5, fill: 'var(--surface)', stroke: col, 'stroke-width': 1.5, opacity: p.strong === false ? 0.5 : 0.9 }, gP);
      const c = s('circle', { cx: X(p.to[0]), cy: Y(p.to[1]), r: p.strong ? 7.5 : 5.5, fill: col, stroke: p.strong ? 'var(--ink)' : 'var(--surface)', 'stroke-width': p.strong ? 2 : 1.5 }, gP);
      if (p.label != null) s('text', { x: X(p.to[0]) + 9, y: Y(p.to[1]) - 7, class: 'axis-title', style: 'fill:var(--ink-2);font-size:11px', text: p.label }, gP);
      const hit = s('circle', { cx: X(p.to[0]), cy: Y(p.to[1]), r: 11, fill: 'transparent' }, gP);
      hit.addEventListener('mousemove', e => Tooltip.show(p.tip || `节点 ${p.id}<br>${p.from ? '输入 ' + fmtVec(p.from) + '<br>' : ''}输出 ${fmtVec(p.to)}`, e));
      hit.addEventListener('mouseleave', () => Tooltip.hide());
    });
  }
}

function niceTicks(a, b, n) {
  const span = b - a; if (span <= 0) return [a];
  const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const out = [];
  for (let t = Math.ceil(a / step) * step; t <= b + 1e-9; t += step) out.push(+t.toFixed(10));
  return out;
}

/* ---------------- 折线图 ---------------- */
class LineChart {
  constructor(container, opts = {}) {
    this.o = Object.assign({ width: 460, height: 240, m: { t: 12, r: 64, b: 36, l: 46 }, xLabel: '', yLabel: '', yDomain: null, xDomain: null, yFormat: v => +v.toFixed(2) }, opts);
    this.legend = h('div', { class: 'legend' });
    container.append(this.legend);
    const { width, height } = this.o;
    this.svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'viz' });
    container.append(this.svg);
    this.root = s('g', {}, this.svg);
    this.series = [];
  }
  /** series: [{ name, color, values: [[x, y], ...] }]；marker: 竖线位置 */
  update(series, marker = null) {
    this.series = series;
    const { width, height, m } = this.o;
    const W = width - m.l - m.r, H = height - m.t - m.b;
    this.legend.innerHTML = series.length > 1 ? series.map(se => `<span><span class="sw" style="background:${se.color}"></span>${se.name}</span>`).join('') : '';
    this.root.innerHTML = '';
    const all = series.flatMap(se => se.values);
    const xd = this.o.xDomain || [Math.min(...all.map(v => v[0]), 0), Math.max(...all.map(v => v[0]), 1)];
    let yd = this.o.yDomain ? this.o.yDomain.slice() : [0, Math.max(...all.map(v => v[1]), 1e-6) * 1.08];
    if (this.o.yMaxCap) yd[1] = Math.min(yd[1], this.o.yMaxCap);
    const X = v => m.l + (v - xd[0]) / (xd[1] - xd[0] || 1) * W;
    const Y = v => m.t + H - (clamp(v, yd[0], yd[1]) - yd[0]) / (yd[1] - yd[0] || 1) * H;
    const gAx = s('g', { class: 'axis' }, this.root);
    niceTicks(yd[0], yd[1], 4).forEach(t => {
      s('line', { x1: m.l, x2: m.l + W, y1: Y(t), y2: Y(t), class: 'gridline' }, gAx);
      s('text', { x: m.l - 6, y: Y(t) + 4, 'text-anchor': 'end', text: this.o.yFormat(t) }, gAx);
    });
    niceTicks(xd[0], xd[1], 5).forEach(t => {
      s('text', { x: X(t), y: m.t + H + 15, 'text-anchor': 'middle', text: +t.toFixed(2) }, gAx);
    });
    s('line', { x1: m.l, x2: m.l + W, y1: m.t + H, y2: m.t + H, stroke: 'var(--axis)' }, gAx);
    s('text', { x: m.l + W / 2, y: height - 3, 'text-anchor': 'middle', class: 'axis-title', text: this.o.xLabel }, this.root);
    s('text', { x: 11, y: m.t + H / 2, 'text-anchor': 'middle', class: 'axis-title', transform: `rotate(-90 11 ${m.t + H / 2})`, text: this.o.yLabel }, this.root);
    if (marker != null) s('line', { x1: X(marker), x2: X(marker), y1: m.t, y2: m.t + H, stroke: 'var(--accent)', 'stroke-dasharray': '3 3' }, this.root);
    const ends = [];
    series.forEach(se => {
      if (!se.values.length) return;
      const d = se.values.map((v, i) => (i ? 'L' : 'M') + X(v[0]).toFixed(1) + ',' + Y(v[1]).toFixed(1)).join(' ');
      s('path', { d, fill: 'none', stroke: se.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-dasharray': se.dash || null }, this.root);
      const last = se.values[se.values.length - 1];
      ends.push({ x: X(last[0]) + 6, y: Y(last[1]) + 4, name: se.name });
    });
    // 末端标签防重叠：按 y 排序后保持至少 12px 间距
    ends.sort((a, b) => a.y - b.y);
    ends.forEach((e, k) => { if (k && e.y - ends[k - 1].y < 12) e.y = ends[k - 1].y + 12; });
    const over = ends.length ? ends[ends.length - 1].y - (m.t + H + 4) : 0;
    if (over > 0) ends.forEach(e => { e.y -= over; });
    ends.forEach(e => s('text', { x: e.x, y: e.y, class: 'axis-title', style: 'fill:var(--ink-2);font-size:11px', text: e.name }, this.root));
    // 悬停：十字线 + tooltip
    const cross = s('line', { y1: m.t, y2: m.t + H, stroke: 'var(--muted)', opacity: 0 }, this.root);
    const dots = series.map(se => s('circle', { r: 4, fill: se.color, stroke: 'var(--surface)', 'stroke-width': 2, opacity: 0 }, this.root));
    const hit = s('rect', { x: m.l, y: m.t, width: W, height: H, fill: 'transparent' }, this.root);
    hit.addEventListener('mousemove', e => {
      const pt = this.svg.getBoundingClientRect();
      const px = (e.clientX - pt.left) / pt.width * width;
      const xv = xd[0] + (px - m.l) / W * (xd[1] - xd[0]);
      let html = '', xs = null;
      series.forEach((se, k) => {
        if (!se.values.length) return;
        let best = se.values[0];
        se.values.forEach(v => { if (Math.abs(v[0] - xv) < Math.abs(best[0] - xv)) best = v; });
        xs = best[0];
        dots[k].setAttribute('cx', X(best[0])); dots[k].setAttribute('cy', Y(best[1])); dots[k].setAttribute('opacity', 1);
        html += `<div><span class="sw" style="background:${se.color}"></span>${se.name}：<b>${this.o.yFormat(best[1])}</b></div>`;
      });
      if (xs == null) return;
      cross.setAttribute('x1', X(xs)); cross.setAttribute('x2', X(xs)); cross.setAttribute('opacity', 0.6);
      Tooltip.show(`<div class="t-title">${this.o.xLabel} = ${xs}</div>${html}`, e);
    });
    hit.addEventListener('mouseleave', () => { cross.setAttribute('opacity', 0); dots.forEach(d => d.setAttribute('opacity', 0)); Tooltip.hide(); });
  }
}

/* ---------------- 示例小图（8 个节点，2 维特征） ---------------- */
const TOY = {
  nodes: [
    { x: 60, y: 160, group: 0, feat: [1.0, 0.1] },
    { x: 150, y: 72, group: 0, feat: [0.8, 0.3] },
    { x: 150, y: 248, group: 0, feat: [0.9, 0.0] },
    { x: 240, y: 160, group: 0, feat: [0.6, 0.5] },
    { x: 340, y: 160, group: 1, feat: [0.4, 0.7] },
    { x: 430, y: 72, group: 1, feat: [0.1, 0.9] },
    { x: 430, y: 248, group: 1, feat: [0.2, 1.0] },
    { x: 520, y: 160, group: 1, feat: [0.0, 0.6] }
  ],
  edges: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [3, 4], [4, 5], [4, 6], [5, 6], [6, 7]]
};
TOY.n = TOY.nodes.length;
TOY.X = TOY.nodes.map(n => n.feat);
TOY.nbrs = Array.from({ length: TOY.n }, () => []);
TOY.edges.forEach(([a, b]) => { TOY.nbrs[a].push(b); TOY.nbrs[b].push(a); });
TOY.nbrs.forEach(l => l.sort((a, b) => a - b));
TOY.deg = TOY.nbrs.map(l => l.length);

/** 节点小圆点（用于表格） */
function chip(i, group = TOY.nodes[i]?.group) {
  return `<span class="nodechip" style="background:${groupColor(group)}">${i}</span>`;
}

/* ---------------- 随机块模型（SBM）图：3 个社区，45 个节点 ---------------- */
function makeSBM(seed = 7, nPer = 15, C = 3, pin = 0.3, pout = 0.025) {
  const r = mulberry32(seed);
  const n = nPer * C, y = [];
  for (let c = 0; c < C; c++) for (let k = 0; k < nPer; k++) y.push(c);
  const edges = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (r() < (y[i] === y[j] ? pin : pout)) edges.push([i, j]);
  // 2 维特征（用于过平滑演示）
  const centers = [[1, 0.25], [0.25, 1], [0.9, 0.9]];
  const X2 = y.map(c => [centers[c][0] + 0.35 * gauss(r), centers[c][1] + 0.35 * gauss(r)]);
  // 8 维带噪特征（用于训练实验）：只有第 c 维有微弱的类别信号
  const F = 8;
  const X8 = y.map(c => Array.from({ length: F }, (_, f) => (f === c ? 0.8 : 0) + gauss(r)));
  const nbrs = Array.from({ length: n }, () => []);
  edges.forEach(([a, b]) => { nbrs[a].push(b); nbrs[b].push(a); });
  return { n, C, y, edges, nbrs, X2, X8, F, layout: forceLayout(n, edges, y, C, seed) };
}

/** 简单的力导向布局（Fruchterman-Reingold），结果可复现 */
function forceLayout(n, edges, y, C, seed, W = 560, H = 380) {
  const r = mulberry32(seed + 101);
  const pos = y.map(c => {
    const a = c / C * Math.PI * 2 - Math.PI / 2;
    return [W / 2 + Math.cos(a) * 130 + (r() - 0.5) * 80, H / 2 + Math.sin(a) * 110 + (r() - 0.5) * 80];
  });
  const k = Math.sqrt(W * H / n) * 0.62;
  let temp = 40;
  for (let it = 0; it < 400; it++) {
    const disp = pos.map(() => [0, 0]);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = pos[i][0] - pos[j][0], dy = pos[i][1] - pos[j][1];
      const d = Math.max(Math.hypot(dx, dy), 0.01), f = k * k / d;
      dx /= d; dy /= d;
      disp[i][0] += dx * f; disp[i][1] += dy * f; disp[j][0] -= dx * f; disp[j][1] -= dy * f;
    }
    edges.forEach(([a, b]) => {
      let dx = pos[a][0] - pos[b][0], dy = pos[a][1] - pos[b][1];
      const d = Math.max(Math.hypot(dx, dy), 0.01), f = d * d / k;
      dx /= d; dy /= d;
      disp[a][0] -= dx * f; disp[a][1] -= dy * f; disp[b][0] += dx * f; disp[b][1] += dy * f;
    });
    for (let i = 0; i < n; i++) {
      // 轻微的向心力，防止孤立点飘远
      disp[i][0] += (W / 2 - pos[i][0]) * 0.02 * k / 10; disp[i][1] += (H / 2 - pos[i][1]) * 0.02 * k / 10;
      const d = Math.max(Math.hypot(disp[i][0], disp[i][1]), 0.01), m = Math.min(d, temp);
      pos[i][0] += disp[i][0] / d * m; pos[i][1] += disp[i][1] / d * m;
    }
    temp = Math.max(1, temp * 0.985);
  }
  // 缩放到画布内
  const xs = pos.map(p => p[0]), ys = pos.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = 22, sc = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
  const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
  return pos.map(p => [ox + (p[0] - x0) * sc, oy + (p[1] - y0) * sc]);
}

/** GCN 传播矩阵 D^-1/2 (A+I) D^-1/2 的邻接表形式 */
function gcnPropagator(n, edges, withGraph = true) {
  const d = new Array(n).fill(1);
  if (withGraph) edges.forEach(([a, b]) => { d[a]++; d[b]++; });
  const nb = Array.from({ length: n }, (_, i) => [[i, 1 / d[i]]]);
  if (withGraph) edges.forEach(([a, b]) => { const w = 1 / Math.sqrt(d[a] * d[b]); nb[a].push([b, w]); nb[b].push([a, w]); });
  return nb;
}

/* ---------------- 路由（单页多节） ---------------- */
const Sections = {};   // id -> { init(), inited }
function registerSection(id, init) { Sections[id] = { init, inited: false }; }

function showSection(id) {
  const secs = $$('.section');
  if (!secs.some(s => s.id === id)) id = secs[0].id;
  secs.forEach(sec => sec.classList.toggle('active', sec.id === id));
  $$('.nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
  const sec = Sections[id];
  if (sec && !sec.inited) { sec.inited = true; sec.init(); }
  renderTex($('#' + id));
  window.scrollTo(0, 0);
}

function buildPagers() {
  const secs = $$('.section');
  secs.forEach((sec, i) => {
    const prev = secs[i - 1], next = secs[i + 1];
    const title = el => el.querySelector('h1').textContent;
    sec.append(h('div', { class: 'pager' }, [
      prev ? h('a', { href: '#' + prev.id, text: '← ' + title(prev) }) : h('span'),
      next ? h('a', { href: '#' + next.id, text: title(next) + ' →' }) : h('span')
    ]));
  });
}

/* ---------------- 主题 ---------------- */
function initTheme() {
  const saved = localStorage.getItem('gnn-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  const btn = $('#themeBtn');
  const label = () => {
    const dark = document.documentElement.dataset.theme === 'dark' ||
      (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    btn.textContent = dark ? '☀ 切换到浅色' : '☾ 切换到深色';
    return dark;
  };
  label();
  btn.addEventListener('click', () => {
    const dark = label();
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    localStorage.setItem('gnn-theme', document.documentElement.dataset.theme);
    label();
    // 颜色依赖 CSS 变量读取的组件需要重绘
    window.dispatchEvent(new Event('themechange'));
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  buildPagers();
  const go = () => showSection(location.hash.slice(1) || 'intro');
  window.addEventListener('hashchange', go);
  go();
  // KaTeX 是 defer 加载的，可能晚于本脚本
  window.addEventListener('load', () => renderTex(document));
});
