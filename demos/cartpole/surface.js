(() => {
'use strict';
const { Policy, seededRandom } = globalThis.CartPoleDemo;
const ANGLE_LIMIT = 12, OMEGA_LIMIT = 2, GRID_SIZE = 25;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Angles on the axes are degrees. The policy still receives radians, as during training.
function sampleDecisionSurface(policy, position, velocity, size = GRID_SIZE) {
  if (!Number.isFinite(position) || !Number.isFinite(velocity) || !Number.isInteger(size) || size < 2) {
    throw new RangeError('A surface needs finite slice conditions and at least two samples per axis.');
  }
  const points = [];
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const x = -1 + 2 * column / (size - 1), y = -1 + 2 * row / (size - 1);
      const angle = x * ANGLE_LIMIT, omega = y * OMEGA_LIMIT;
      const probability = policy.forward([position, velocity, angle * Math.PI / 180, omega]).probs[1];
      points.push({ x, y, probability, angle, omega });
    }
  }
  const faces = [];
  for (let row = 0; row < size - 1; row++) {
    for (let column = 0; column < size - 1; column++) {
      const a = row * size + column, b = a + 1, c = a + size, d = c + 1;
      faces.push([a, b, c], [b, d, c]);
    }
  }
  return { points, faces, size };
}

// Linear interpolation on sampled triangles, rather than inventing a decision boundary.
function decisionContour(triangle) {
  const crossings = [];
  for (let i = 0; i < 3; i++) {
    const a = triangle[i], b = triangle[(i + 1) % 3];
    if ((a.probability <= 0.5 && b.probability > 0.5) || (b.probability <= 0.5 && a.probability > 0.5)) {
      const t = (0.5 - a.probability) / (b.probability - a.probability);
      crossings.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), probability: 0.5 });
    }
  }
  return crossings.length === 2 ? crossings : [];
}

class DecisionSurface {
  constructor() {
    this.root = document.getElementById('decision-surface');
    this.get = id => document.getElementById(id);
    this.before = new Policy(seededRandom(42));
    this.selected = new Policy(seededRandom(42));
    this.parameters = null;
    this.position = 0; this.velocity = 0;
    this.angle = 0; this.omega = 0;
    this.yaw = -0.65; this.pitch = 0.6;
    this.visible = false; this.pending = false;
    this.beforeDirty = true; this.selectedDirty = true;
    this.plots = ['surface-before', 'surface-selected'].map(id => {
      const canvas = this.get(id), ctx = canvas.getContext('2d');
      const plot = { canvas, ctx, width: 0, height: 0, grid: null, faces: [] };
      new ResizeObserver(() => {
        const ratio = Math.min(devicePixelRatio || 1, 2);
        plot.width = canvas.clientWidth; plot.height = canvas.clientHeight;
        canvas.width = Math.round(plot.width * ratio); canvas.height = Math.round(plot.height * ratio);
        ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.requestRender(true);
      }).observe(canvas);
      canvas.addEventListener('click', event => this.pick(plot, event));
      canvas.addEventListener('keydown', event => {
        const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[event.key];
        if (!steps) return;
        event.preventDefault();
        this.angle = clamp(this.angle + steps[0], -ANGLE_LIMIT, ANGLE_LIMIT);
        this.omega = clamp(this.omega + steps[1], -OMEGA_LIMIT, OMEGA_LIMIT);
        this.requestRender(true);
      });
      return plot;
    });
    for (const id of ['slice-position', 'slice-velocity']) this.get(id).addEventListener('input', () => {
      this.position = +this.get('slice-position').value;
      this.velocity = +this.get('slice-velocity').value;
      this.get('slice-position-value').textContent = `${this.position.toFixed(1)} m`;
      this.get('slice-velocity-value').textContent = `${this.velocity.toFixed(1)} m/s`;
      this.beforeDirty = this.selectedDirty = true;
      this.requestRender(true);
    });
    this.get('surface-left').addEventListener('click', () => { this.yaw -= Math.PI / 12; this.requestRender(true); });
    this.get('surface-right').addEventListener('click', () => { this.yaw += Math.PI / 12; this.requestRender(true); });
    this.get('surface-reset').addEventListener('click', () => {
      this.yaw = -0.65; this.angle = this.omega = 0; this.requestRender(true);
    });
    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(entries => {
        this.visible = entries[0].isIntersecting;
        if (this.visible) this.requestRender();
      }).observe(this.root);
    } else this.visible = true;
    this.requestRender(true);
  }

  setPolicy(policy, label) {
    const parameters = policy.snapshot();
    if (!this.parameters || parameters.some((value, i) => value !== this.parameters[i])) {
      this.selected.load(parameters);
      this.parameters = parameters;
      this.selectedDirty = true;
    }
    const source = `当前曲面：${label}`;
    if (this.get('surface-source').textContent !== source) this.get('surface-source').textContent = source;
    if (this.selectedDirty) this.requestRender();
  }

  requestRender(force = false) {
    if (this.pending || (!force && !this.visible)) return;
    this.pending = true;
    requestAnimationFrame(() => { this.pending = false; this.render(); });
  }

  project(point, width, height) {
    const cosine = Math.cos(this.yaw), sine = Math.sin(this.yaw);
    const horizontal = point.x * cosine - point.y * sine;
    const ground = point.x * sine + point.y * cosine, z = (point.probability - 0.5) * 1.6;
    const vertical = z * Math.cos(this.pitch) - ground * Math.sin(this.pitch);
    const horizontalExtent = Math.abs(cosine) + Math.abs(sine);
    const verticalExtent = 0.8 * Math.cos(this.pitch) + horizontalExtent * Math.sin(this.pitch);
    const scale = Math.min((width - 100) / (2 * horizontalExtent), (height - 98) / (2 * verticalExtent));
    return { x: width / 2 + horizontal * scale, y: height / 2 - vertical * scale,
      depth: ground * Math.cos(this.pitch) + z * Math.sin(this.pitch) };
  }

  render() {
    if (this.beforeDirty) this.plots[0].grid = sampleDecisionSurface(this.before, this.position, this.velocity);
    if (this.selectedDirty) this.plots[1].grid = sampleDecisionSurface(this.selected, this.position, this.velocity);
    this.beforeDirty = this.selectedDirty = false;
    this.plots.forEach(plot => this.draw(plot));
    const state = [this.position, this.velocity, this.angle * Math.PI / 180, this.omega];
    const before = this.before.forward(state).probs[1], selected = this.selected.forward(state).probs[1];
    const values = {
      'probe-state': `角度 ${this.angle.toFixed(1)}°，角速度 ${this.omega.toFixed(2)} rad/s`,
      'probe-before': `${(before * 100).toFixed(1)}%`,
      'probe-selected': `${(selected * 100).toFixed(1)}%`
    };
    for (const [id, value] of Object.entries(values)) if (this.get(id).textContent !== value) this.get(id).textContent = value;
  }

  draw(plot) {
    const { canvas, ctx, width, height, grid } = plot;
    if (!ctx || !grid || width < 100 || !height) return;
    const project = point => this.project(point, width, height);
    const line = (a, b, color, weight = 1) => {
      const start = project(a), end = project(b);
      ctx.strokeStyle = color; ctx.lineWidth = weight;
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    };
    const label = (value, point, dx = 0, dy = 0, color = '#b8c7da') => {
      const screen = project(point);
      ctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center';
      const half = ctx.measureText(value).width / 2;
      ctx.fillText(value, clamp(screen.x + dx, half + 6, width - half - 6), clamp(screen.y + dy, 14, height - 8));
    };
    ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, width, height);
    for (const value of [-1, -0.5, 0, 0.5, 1]) {
      line({ x: value, y: -1, probability: 0 }, { x: value, y: 1, probability: 0 }, '#26364d');
      line({ x: -1, y: value, probability: 0 }, { x: 1, y: value, probability: 0 }, '#26364d');
    }
    plot.faces = grid.faces.map(indices => {
      const triangle = indices.map(index => grid.points[index]), projected = triangle.map(project);
      return { triangle, projected, depth: projected.reduce((sum, point) => sum + point.depth, 0) / 3 };
    }).sort((a, b) => a.depth - b.depth);
    for (const { triangle, projected } of plot.faces) {
      const probability = triangle.reduce((sum, point) => sum + point.probability, 0) / 3;
      const from = probability < 0.5 ? [251, 113, 133] : [100, 116, 139];
      const to = probability < 0.5 ? [100, 116, 139] : [56, 189, 248];
      const fraction = probability < 0.5 ? probability * 2 : (probability - 0.5) * 2;
      ctx.fillStyle = `rgb(${from.map((value, i) => Math.round(value + fraction * (to[i] - value))).join(',')})`;
      ctx.beginPath(); ctx.moveTo(projected[0].x, projected[0].y);
      ctx.lineTo(projected[1].x, projected[1].y); ctx.lineTo(projected[2].x, projected[2].y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(15,23,42,0.18)'; ctx.lineWidth = 0.4; ctx.stroke();
      const contour = decisionContour(triangle);
      if (contour.length) line(contour[0], contour[1], '#fff', 2);
    }
    const nearX = Math.sin(this.yaw) >= 0 ? 1 : -1, nearY = Math.cos(this.yaw) >= 0 ? 1 : -1;
    // Put the probability ruler on the left edge, away from the center probe and 50% contour.
    const origin = [-1, 1].flatMap(x => [-1, 1].map(y => ({ x, y, probability: 0 })))
      .reduce((left, corner) => project(corner).x < project(left).x ? corner : left);
    line({ x: -1, y: nearY, probability: 0 }, { x: 1, y: nearY, probability: 0 }, '#9aacbf');
    line({ x: nearX, y: -1, probability: 0 }, { x: nearX, y: 1, probability: 0 }, '#9aacbf');
    line(origin, { ...origin, probability: 1 }, '#cbd5e1');
    for (const value of [0, 0.5, 1]) label(`${value * 100}%`, { ...origin, probability: value }, -24, 3);
    for (const value of [-1, 0, 1]) {
      label(`${value * ANGLE_LIMIT}°`, { x: value, y: nearY, probability: 0 }, 12, 24);
      label(`${value * OMEGA_LIMIT}`, { x: nearX, y: value, probability: 0 }, -25, 20);
    }
    label('角度 θ（°）', { x: 0.55, y: nearY * 1.28, probability: 0 }, 14, 50);
    label('角速度 ω（rad/s）', { x: nearX * 1.18, y: -0.45, probability: 0 }, -5, 50);
    label('向右推概率 ↑', { ...origin, probability: 1 }, 10, -20, '#e2e8f0');
    const policy = plot === this.plots[0] ? this.before : this.selected;
    const probability = policy.forward([this.position, this.velocity, this.angle * Math.PI / 180, this.omega]).probs[1];
    const point = { x: this.angle / ANGLE_LIMIT, y: this.omega / OMEGA_LIMIT, probability };
    ctx.setLineDash([3, 3]); line({ ...point, probability: 0 }, point, '#f8fafc'); ctx.setLineDash([]);
    const screen = project(point);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const probabilities = grid.points.map(point => point.probability);
    canvas.dataset.samples = String(grid.points.length);
    canvas.dataset.minimum = String(Math.min(...probabilities));
    canvas.dataset.maximum = String(Math.max(...probabilities));
    this.get(`${canvas.id}-range`).textContent = `范围 ${(Math.min(...probabilities) * 100).toFixed(0)}–${(Math.max(...probabilities) * 100).toFixed(0)}%`;
    canvas.setAttribute('aria-label', `${plot === this.plots[0] ? '未训练' : '当前策略'}的三维决策切片，位置 ${this.position} 米，速度 ${this.velocity} 米每秒，向右推概率范围 ${(Math.min(...probabilities) * 100).toFixed(1)}% 到 ${(Math.max(...probabilities) * 100).toFixed(1)}%。使用方向键选择角度与角速度。`);
  }

  pick(plot, event) {
    const rect = plot.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - plot.canvas.clientLeft, y = event.clientY - rect.top - plot.canvas.clientTop;
    // Search the last-painted, nearest triangles first; do not pick an occluded grid vertex.
    for (let i = plot.faces.length - 1; i >= 0; i--) {
      const { projected: [a, b, c], triangle } = plot.faces[i];
      const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(denominator) < 1e-8) continue;
      const u = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denominator;
      const v = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denominator, w = 1 - u - v;
      if (u < 0 || v < 0 || w < 0) continue;
      this.angle = clamp(u * triangle[0].angle + v * triangle[1].angle + w * triangle[2].angle, -ANGLE_LIMIT, ANGLE_LIMIT);
      this.omega = clamp(u * triangle[0].omega + v * triangle[1].omega + w * triangle[2].omega, -OMEGA_LIMIT, OMEGA_LIMIT);
      this.requestRender(true);
      break;
    }
  }
}

Object.assign(globalThis.CartPoleDemo, { DecisionSurface, sampleDecisionSurface, decisionContour });
})();
