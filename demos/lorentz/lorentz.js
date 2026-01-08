export function clampVelocity(v, maxAbs = 0.999) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-maxAbs, Math.min(maxAbs, v));
}

export function gamma(v) {
  const vv = v * v;
  const denom = Math.max(1e-12, 1 - vv);
  return 1 / Math.sqrt(denom);
}

// 从静止系 (x, t) 到以速度 +v 沿 +x 运动的系 (x', t')。
// 取 c = 1，因此 x 与 t 同量纲。
export function lorentzTransform({ x, t }, v) {
  const g = gamma(v);
  return {
    x: g * (x - v * t),
    t: g * (t - v * x)
  };
}

export function inverseLorentzTransform({ x, t }, v) {
  const g = gamma(v);
  return {
    x: g * (x + v * t),
    t: g * (t + v * x)
  };
}

export function intervalSquared({ x, t }) {
  return t * t - x * x;
}

export function rapidity(v) {
  const vv = clampVelocity(v, 0.999999);
  if (typeof Math.atanh === "function") return Math.atanh(vv);
  return 0.5 * Math.log((1 + vv) / (1 - vv));
}

// 速度变换：对象在 (x,t) 中速度为 u（dx/dt），
// 切换到以速度 +v 运动的系 (x',t') 后的速度 u'（dx'/dt'）。
// 取 c = 1，因此要求 |u|<=1（光速为 1）。
export function velocityTransform(u, v) {
  const uu = clampVelocity(u, 1);
  const vv = clampVelocity(v, 0.999999);
  const denom = 1 - uu * vv;
  if (Math.abs(denom) < 1e-12) return uu > vv ? 1 : -1;
  const up = (uu - vv) / denom;
  return clampVelocity(up, 1);
}
