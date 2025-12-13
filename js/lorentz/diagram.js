import * as THREE from "three";
import { clipLineToAABB, makeLine, setLineEndpoints } from "./graphics.js";
import { clampVelocity, gamma, intervalSquared, lorentzTransform } from "./lorentz.js";

export class SpacetimeDiagram {
  constructor({ extent = 10, gridStep = 1, primeGridStep = 2 } = {}) {
    this.extent = extent;
    this.gridStep = gridStep;
    this.primeGridStep = primeGridStep;
    this._box = { minX: -extent, maxX: extent, minY: -extent, maxY: extent };

    this.group = new THREE.Group();
    this.group.name = "SpacetimeDiagram";

    this._state = {
      v: 0,
      event: { x: 4, t: 6 },
      hyperbolaA: Math.min(4, extent - 0.5),
      particleU: 0.3
    };

    this._materials = this._createMaterials();
    this._layers = this._createLayers();
    this._buildStatic();
    this._buildDynamic();

    this.setVelocity(0.6);
    this.setEvent(this._state.event.x, this._state.event.t);
    this.setHyperbolaScale(this._state.hyperbolaA);
    this.setParticleVelocity(this._state.particleU);
  }

  setVelocity(v) {
    this._state.v = clampVelocity(v, 0.999);
    const E = this.extent;
    const g = gamma(this._state.v);
    const vClamped = this._state.v;
    const big = E * 2;

    setLineEndpoints(this._dynamic.tPrimeAxis, { x: vClamped * -E, y: -E }, { x: vClamped * E, y: E }, 0.02);
    setLineEndpoints(this._dynamic.xPrimeAxis, { x: -E, y: vClamped * -E }, { x: E, y: vClamped * E }, 0.02);

    for (const { tPrime, line } of this._dynamic.tPrimeGridLines) {
      const p0 = { x: -big, y: vClamped * -big + tPrime / g };
      const p1 = { x: big, y: vClamped * big + tPrime / g };
      const clipped = clipLineToAABB(p0, p1, this._box);
      if (!clipped) {
        line.visible = false;
        continue;
      }
      line.visible = true;
      setLineEndpoints(line, clipped.p0, clipped.p1, 0.01);
    }

    for (const { xPrime, line } of this._dynamic.xPrimeGridLines) {
      const p0 = { x: vClamped * -big + xPrime / g, y: -big };
      const p1 = { x: vClamped * big + xPrime / g, y: big };
      const clipped = clipLineToAABB(p0, p1, this._box);
      if (!clipped) {
        line.visible = false;
        continue;
      }
      line.visible = true;
      setLineEndpoints(line, clipped.p0, clipped.p1, 0.01);
    }

    this._updateHyperbolas();
  }

  setPrimeGridVisible(visible) {
    this._layers.primeGrid.visible = Boolean(visible);
  }

  setHyperbolasVisible(visible) {
    this._dynamic.hyperbolas.group.visible = Boolean(visible);
  }

  setTPrimeConeVisible(visible) {
    this._dynamic.tPrimeCone.group.visible = Boolean(visible);
  }

  setHyperbolaScale(a) {
    const next = Number(a);
    if (!Number.isFinite(next) || next <= 0) return;
    this._state.hyperbolaA = next;
    this._updateHyperbolas();
  }

  setSuperluminalVisible(visible) {
    this._dynamic.superluminal.visible = Boolean(visible);
  }

  setParticleVelocity(u) {
    const uu = clampVelocity(u, 1);
    this._state.particleU = uu;
    const E = this.extent;
    const p0 = { x: uu * -E, y: -E };
    const p1 = { x: uu * E, y: E };
    const clipped = clipLineToAABB(p0, p1, this._box);
    if (!clipped) {
      this._dynamic.particleWorldline.visible = false;
      return;
    }
    this._dynamic.particleWorldline.visible = true;
    setLineEndpoints(this._dynamic.particleWorldline, clipped.p0, clipped.p1, 0.021);
  }

  setEvent(x, t) {
    if (!Number.isFinite(x) || !Number.isFinite(t)) return;
    this._state.event = { x, t };
    this._dynamic.eventPoint.position.set(x, t, 0.03);
  }

  getEventInfo() {
    const { x, t } = this._state.event;
    const { x: xp, t: tp } = lorentzTransform({ x, t }, this._state.v);
    const s2 = intervalSquared({ x, t });
    const s2p = intervalSquared({ x: xp, t: tp });
    return { x, t, xPrime: xp, tPrime: tp, s2, s2Prime: s2p };
  }

  _createMaterials() {
    return {
      grid: new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.26 }),
      axis: new THREE.LineBasicMaterial({ color: 0xe5e7eb, transparent: true, opacity: 0.9 }),
      cone: new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.95 }),
      coneFill: new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.07,
        depthWrite: false
      }),
      tPrimeAxis: new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95 }),
      xPrimeAxis: new THREE.LineBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.95 }),
      primeGrid: new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.18 }),
      hyperbolaTime: new THREE.LineBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.7 }),
      hyperbolaSpace: new THREE.LineBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.4 }),
      hyperbolaPoint: new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.9 }),
      tPrimeCone: new THREE.LineDashedMaterial({
        color: 0xa78bfa,
        transparent: true,
        opacity: 0.75,
        dashSize: 0.38,
        gapSize: 0.24
      }),
      particleWorldline: new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.95 }),
      event: new THREE.MeshBasicMaterial({ color: 0xf97316 }),
      superluminal: new THREE.LineDashedMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.85,
        dashSize: 0.35,
        gapSize: 0.22
      })
    };
  }

  _createLayers() {
    const base = new THREE.Group();
    base.name = "base";
    const prime = new THREE.Group();
    prime.name = "prime";
    const primeGrid = new THREE.Group();
    primeGrid.name = "primeGrid";
    const primeAxes = new THREE.Group();
    primeAxes.name = "primeAxes";
    const overlay = new THREE.Group();
    overlay.name = "overlay";

    prime.add(primeGrid, primeAxes);
    this.group.add(base, prime, overlay);
    return { base, prime, primeGrid, primeAxes, overlay };
  }

  _buildStatic() {
    const E = this.extent;

    const coneFill = this._buildLightConeFill();
    this._layers.base.add(coneFill);

    const grid = new THREE.Group();
    grid.name = "grid";
    for (let i = -E; i <= E; i += this.gridStep) {
      if (i === 0) continue;
      grid.add(makeLine({ x: i, y: -E }, { x: i, y: E }, this._materials.grid, 0));
      grid.add(makeLine({ x: -E, y: i }, { x: E, y: i }, this._materials.grid, 0));
    }
    this._layers.base.add(grid);

    const axes = new THREE.Group();
    axes.name = "axes";
    axes.add(makeLine({ x: -E, y: 0 }, { x: E, y: 0 }, this._materials.axis, 0.005));
    axes.add(makeLine({ x: 0, y: -E }, { x: 0, y: E }, this._materials.axis, 0.005));
    this._layers.base.add(axes);

    const lightCone = new THREE.Group();
    lightCone.name = "lightCone";
    lightCone.add(makeLine({ x: -E, y: -E }, { x: E, y: E }, this._materials.cone, 0.02));
    lightCone.add(makeLine({ x: E, y: -E }, { x: -E, y: E }, this._materials.cone, 0.02));
    this._layers.base.add(lightCone);
  }

  _buildLightConeFill() {
    const E = this.extent;
    const group = new THREE.Group();
    group.name = "coneFill";

    const future = new THREE.Shape();
    future.moveTo(0, 0);
    future.lineTo(E, E);
    future.lineTo(-E, E);
    future.lineTo(0, 0);

    const past = new THREE.Shape();
    past.moveTo(0, 0);
    past.lineTo(E, -E);
    past.lineTo(-E, -E);
    past.lineTo(0, 0);

    const futureMesh = new THREE.Mesh(new THREE.ShapeGeometry(future), this._materials.coneFill);
    futureMesh.position.z = -0.01;
    const pastMesh = new THREE.Mesh(new THREE.ShapeGeometry(past), this._materials.coneFill);
    pastMesh.position.z = -0.01;
    group.add(futureMesh, pastMesh);
    return group;
  }

  _buildDynamic() {
    const E = this.extent;

    const tPrimeAxis = makeLine({ x: 0, y: -E }, { x: 0, y: E }, this._materials.tPrimeAxis, 0.02);
    tPrimeAxis.name = "tPrimeAxis";
    const xPrimeAxis = makeLine({ x: -E, y: 0 }, { x: E, y: 0 }, this._materials.xPrimeAxis, 0.02);
    xPrimeAxis.name = "xPrimeAxis";
    this._layers.primeAxes.add(tPrimeAxis, xPrimeAxis);

    const tPrimeGridLines = [];
    const xPrimeGridLines = [];
    for (let tp = -E; tp <= E; tp += this.primeGridStep) {
      if (tp === 0) continue;
      const line = makeLine({ x: 0, y: 0 }, { x: 0, y: 0 }, this._materials.primeGrid, 0.01);
      this._layers.primeGrid.add(line);
      tPrimeGridLines.push({ tPrime: tp, line });
    }
    for (let xp = -E; xp <= E; xp += this.primeGridStep) {
      if (xp === 0) continue;
      const line = makeLine({ x: 0, y: 0 }, { x: 0, y: 0 }, this._materials.primeGrid, 0.01);
      this._layers.primeGrid.add(line);
      xPrimeGridLines.push({ xPrime: xp, line });
    }

    const eventPoint = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), this._materials.event);
    eventPoint.name = "eventPoint";
    this._layers.overlay.add(eventPoint);

    const superluminal = this._buildSuperluminalExample();
    this._layers.overlay.add(superluminal);

    const hyperbolas = this._buildHyperbolas();
    this._layers.overlay.add(hyperbolas.group);

    const tPrimeCone = this._buildTPrimeCone();
    this._layers.overlay.add(tPrimeCone.group);

    const particleWorldline = makeLine({ x: 0, y: -E }, { x: 0, y: E }, this._materials.particleWorldline, 0.021);
    particleWorldline.name = "particleWorldline";
    this._layers.overlay.add(particleWorldline);

    this._dynamic = {
      tPrimeAxis,
      xPrimeAxis,
      tPrimeGridLines,
      xPrimeGridLines,
      eventPoint,
      superluminal,
      hyperbolas,
      tPrimeCone,
      particleWorldline
    };
  }

  _buildSuperluminalExample() {
    const E = this.extent;
    const vSuper = 1.2;
    const p0 = { x: vSuper * -E, y: -E };
    const p1 = { x: vSuper * E, y: E };
    const clipped = clipLineToAABB(p0, p1, this._box) ?? { p0: { x: 0, y: 0 }, p1: { x: 0, y: 0 } };
    const line = makeLine(clipped.p0, clipped.p1, this._materials.superluminal, 0.02);
    line.name = "superluminalExample";
    line.computeLineDistances();
    return line;
  }

  _buildHyperbolas() {
    const group = new THREE.Group();
    group.name = "hyperbolas";

    const timeFuture = new THREE.Line(new THREE.BufferGeometry(), this._materials.hyperbolaTime);
    timeFuture.name = "timeHyperbolaFuture";
    const timePast = new THREE.Line(new THREE.BufferGeometry(), this._materials.hyperbolaTime);
    timePast.name = "timeHyperbolaPast";
    const spaceRight = new THREE.Line(new THREE.BufferGeometry(), this._materials.hyperbolaSpace);
    spaceRight.name = "spaceHyperbolaRight";
    const spaceLeft = new THREE.Line(new THREE.BufferGeometry(), this._materials.hyperbolaSpace);
    spaceLeft.name = "spaceHyperbolaLeft";

    const dotGeo = new THREE.CircleGeometry(0.13, 20);
    const tPrimeDot = new THREE.Mesh(dotGeo, this._materials.hyperbolaPoint);
    tPrimeDot.name = "tPrimeHyperbolaDot";
    const xPrimeDot = new THREE.Mesh(dotGeo, this._materials.hyperbolaPoint);
    xPrimeDot.name = "xPrimeHyperbolaDot";

    group.add(timeFuture, timePast, spaceRight, spaceLeft, tPrimeDot, xPrimeDot);

    return { group, timeFuture, timePast, spaceRight, spaceLeft, tPrimeDot, xPrimeDot };
  }

  _buildTPrimeCone() {
    const group = new THREE.Group();
    group.name = "tPrimeCone";

    const plus = makeLine({ x: 0, y: 0 }, { x: 0, y: 0 }, this._materials.tPrimeCone, 0.019);
    plus.name = "tPrimeConePlus";
    plus.computeLineDistances();
    const minus = makeLine({ x: 0, y: 0 }, { x: 0, y: 0 }, this._materials.tPrimeCone, 0.019);
    minus.name = "tPrimeConeMinus";
    minus.computeLineDistances();

    group.add(plus, minus);
    return { group, plus, minus };
  }

  _updateHyperbolas() {
    const E = this.extent;
    const a = this._state.hyperbolaA;
    const { hyperbolas } = this._dynamic;
    if (!hyperbolas) return;

    const canDraw = a > 0 && a < E;

    if (!canDraw) {
      hyperbolas.timeFuture.visible = false;
      hyperbolas.timePast.visible = false;
      hyperbolas.spaceRight.visible = false;
      hyperbolas.spaceLeft.visible = false;
      hyperbolas.tPrimeDot.visible = false;
      hyperbolas.xPrimeDot.visible = false;
      return;
    }

    const segments = 240;
    const z = 0.015;

    {
      const xMax = Math.sqrt(Math.max(0, E * E - a * a));
      const future = [];
      const past = [];
      for (let i = 0; i <= segments; i += 1) {
        const x = -xMax + (2 * xMax * i) / segments;
        const t = Math.sqrt(x * x + a * a);
        future.push(new THREE.Vector3(x, t, z));
        past.push(new THREE.Vector3(x, -t, z));
      }
      this._replaceLineGeometry(hyperbolas.timeFuture, future);
      this._replaceLineGeometry(hyperbolas.timePast, past);
      hyperbolas.timeFuture.visible = true;
      hyperbolas.timePast.visible = true;
    }

    {
      const tMax = Math.sqrt(Math.max(0, E * E - a * a));
      const right = [];
      const left = [];
      for (let i = 0; i <= segments; i += 1) {
        const t = -tMax + (2 * tMax * i) / segments;
        const x = Math.sqrt(t * t + a * a);
        right.push(new THREE.Vector3(x, t, z));
        left.push(new THREE.Vector3(-x, t, z));
      }
      this._replaceLineGeometry(hyperbolas.spaceRight, right);
      this._replaceLineGeometry(hyperbolas.spaceLeft, left);
      hyperbolas.spaceRight.visible = true;
      hyperbolas.spaceLeft.visible = true;
    }

    const v = this._state.v;
    const g = gamma(v);
    hyperbolas.tPrimeDot.position.set(g * v * a, g * a, 0.02);
    hyperbolas.xPrimeDot.position.set(g * a, g * v * a, 0.02);
    hyperbolas.tPrimeDot.visible = true;
    hyperbolas.xPrimeDot.visible = true;

    this._updateTPrimeCone();
  }

  _updateTPrimeCone() {
    const E = this.extent;
    const big = E * 2;
    const { tPrimeCone, hyperbolas } = this._dynamic;
    if (!tPrimeCone || !hyperbolas) return;

    const x0 = hyperbolas.tPrimeDot.position.x;
    const t0 = hyperbolas.tPrimeDot.position.y;
    const centerInView = Math.abs(x0) <= E && Math.abs(t0) <= E;

    if (!centerInView) {
      tPrimeCone.plus.visible = false;
      tPrimeCone.minus.visible = false;
      return;
    }

    const pPlus0 = { x: x0 - big, y: t0 - big };
    const pPlus1 = { x: x0 + big, y: t0 + big };
    const pMinus0 = { x: x0 + big, y: t0 - big };
    const pMinus1 = { x: x0 - big, y: t0 + big };

    const clippedPlus = clipLineToAABB(pPlus0, pPlus1, this._box);
    if (!clippedPlus) tPrimeCone.plus.visible = false;
    else {
      tPrimeCone.plus.visible = true;
      setLineEndpoints(tPrimeCone.plus, clippedPlus.p0, clippedPlus.p1, 0.019);
    }

    const clippedMinus = clipLineToAABB(pMinus0, pMinus1, this._box);
    if (!clippedMinus) tPrimeCone.minus.visible = false;
    else {
      tPrimeCone.minus.visible = true;
      setLineEndpoints(tPrimeCone.minus, clippedMinus.p0, clippedMinus.p1, 0.019);
    }
  }

  _replaceLineGeometry(line, points) {
    const next = new THREE.BufferGeometry().setFromPoints(points);
    if (line.geometry) line.geometry.dispose();
    line.geometry = next;
  }
}
