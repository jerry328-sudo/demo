import assert from "node:assert/strict";
import test from "node:test";
import { computeConv1d, getStepDetail, resolvePadding, sourceIndex, validateConfig } from "./cnn-conv1d-math.js";

const base = {
  length: 5, inChannels: 1, outChannels: 1, kernelSize: 3,
  stride: 1, padding: 0, paddingRule: "custom", paddingMode: "zeros",
  dilation: 1, groups: 1, bias: false,
};

test("stride and dilation determine output length and sampled indices", () => {
  const config = { ...base, length: 8, stride: 2, dilation: 2 };
  const result = computeConv1d(config);
  assert.equal(result.outputLength, 2);
  assert.deepEqual(getStepDetail(result, 0, 1).terms.map((term) => term.inputIndex), [2, 4, 6]);
});

test("same padding is asymmetric for an even effective kernel", () => {
  const config = { ...base, kernelSize: 4, paddingRule: "same" };
  assert.deepEqual(resolvePadding(config), { left: 1, right: 2, effectiveKernel: 4 });
  assert.equal(computeConv1d(config).outputLength, config.length);
  assert.match(validateConfig({ ...config, stride: 2 }), /stride=1/);
});

test("padding modes map boundary indices correctly", () => {
  assert.equal(sourceIndex(-1, 5, "zeros"), null);
  assert.equal(sourceIndex(-1, 5, "reflect"), 1);
  assert.equal(sourceIndex(5, 5, "reflect"), 3);
  assert.equal(sourceIndex(-1, 5, "replicate"), 0);
  assert.equal(sourceIndex(5, 5, "replicate"), 4);
  assert.equal(sourceIndex(-1, 5, "circular"), 4);
  assert.equal(sourceIndex(5, 5, "circular"), 0);
});

test("grouped convolution only reads input channels in the output's group", () => {
  const config = { ...base, inChannels: 4, outChannels: 4, groups: 2, kernelSize: 1 };
  const result = computeConv1d(config);
  assert.deepEqual(getStepDetail(result, 0, 0).terms.map((term) => term.inChannel), [0, 1]);
  assert.deepEqual(getStepDetail(result, 3, 0).terms.map((term) => term.inChannel), [2, 3]);
  assert.equal(result.weights[0].length, 2);
  assert.match(validateConfig({ ...config, outChannels: 3 }), /groups/);
});

test("numeric output includes optional bias", () => {
  const supplied = { input: [[1, 2, 3, 4, 5]], weights: [[[2, -1, 0.5]]], biases: [0.25] };
  const withoutBias = computeConv1d(base, supplied);
  const withBias = computeConv1d({ ...base, bias: true }, supplied);
  assert.equal(withoutBias.output[0][0], 1.5);
  assert.equal(withBias.output[0][0], 1.75);
  assert.equal(withBias.output[0][1], 3.25);
});

test("invalid effective kernels and reflection padding report an error", () => {
  assert.match(validateConfig({ ...base, length: 5, kernelSize: 7, dilation: 5 }), /有效卷积核/);
  assert.match(validateConfig({ ...base, padding: 5, paddingMode: "reflect" }), /reflect/);
});
