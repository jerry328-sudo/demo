import * as THREE from "three";

export function makeLine(p0, p1, material, z = 0) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([p0.x, p0.y, z, p1.x, p1.y, z]);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Line(geometry, material);
}

export function setLineEndpoints(line, p0, p1, z = 0) {
  const positions = line.geometry.getAttribute("position");
  positions.setXYZ(0, p0.x, p0.y, z);
  positions.setXYZ(1, p1.x, p1.y, z);
  positions.needsUpdate = true;
  line.geometry.computeBoundingSphere();
  if (typeof line.computeLineDistances === "function") line.computeLineDistances();
}

export function clipLineToAABB(p0, p1, { minX, maxX, minY, maxY }) {
  let t0 = 0;
  let t1 = 1;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;

  const p = [-dx, dx, -dy, dy];
  const q = [p0.x - minX, maxX - p0.x, p0.y - minY, maxY - p0.y];

  for (let i = 0; i < 4; i += 1) {
    const pi = p[i];
    const qi = q[i];

    if (pi === 0) {
      if (qi < 0) return null;
      continue;
    }

    const r = qi / pi;
    if (pi < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return null;
  }

  return {
    p0: { x: p0.x + t0 * dx, y: p0.y + t0 * dy },
    p1: { x: p0.x + t1 * dx, y: p0.y + t1 * dy }
  };
}

