import assert from "node:assert/strict";
import test from "node:test";
import { foldToFirstBZ, fractionalToCartesian, generateSamplingGrid } from "./brillouin_sampling_math.js";

const close = (a, b) => Math.abs(a - b) < 1e-8;
const samePoint = (a, b) => a.every((value, axis) => close(value, b[axis]));

test("FCC reciprocal primitive vectors form the BCC lattice", () => {
  assert.deepEqual(fractionalToCartesian(1, 0, 0), [-1, 1, 1]);
  assert.deepEqual(fractionalToCartesian(0, 1, 0), [1, -1, 1]);
  assert.deepEqual(fractionalToCartesian(0, 0, 1), [1, 1, -1]);
});

test("periodic copies on zone faces fold to one representative", () => {
  const point = [1, 0.2, 0.1];
  const shifted = point.map((value, axis) => value + [2, 0, 0][axis]);
  assert.ok(samePoint(foldToFirstBZ(point), foldToFirstBZ(shifted)));
  assert.ok(samePoint(foldToFirstBZ([1, 0, 0]), foldToFirstBZ([-1, 0, 0])));
});

for (const method of ["monkhorst", "gamma"]) {
  for (const [nx, ny, nz] of [[1, 1, 1], [2, 2, 2], [4, 4, 4], [3, 4, 5], [6, 6, 6], [16, 16, 16]]) {
    test(`${method} ${nx}×${ny}×${nz} has every expected point inside the first BZ`, () => {
      const points = generateSamplingGrid(nx, ny, nz, method);
      assert.equal(points.length, nx * ny * nz);
      assert.equal(new Set(points.map((point) => point.map((value) => value.toFixed(8)).join(","))).size, points.length);
      for (const [x, y, z] of points) {
        assert.ok(Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) <= 1 + 1e-8);
        assert.ok(Math.abs(x) + Math.abs(y) + Math.abs(z) <= 1.5 + 1e-8);
      }
    });
  }
}

test("Gamma-centered grids include Γ while even Monkhorst–Pack grids do not", () => {
  assert.ok(generateSamplingGrid(4, 4, 4, "gamma").some((point) => samePoint(point, [0, 0, 0])));
  assert.ok(!generateSamplingGrid(4, 4, 4, "monkhorst").some((point) => samePoint(point, [0, 0, 0])));
});
