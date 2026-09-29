// Coordinates use half the conventional reciprocal BCC cube edge as one unit.
// An FCC real-space lattice has these BCC reciprocal primitive vectors.
const reciprocalBasis = [
  [-1, 1, 1],
  [1, -1, 1],
  [1, 1, -1],
];

const epsilon = 1e-9;

function precedes(a, b) {
  for (let axis = 0; axis < 3; axis++) {
    if (a[axis] < b[axis] - epsilon) return true;
    if (a[axis] > b[axis] + epsilon) return false;
  }
  return false;
}

export function fractionalToCartesian(f1, f2, f3) {
  return [0, 1, 2].map((axis) =>
    f1 * reciprocalBasis[0][axis] + f2 * reciprocalBasis[1][axis] + f3 * reciprocalBasis[2][axis]
  );
}

// Select the nearest reciprocal-lattice image. Lexicographic tie-breaking
// gives periodic copies on a zone face the same representative.
export function foldToFirstBZ(point) {
  let best = null;
  let bestDistance = Infinity;
  // Inverse of the primitive-vector matrix gives the nearby lattice cell.
  const [x, y, z] = point;
  const center = [Math.round((y + z) / 2), Math.round((x + z) / 2), Math.round((x + y) / 2)];

  for (let i = center[0] - 2; i <= center[0] + 2; i++) {
    for (let j = center[1] - 2; j <= center[1] + 2; j++) {
      for (let k = center[2] - 2; k <= center[2] + 2; k++) {
        const reciprocalPoint = fractionalToCartesian(i, j, k);
        const candidate = point.map((value, axis) => value - reciprocalPoint[axis]);
        const distance = candidate.reduce((sum, value) => sum + value * value, 0);
        if (distance < bestDistance - epsilon || (Math.abs(distance - bestDistance) <= epsilon && precedes(candidate, best))) {
          best = candidate;
          bestDistance = distance;
        }
      }
    }
  }

  return best.map((value) => Math.abs(value) < epsilon ? 0 : value);
}

function centeredFraction(index, count, method) {
  if (method === "monkhorst") return (index + 0.5) / count - 0.5;
  const fraction = index / count;
  return fraction >= 0.5 ? fraction - 1 : fraction;
}

export function generateSamplingGrid(nx, ny, nz, method) {
  if (![nx, ny, nz].every((value) => Number.isInteger(value) && value >= 1 && value <= 16)) {
    throw new RangeError("网格密度必须是 1–16 的整数");
  }
  if (method !== "monkhorst" && method !== "gamma") {
    throw new RangeError("未知的采样方式");
  }

  const points = [];
  for (let ix = 0; ix < nx; ix++) {
    const f1 = centeredFraction(ix, nx, method);
    for (let iy = 0; iy < ny; iy++) {
      const f2 = centeredFraction(iy, ny, method);
      for (let iz = 0; iz < nz; iz++) {
        const f3 = centeredFraction(iz, nz, method);
        points.push(foldToFirstBZ(fractionalToCartesian(f1, f2, f3)));
      }
    }
  }
  return points;
}
