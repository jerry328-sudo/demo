(function (root) {
'use strict';
// ---- constants (simplified RBMK-1000 parameters) ----
const BETA = 0.005, LAMBDA = 8e-4, LAM_D = 0.08;
const LAM_I = 2.87e-5, LAM_X = 2.09e-5, R_XE = 3.7, F_I = 0.953, F_X = 0.047;
const ALPHA_V = 0.010, ALPHA_D = -1.5e-5, ALPHA_X = -0.05;
const TC = 557, DT_NOM = 450;
const ROD_SPEED = 1 / 18;
const W_ROD = 1.5e-4, W_AR = 4e-4, D_ROD = 2.4e-5;
const A_VOID = 1.05, SUB_PER_C = 0.0159;
const NOMINAL_MW = 3200;
const AR_SHAPE = 0.6, AB_SHAPE = 0.6, GV = 1.5, GD = 0.0015, GX = 0.8;
const T_RUPTURE = 2200;

function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function g(x) { return x - Math.sin(2 * Math.PI * x) / (2 * Math.PI); }
function bump(x) { if (x <= 0 || x >= 0.4) return 0; const s = Math.sin(Math.PI * x / 0.4); return s * s; }
function J0(x) { const x2 = x * x; return 1 - x2 / 4 + x2 * x2 / 64 - x2 * x2 * x2 / 2304 + x2 * x2 * x2 * x2 / 147456; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

const TYPE = { FUEL: 0, RR: 1, USP: 2, AR: 3 };

class Core {
  constructor() { this._build(); this.reset(); }

  _build() {
    const R = 23.6, cells = [], map = new Map();
    const m4 = v => ((v % 4) + 4) % 4;
    for (let iy = -24; iy <= 24; iy++) for (let ix = -24; ix <= 24; ix++) {
      if (ix * ix + iy * iy <= R * R) { map.set(ix + ',' + iy, cells.length); cells.push([ix, iy]); }
    }
    const N = this.N = cells.length;
    this.R = R;
    this.cx = new Float32Array(N); this.cy = new Float32Array(N);
    this.type = new Uint8Array(N);
    const rods = [];
    for (let i = 0; i < N; i++) {
      const [ix, iy] = cells[i]; this.cx[i] = ix; this.cy[i] = iy;
      if ((m4(ix) === 0 && m4(iy) === 0) || (m4(ix) === 2 && m4(iy) === 2)) { this.type[i] = TYPE.RR; rods.push(i); }
    }
    const pick = (r, deg, t) => {
      const a = deg * Math.PI / 180, px = r * Math.cos(a), py = r * Math.sin(a);
      let best = -1, bd = 1e9;
      for (const i of rods) { if (this.type[i] !== TYPE.RR) continue; const d = (this.cx[i] - px) ** 2 + (this.cy[i] - py) ** 2; if (d < bd) { bd = d; best = i; } }
      this.type[best] = t;
    };
    for (let k = 0; k < 12; k++) pick(0.5 * R, k * 30 + 7, TYPE.AR);
    for (let k = 0; k < 12; k++) { pick(0.3 * R, 15 + 30 * k, TYPE.USP); pick(0.82 * R, 30 * k, TYPE.USP); }
    this.rods = Int32Array.from(rods); const nR = this.nR = rods.length;
    this.rodType = new Uint8Array(nR); for (let j = 0; j < nR; j++) this.rodType[j] = this.type[rods[j]];
    this.rodX = new Float32Array(nR); this.rodX0 = new Float32Array(nR); this.rodTgt = new Float32Array(nR);
    const order = []; for (let j = 0; j < nR; j++) if (this.rodType[j] !== TYPE.AR) order.push(j);
    const rr = rng(426); for (let k = order.length - 1; k > 0; k--) { const m = Math.floor(rr() * (k + 1)); [order[k], order[m]] = [order[m], order[k]]; }
    this.pullOrder = Int32Array.from(order);
    this.rodShape = new Float32Array(nR);
    const fuel = []; for (let i = 0; i < N; i++) if (this.type[i] === TYPE.FUEL) fuel.push(i);
    this.fuel = Int32Array.from(fuel); this.Nf = fuel.length;
    this.nFuelType = { fuel: fuel.length, RR: 0, USP: 0, AR: 0 };
    for (let j = 0; j < nR; j++) { const t = this.rodType[j]; if (t === 1) this.nFuelType.RR++; else if (t === 2) this.nFuelType.USP++; else this.nFuelType.AR++; }

    // neighbours (8-connected)
    const nb = [], nbStart = new Int32Array(N + 1);
    for (let i = 0; i < N; i++) {
      nbStart[i] = nb.length; const [ix, iy] = cells[i];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const k = map.get((ix + dx) + ',' + (iy + dy)); if (k !== undefined) nb.push(k); }
    }
    nbStart[N] = nb.length; this.nb = Int32Array.from(nb); this.nbStart = nbStart;

    // rod kernel
    const kI = [], kW = [], kS = new Int32Array(N + 1), sig2 = 2 * 1.5 * 1.5;
    for (let i = 0; i < N; i++) {
      kS[i] = kI.length;
      for (let j = 0; j < nR; j++) { const c = rods[j]; const d2 = (this.cx[i] - this.cx[c]) ** 2 + (this.cy[i] - this.cy[c]) ** 2; if (d2 <= 16) { kI.push(j); kW.push(Math.exp(-d2 / sig2)); } }
    }
    kS[N] = kI.length; this.kI = Int32Array.from(kI); this.kW = Float32Array.from(kW); this.kS = kS;

    // base flux shape (flattened Bessel) and per-channel burnup noise
    this.s0 = new Float32Array(N); this.noise = new Float32Array(N);
    const rnd = rng(1986);
    const tmp = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = Math.hypot(this.cx[i], this.cy[i]);
      this.s0[i] = 0.42 + 0.58 * J0(2.405 * r / (R + 2.5));
      const u = Math.max(1e-9, rnd()), v = rnd();
      tmp[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    for (let i = 0; i < N; i++) { let s = 0, c = 0; for (let k = nbStart[i]; k < nbStart[i + 1]; k++) { s += tmp[nb[k]]; c++; } this.noise[i] = 0.16 * (0.6 * tmp[i] + 0.4 * s / c); }

    // per-channel state
    this.s = new Float32Array(N); this.v = new Float32Array(N); this.T = new Float32Array(N);
    this.I = new Float32Array(N); this.X = new Float32Array(N); this.rupt = new Uint8Array(N);
    this.field = new Float32Array(N); this.field2 = new Float32Array(N);
  }

  reset() {
    const N = this.N;
    this.t = 0; this.P = 1; this.flowPumps = 6; this.coast = null;
    this.subC = 14; this.setpoint = 1; this.arOn = true; this.operatorAssist = false;
    this.scram = false; this.scramT = 0;
    this.destroyed = false; this.destroyT = 0; this.ruptCount = 0;
    this.omega = 0; this.Pslow = 1; this.B = 0; this.events = []; this.flags = {};
    this.Pmax = 1; this.Tmax = 0;
    for (let j = 0; j < this.nR; j++) { const t = this.rodType[j]; this.rodX[j] = this.rodTgt[j] = t === TYPE.RR ? 0.4 : t === TYPE.USP ? 0.3 : 0.5; }
    this.opTimer = 0;
    this.rupt.fill(0);
    for (let i = 0; i < N; i++) this.s[i] = this.s0[i];
    this._normalize();
    // converge to steady state at nominal power
    for (let it = 0; it < 80; it++) {
      this._equilibriumThermal();
      this._shape(1e9);
    }
    this._equilibriumThermal();
    this.Tmax = this.fuel.reduce((maximum, i) => Math.max(maximum, this.T[i]), TC);
    this._averages();
    this.rho0 = 0;
    this.rho0 = -this._reactivity();
    this.rho = 0;
    this.C = BETA / (LAM_D * LAMBDA) * this.P;
    this.ormScale = 1; this.ormScale = 30 / this._ormRaw();
    this.ORM = 30;
  }

  get flow() {
    let eff = this.flowPumps;
    if (this.coast) eff = this.flowPumps - this.coast.n + this.coast.n * Math.exp(-this.coast.t / 50);
    return eff <= 6 ? eff / 6 : 1 + (eff - 6) * 0.12;
  }
  get sub() { return this.subC * SUB_PER_C; }
  get MW() { return this.P * NOMINAL_MW; }

  log(text, level, data) { this.events.push(Object.assign({ t: this.t, text, level: level || 'info' }, data)); }

  _normalize() {
    let m = 0; const f = this.fuel; for (let k = 0; k < this.Nf; k++) m += this.s[f[k]];
    m /= this.Nf; for (let i = 0; i < this.N; i++) this.s[i] /= m;
  }

  _voidEq(q, F) { const e = Math.max(0, q / F - this.sub); return 0.65 * e / (e + 0.1) + 0.35 * (1 - Math.exp(-Math.max(0, e - 2) / 6)); }

  _equilibriumThermal() {
    const F = this.flow, f = this.fuel;
    for (let k = 0; k < this.Nf; k++) {
      const i = f[k], q = this.P * this.s[i];
      this.v[i] = this._voidEq(q, F); this.T[i] = TC + DT_NOM * q;
      this.I[i] = q; this.X[i] = (1 + R_XE) * q / (1 + R_XE * q);
    }
  }

  _averages() {
    const f = this.fuel; let ws = 0, vw = 0, tw = 0, xw = 0, s2 = 0, vs = 0, xs = 0;
    for (let k = 0; k < this.Nf; k++) {
      const i = f[k], w = this.s0[i] * this.s0[i];
      ws += w; vw += w * this.v[i]; tw += w * this.T[i]; xw += w * this.X[i];
      vs += this.v[i]; xs += this.X[i];
    }
    this.wsum = ws; this.vW = vw / ws; this.TW = tw / ws; this.XW = xw / ws;
    this.s2mean = ws / this.Nf; this.vMean = vs / this.Nf; this.XMean = xs / this.Nf;
  }

  _rodWorth(j) {
    const x = this.rodX[j];
    let r = -(this.rodType[j] === TYPE.AR ? W_AR : W_ROD) * g(x);
    if (this.rodType[j] !== TYPE.USP) r += D_ROD * bump(x) * (1 + 2.5 * this.B);
    return r;
  }

  _reactivity() {
    let rr = 0; const sm = this.s2mean;
    for (let j = 0; j < this.nR; j++) { const c = this.rods[j]; rr += this._rodWorth(j) * (this.s0[c] * this.s0[c] / sm); }
    this.rhoRods = rr;
    this.rhoVoid = ALPHA_V * this.vW;
    this.rhoDop = ALPHA_D * (this.TW - TC);
    this.rhoXe = ALPHA_X * this.XW;
    return this.rho0 + rr + this.rhoVoid + this.rhoDop + this.rhoXe;
  }

  _ormRaw() {
    let o = 0; const sm = this.s2mean;
    for (let j = 0; j < this.nR; j++) { const c = this.rods[j]; o += g(this.rodX[j]) * (this.s0[c] * this.s0[c] / sm); }
    return o;
  }

  _shape(dt) {
    const N = this.N, f = this.fuel, fld = this.field, f2 = this.field2;
    for (let j = 0; j < this.nR; j++) {
      const x = this.rodX[j];
      this.rodShape[j] = -AR_SHAPE * g(x) + (this.rodType[j] !== TYPE.USP ? AB_SHAPE * bump(x) * (1 + 2.5 * this.B) : 0);
    }
    // thermal/xenon contributions relative to fuel means
    let vm = 0, tm = 0, xm = 0;
    for (let k = 0; k < this.Nf; k++) { const i = f[k]; vm += this.v[i]; tm += this.T[i]; xm += this.X[i]; }
    vm /= this.Nf; tm /= this.Nf; xm /= this.Nf;
    for (let i = 0; i < N; i++) {
      let r = this.noise[i];
      for (let k = this.kS[i]; k < this.kS[i + 1]; k++) r += this.kW[k] * this.rodShape[this.kI[k]];
      if (this.type[i] === TYPE.FUEL) r += GV * (this.v[i] - vm) - GD * (this.T[i] - tm) - GX * (this.X[i] - xm);
      fld[i] = r;
    }
    let mean = 0;
    for (let i = 0; i < N; i++) {
      let s = 0, c = 0; for (let k = this.nbStart[i]; k < this.nbStart[i + 1]; k++) { s += fld[this.nb[k]]; c++; }
      f2[i] = 0.55 * fld[i] + 0.45 * s / c; mean += f2[i];
    }
    mean /= N;
    // target shape, normalised over fuel
    let tsum = 0;
    for (let i = 0; i < N; i++) { fld[i] = this.s0[i] * Math.exp(clamp(f2[i] - mean, -2.5, 2.5)); }
    for (let k = 0; k < this.Nf; k++) tsum += fld[f[k]];
    const tn = this.Nf / tsum;
    const a = 1 - Math.exp(-dt / 0.3);
    for (let i = 0; i < N; i++) this.s[i] += (fld[i] * tn - this.s[i]) * a;
    this._normalize();
  }

  _kinetics(rho, dt) {
    const Sg = 1e-7;
    let rem = dt;
    while (rem > 1e-12) {
      let h = rem;
      if (rho > 0.5 * BETA) h = Math.min(h, 0.05 * LAMBDA / Math.max(rho - BETA, 0.0004));
      else h = Math.min(h, 0.05);
      const den = 1 - h * (rho - BETA) / LAMBDA - h * h * LAM_D * BETA / (LAMBDA * (1 + LAM_D * h));
      const Pn = (this.P + h * Sg + h * LAM_D * this.C / (1 + LAM_D * h)) / den;
      this.C = (this.C + h * BETA / LAMBDA * Pn) / (1 + LAM_D * h);
      this.P = Math.max(Pn, 1e-9);
      rem -= h;
    }
  }

  suggestDt() {
    if (this.destroyed) return 0.05;
    const r = this.rho / BETA, w = Math.abs(this.omega);
    if (r > 0.6 || this.P > 2.5 || w > 0.5) return 0.002;
    if (r > 0.3 || w > 0.05 || (this.scram && this.scramT < 40) || this.coast) return 0.02;
    if (w > 0.01 || r > 0.1) return 0.1;
    if (w > 0.002 || r > 0.03 || this.P < 0.3) return 0.5;
    return 1;
  }

  setGroup(type, x) { for (let j = 0; j < this.nR; j++) if (this.rodType[j] === type) this.rodTgt[j] = x; }
  groupMean(type, arr) { let s = 0, n = 0; const a = arr || this.rodX; for (let j = 0; j < this.nR; j++) if (this.rodType[j] === type) { s += a[j]; n++; } return n ? s / n : 0; }
  rodsOut() { let n = 0; for (let j = 0; j < this.nR; j++) if (this.rodType[j] !== TYPE.AR && this.rodX[j] < 0.02) n++; return n; }

  az5() {
    if (this.scram || this.destroyed) return;
    this.scram = true; this.scramT = 0; this.arOn = false; this.operatorAssist = false;
    for (let j = 0; j < this.nR; j++) this.rodX0[j] = this.rodX[j];
    this.log('AZ-5 pressed. All control rods start driving into the core at 0.4 m/s.', 'warn', { k: 'az5' });
  }

  startCoastdown(n) {
    if (this.coast || this.destroyed) return;
    const k = Math.min(n || Math.floor(this.flowPumps / 2), this.flowPumps);
    this.coast = { n: k, t: 0 };
    this.log(`Turbine stop valves closed. ${k} main circulation pumps coast down with the turbogenerator.`, 'warn', { k: 'coast', v: k });
  }

  step(dt) {
    this.t += dt;
    if (this.destroyed) { this._stepDestroyed(dt); return; }
    // ---- rods ----
    let arMean = 0, nAr = 0;
    let arVel = 0;
    if (this.arOn && !this.scram) {
      const err = Math.log(Math.max(this.P, 1e-9) / this.setpoint);
      arVel = clamp(0.05 * err + 2.5 * this.omega, -ROD_SPEED, ROD_SPEED);
    }
    for (let j = 0; j < this.nR; j++) {
      const t = this.rodType[j];
      if (this.scram) { this.rodX[j] = Math.min(1, this.rodX[j] + ROD_SPEED * dt); continue; }
      if (t === TYPE.AR) { if (this.arOn) this.rodX[j] = clamp(this.rodX[j] + arVel * dt, 0, 1); arMean += this.rodX[j]; nAr++; continue; }
      const d = this.rodTgt[j] - this.rodX[j], m = ROD_SPEED * dt;
      this.rodX[j] += Math.abs(d) <= m ? d : Math.sign(d) * m;
    }
    if (this.scram) this.scramT += dt;
    this.arMean = nAr ? arMean / nAr : 0;
    if (this.operatorAssist && !this.scram) {
      this.opTimer -= dt;
      if (this.opTimer <= 0) {
        const po = this.pullOrder;
        if (this.arMean < 0.3 && this.P < this.setpoint * 1.1) {
          for (let k = 0; k < po.length; k++) { const j = po[k]; if (this.rodTgt[j] > 0.001) { this.rodTgt[j] = 0; this.opTimer = 12; break; } }
        } else if (this.arMean > 0.7 && this.P > this.setpoint * 0.9) {
          let done = false;
          for (let k = po.length - 1; k >= 0 && !done; k--) { const j = po[k]; if (this.rodTgt[j] >= 0.3 && this.rodTgt[j] < 0.9) { this.rodTgt[j] = Math.min(1, this.rodTgt[j] + 0.3); done = true; } }
          for (let k = po.length - 1; k >= 0 && !done; k--) { const j = po[k]; if (this.rodTgt[j] < 0.001) { this.rodTgt[j] = 0.4; done = true; } }
          this.opTimer = 12;
        }
      }
    }
    if (this.coast) this.coast.t += dt;

    // ---- reactivity & kinetics ----
    this._averages();
    this.rho = this._reactivity();
    const P0 = this.P;
    this._kinetics(this.rho, dt);
    const w = (Math.log(this.P) - Math.log(P0)) / dt;
    this.omega += (w - this.omega) * (1 - Math.exp(-dt / 0.6));
    this.Pslow += (this.P - this.Pslow) * (1 - Math.exp(-dt / 600));
    this.Pmax = Math.max(this.Pmax, this.P);

    // ---- channel thermal hydraulics, fuel temperature, xenon ----
    const F = this.flow, f = this.fuel, P = this.P;
    const aI = 1 - Math.exp(-LAM_I * dt);
    let tmax = 0;
    for (let k = 0; k < this.Nf; k++) {
      const i = f[k], q = P * this.s[i];
      const veq = this._voidEq(q, F);
      const tv = 0.8 / (1 + 0.3 * q);
      this.v[i] += (veq - this.v[i]) * (1 - Math.exp(-dt / tv));
      let teq = TC + DT_NOM * q;
      if (this.v[i] > 0.95) teq += 600 * (this.v[i] - 0.95) / 0.05 * Math.min(1, q);
      this.T[i] += (teq - this.T[i]) * (1 - Math.exp(-dt / 6));
      this.I[i] += (q - this.I[i]) * aI;
      const X = this.X[i];
      this.X[i] = Math.max(0, X + LAM_X * ((1 + R_XE) * (F_I * this.I[i] + F_X * q) - X - R_XE * q * X) * dt);
      if (this.T[i] > tmax) tmax = this.T[i];
      if (!this.rupt[i] && (this.T[i] > T_RUPTURE || (q > 25 && this.v[i] > 0.97))) {
        this.rupt[i] = 1; this.ruptCount++;
        if (this.ruptCount === 1) this.log('Fuel channel pressure tube ruptured. Steam is escaping into the graphite stack.', 'crit', { k: 'rupture' });
      }
    }
    this.Tmax = tmax;
    this.B = clamp(1.2 * Math.max(0, this.XW - 1) + 0.6 * clamp((0.3 - this.Pslow) / 0.3, 0, 1), 0, 1);
    this._shape(dt);
    this.ORM = this._ormRaw() * this.ormScale;

    // ---- annunciators ----
    const fl = this.flags;
    const r$ = this.rho / BETA;
    if (r$ > 1 && !fl.prompt) { fl.prompt = true; this.log(`Prompt critical: reactivity ${r$.toFixed(2)} $. Power is now multiplying on prompt neutrons alone.`, 'crit', { k: 'prompt', v: r$.toFixed(2) }); }
    if (this.ORM < 15 && !fl.orm15 && !this.scram) { fl.orm15 = true; this.log(`Operational reactivity margin fell below 15 rods (${this.ORM.toFixed(1)}). Regulations require immediate shutdown.`, 'warn', { k: 'orm', v: this.ORM.toFixed(1) }); }
    if (this.ORM > 20) fl.orm15 = false;
    if (P > 1.2 && !fl.over) { fl.over = true; this.log(`Power above 120% of nominal (${Math.round(this.MW)} MW).`, 'warn', { k: 'over', v: Math.round(this.MW) }); }
    if (P < 1.05) fl.over = false;
    if (P > 10 && !fl.p10) { fl.p10 = true; this.log(`Power ×10 nominal (${(this.MW / 1000).toFixed(0)} GW). Fuel is fragmenting.`, 'crit', { k: 'ten', v: (this.MW / 1000).toFixed(0) }); }
    if (this.ruptCount > 0.03 * this.Nf) this._explode();
  }

  _explode() {
    this.destroyed = true; this.destroyT = 0;
    this.log(`Steam explosion. ${this.ruptCount} channels ruptured; the 1000-tonne upper shield lifts and the core is destroyed. Peak power ≈ ${Math.round(this.Pmax * NOMINAL_MW).toLocaleString('en-US')} MW.`, 'crit', { k: 'explode', v: this.ruptCount, v2: Math.round(this.Pmax * NOMINAL_MW).toLocaleString('en-US') });
  }

  _stepDestroyed(dt) {
    this.destroyT += dt;
    this.P = Math.max(1e-6, this.P * Math.exp(-dt / 0.15));
    this.rho = -0.2; this.omega = -5;
    for (let k = 0; k < this.Nf; k++) { const i = this.fuel[k]; this.T[i] += (1300 - this.T[i]) * (1 - Math.exp(-dt / 25)); this.v[i] = 1; }
  }
}

// ---- 26 April 1986 sequence (times in s after 25 Apr 1986 01:00) ----
const SCENARIO = [
  { t: 360, text: 'Power reduction begins ahead of the turbogenerator 8 rundown test.', warp: 3600 },
  { t: 43500, text: 'Reactor at 1600 MW (50%). Turbogenerator 7 disconnected.' },
  { t: 46800, text: 'Emergency core cooling system isolated. The Kyiv grid controller asks the unit to stay online, so the test is postponed.' },
  { t: 79800, text: 'Grid controller releases the unit. Power reduction resumes toward the 700–1000 MW test level.', warp: 1000 },
  { t: 84480, text: 'Control is switched from the local to the global automatic regulators. Power collapses to about 30 MW.', warp: 120, level: 'warn' },
  { t: 84840, text: 'Operators withdraw control rods to recover power. Xenon-135 is accumulating in the core.' },
  { t: 86400, text: 'Power held near 200 MW, well below the 700 MW the test plan required.', warp: 60 },
  { t: 86580, text: 'Main circulation pump 7 started. Extra flow suppresses boiling, so more rods are withdrawn.' },
  { t: 86820, text: 'Main circulation pump 8 started. Coolant in the core is now close to saturation.' },
  { t: 87600, text: 'Feedwater flow reduced. Preparations for the rundown test.', warp: 10 },
  { t: 87750, text: 'ORM', warp: 2 },
  { t: 87780, text: '', warp: 1 },
  { t: 87784, text: 'COAST' },
  { t: 87820, text: 'AZ5' },
];

function scenarioUpdate(core, st) {
  const t = core.t;
  // setpoint program
  let sp = core.setpoint;
  if (t < 360) sp = 1;
  else if (t < 43500) sp = 1 - 0.5 * (t - 360) / (43500 - 360);
  else if (t < 79800) sp = 0.5;
  else if (t < 83100) sp = 0.5 - 0.275 * (t - 79800) / 3300;
  else if (t < 84480) sp = 0.225;
  else if (t < 84840) sp = 0.009;
  else if (t < 86400) sp = 0.009 + (0.0625 - 0.009) * (t - 84840) / 1560;
  else sp = 0.0625;
  if (!core.scram) core.setpoint = sp;
  // feedwater: subcooling falls as power drops
  if (t > 84480) core.subC = Math.max(3, 14 - 11.5 * (t - 84480) / 3200);
  if (t >= 86580 && core.flowPumps < 7) core.flowPumps = 7;
  if (t >= 86820 && core.flowPumps < 8) core.flowPumps = 8;
  while (st.i < SCENARIO.length && t >= SCENARIO[st.i].t) {
    const e = SCENARIO[st.i++];
    if (e.warp) st.warp = e.warp;
    if (e.text === 'ORM') core.log(`Computer printout: operational reactivity margin ≈ ${core.ORM.toFixed(1)} rods (minimum allowed: 15).`, 'warn', { k: 'ormprint', v: core.ORM.toFixed(1) });
    else if (e.text === 'COAST') { core.operatorAssist = false; core.startCoastdown(4); }
    else if (e.text === 'AZ5') core.az5();
    else if (e.text) core.log(e.text, e.level, { k: e.k, s1: e.s1 });
  }
}

const api = { Core, SCENARIO, scenarioUpdate, TYPE, BETA, NOMINAL_MW, TC };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RBMK = api;
})(this);
