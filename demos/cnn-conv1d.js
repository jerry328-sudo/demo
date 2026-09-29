import { computeConv1d, getStepDetail, sourceIndex, validateConfig } from "./cnn-conv1d-math.js";

const ids = ["length", "inChannels", "outChannels", "kernelSize", "stride", "dilation", "groups", "paddingRule", "padding", "paddingMode", "bias"];
const controls = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
const elements = Object.fromEntries([
  "input-grid", "kernel-grid", "output-grid", "input-shape", "kernel-shape", "output-shape",
  "padding-note", "formula-values", "shape-result", "validation-message", "group-hint",
  "selected-channel", "bias-value", "group-value", "step", "step-label",
  "calculation-position", "input-terms", "weighted-sum", "bias-equation", "final-result",
  "play", "reset", "previous", "next", "speed", "padding-field",
].map((id) => [id, document.getElementById(id)]));

let result = null;
let position = 0;
let selectedChannel = 0;
let playbackTimer = null;

const format = (value) => (Math.abs(value) < 0.005 ? 0 : value).toFixed(2);

function readConfig() {
  return {
    length: Number(controls.length.value),
    inChannels: Number(controls.inChannels.value),
    outChannels: Number(controls.outChannels.value),
    kernelSize: Number(controls.kernelSize.value),
    stride: Number(controls.stride.value),
    dilation: Number(controls.dilation.value),
    groups: Number(controls.groups.value),
    paddingRule: controls.paddingRule.value,
    padding: Number(controls.padding.value),
    paddingMode: controls.paddingMode.value,
    bias: controls.bias.checked,
  };
}

function syncGroups() {
  const inChannels = Number(controls.inChannels.value);
  const outChannels = Number(controls.outChannels.value);
  if (!Number.isInteger(inChannels) || !Number.isInteger(outChannels)) return;
  const current = Number(controls.groups.value);
  const divisors = Array.from({ length: Math.min(inChannels, outChannels) }, (_, index) => index + 1)
    .filter((number) => inChannels % number === 0 && outChannels % number === 0);
  controls.groups.replaceChildren(...divisors.map((number) => new Option(String(number), String(number))));
  controls.groups.value = divisors.includes(current) ? String(current) : "1";
  elements["group-hint"].textContent = divisors.includes(current)
    ? `可选 groups：${divisors.join("、")}。每组只连接对应的输入与输出通道。数值为固定教学示例，未训练模型。`
    : "通道数变化后，groups 已调整为 1。数值为固定教学示例，未训练模型。";
}

function syncOutputChannels() {
  elements["selected-channel"].replaceChildren(...Array.from(
    { length: result.config.outChannels }, (_, channel) => new Option(String(channel), String(channel))
  ));
  selectedChannel = Math.min(selectedChannel, result.config.outChannels - 1);
  elements["selected-channel"].value = String(selectedChannel);
}

function stopPlayback() {
  if (playbackTimer !== null) clearInterval(playbackTimer);
  playbackTimer = null;
  elements.play.textContent = "▶ 播放";
}

function makeCell(text, classes = "") {
  const cell = document.createElement("div");
  cell.className = `matrix-cell ${classes}`;
  cell.textContent = text;
  return cell;
}

function fillGrid(container, headers, rows) {
  container.style.setProperty("--columns", String(headers.length));
  const fragment = document.createDocumentFragment();
  fragment.appendChild(makeCell("索引", "head-cell row-head"));
  headers.forEach((header) => fragment.appendChild(makeCell(String(header), "head-cell")));
  rows.forEach((row) => {
    fragment.appendChild(makeCell(row.label, "row-head"));
    row.cells.forEach(({ text, classes }) => fragment.appendChild(makeCell(text, classes)));
  });
  container.replaceChildren(fragment);
}

function renderInput(detail) {
  const { config, padding, input } = result;
  const totalLength = config.length + padding.left + padding.right;
  const headers = Array.from({ length: totalLength }, (_, index) => index - padding.left);
  const selected = new Set(detail.terms.map((term) => `${term.inChannel},${term.paddedIndex}`));
  const firstChannel = detail.group * result.channelsPerGroup;
  const rows = input.map((channel, inChannel) => ({
    label: `通道 ${inChannel}`,
    cells: Array.from({ length: totalLength }, (_, paddedIndex) => {
      const index = paddedIndex - padding.left;
      const mapped = sourceIndex(index, config.length, config.paddingMode);
      const value = mapped === null ? 0 : channel[mapped];
      const pad = index < 0 || index >= config.length;
      const active = selected.has(`${inChannel},${paddedIndex}`);
      const relevant = inChannel >= firstChannel && inChannel < firstChannel + result.channelsPerGroup;
      return { text: format(value), classes: [pad && "pad-cell", active && "selected-input", !relevant && "inactive-row"].filter(Boolean).join(" ") };
    }),
  }));
  fillGrid(elements["input-grid"], headers, rows);
}

function renderKernel(detail) {
  const { config, weights, channelsPerGroup } = result;
  const firstChannel = detail.group * channelsPerGroup;
  const rows = weights[selectedChannel].map((channel, localChannel) => ({
    label: `通道 ${firstChannel + localChannel}`,
    cells: channel.map((value) => ({ text: format(value), classes: "selected-kernel" })),
  }));
  fillGrid(elements["kernel-grid"], Array.from({ length: config.kernelSize }, (_, index) => `k=${index}`), rows);
  elements["bias-value"].textContent = config.bias ? `b[${selectedChannel}] = ${format(result.biases[selectedChannel])}` : "bias = False";
  elements["group-value"].textContent = `第 ${detail.group + 1} / ${config.groups} 组 · 每组 ${channelsPerGroup} 个输入通道`;
}

function renderOutput() {
  const rows = result.output.map((channel, outChannel) => ({
    label: `通道 ${outChannel}`,
    cells: channel.map((value, index) => ({
      text: format(value),
      classes: outChannel === selectedChannel && index === position ? "current-output" : "",
    })),
  }));
  fillGrid(elements["output-grid"], Array.from({ length: result.outputLength }, (_, index) => index), rows);
}

function renderCalculation(detail) {
  elements["calculation-position"].textContent = `（输出通道 ${selectedChannel}，位置 ${position}）`;
  const tags = detail.terms.map((term) => {
    const padded = term.mappedIndex === null ? "补零" : term.mappedIndex !== term.inputIndex ? `→ ${term.mappedIndex}` : "";
    const tag = document.createElement("span");
    tag.textContent = `x[${term.inChannel},${term.inputIndex}]${padded} = ${format(term.inputNumber)}`;
    return tag;
  });
  elements["input-terms"].replaceChildren(...tags);

  const factor = (value) => value < 0 ? `(${format(value)})` : format(value);
  const products = detail.terms.slice(0, 6).map((term) => `${factor(term.inputNumber)}×${factor(term.weight)}`);
  const remainder = detail.terms.length > 6 ? ` + …（共 ${detail.terms.length} 项）` : "";
  elements["weighted-sum"].textContent = `${products.join(" + ")}${remainder} = ${format(detail.sum)}`;
  elements["bias-equation"].textContent = result.config.bias
    ? `${format(detail.sum)} + (${format(detail.bias)}) = ${format(detail.total)}`
    : `bias=False，${format(detail.sum)} = ${format(detail.total)}`;
  elements["final-result"].textContent = `Y[${selectedChannel}, ${position}] = ${format(detail.total)}`;
}

function renderStep() {
  if (!result) return;
  const detail = getStepDetail(result, selectedChannel, position);
  elements.step.max = String(result.outputLength - 1);
  elements.step.value = String(position);
  elements["step-label"].textContent = `${position + 1} / ${result.outputLength}`;
  elements.previous.disabled = position === 0;
  elements.next.disabled = position === result.outputLength - 1;
  renderInput(detail);
  renderKernel(detail);
  renderOutput();
  renderCalculation(detail);
}

function updateVisualization() {
  stopPlayback();
  syncGroups();
  const config = readConfig();
  const error = validateConfig(config);
  const customPadding = config.paddingRule === "custom";
  controls.padding.disabled = !customPadding;
  elements["padding-field"].classList.toggle("disabled-field", !customPadding);
  elements["validation-message"].hidden = !error;
  elements["validation-message"].textContent = error || "";

  if (error) {
    result = null;
    elements["shape-result"].textContent = "当前参数无法生成卷积结果";
    elements["formula-values"].textContent = "调整参数后会重新计算输出形状。";
    elements["input-grid"].replaceChildren();
    elements["kernel-grid"].replaceChildren();
    elements["output-grid"].replaceChildren();
    elements["input-terms"].replaceChildren();
    elements["weighted-sum"].textContent = "";
    elements["bias-equation"].textContent = "";
    elements["final-result"].textContent = "";
    elements.play.disabled = true;
    elements.previous.disabled = true;
    elements.next.disabled = true;
    elements.step.disabled = true;
    elements["selected-channel"].disabled = true;
    return;
  }

  result = computeConv1d(config);
  position = Math.min(position, result.outputLength - 1);
  syncOutputChannels();
  elements.play.disabled = false;
  elements.step.disabled = false;
  elements["selected-channel"].disabled = false;
  const { left, right, effectiveKernel } = result.padding;
  elements["input-shape"].textContent = `形状：(1, ${config.inChannels}, ${config.length})`;
  elements["kernel-shape"].textContent = `形状：(${config.outChannels}, ${result.channelsPerGroup}, ${config.kernelSize})`;
  elements["output-shape"].textContent = `形状：(1, ${config.outChannels}, ${result.outputLength})`;
  elements["padding-note"].textContent = `左 ${left} / 右 ${right} · ${config.paddingMode}`;
  elements["formula-values"].textContent = `⌊(${config.length} + ${left} + ${right} − ${config.dilation}×(${config.kernelSize}−1) − 1) / ${config.stride}⌋ + 1 = ${result.outputLength}；有效核宽 ${effectiveKernel}`;
  elements["shape-result"].innerHTML = `参数合法，输出形状：<strong>(1, ${config.outChannels}, ${result.outputLength})</strong>`;
  renderStep();
}

function tick() {
  if (!result || position >= result.outputLength - 1) {
    stopPlayback();
    return;
  }
  position += 1;
  renderStep();
  if (position === result.outputLength - 1) stopPlayback();
}

function play() {
  if (!result) return;
  if (playbackTimer !== null) {
    stopPlayback();
    return;
  }
  if (position === result.outputLength - 1) {
    position = 0;
    renderStep();
  }
  elements.play.textContent = "Ⅱ 暂停";
  playbackTimer = setInterval(tick, Number(elements.speed.value));
}

Object.values(controls).forEach((control) => control.addEventListener("change", updateVisualization));
Object.values(controls).filter((control) => control.type === "number").forEach((control) => {
  control.addEventListener("input", () => {
    const value = Number(control.value);
    if (control.value !== "" && Number.isInteger(value) && value >= Number(control.min) && value <= Number(control.max)) {
      updateVisualization();
    }
  });
});
elements["selected-channel"].addEventListener("change", () => {
  stopPlayback();
  selectedChannel = Number(elements["selected-channel"].value);
  renderStep();
});
elements.step.addEventListener("input", () => {
  stopPlayback();
  position = Number(elements.step.value);
  renderStep();
});
elements.play.addEventListener("click", play);
elements.reset.addEventListener("click", () => { stopPlayback(); position = 0; renderStep(); });
elements.previous.addEventListener("click", () => { stopPlayback(); position = Math.max(0, position - 1); renderStep(); });
elements.next.addEventListener("click", () => { stopPlayback(); position = Math.min(result.outputLength - 1, position + 1); renderStep(); });
elements.speed.addEventListener("change", () => {
  if (playbackTimer === null) return;
  clearInterval(playbackTimer);
  playbackTimer = setInterval(tick, Number(elements.speed.value));
});

updateVisualization();
