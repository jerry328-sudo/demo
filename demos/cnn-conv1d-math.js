export function resolvePadding(config) {
  const effectiveKernel = config.dilation * (config.kernelSize - 1) + 1;
  if (config.paddingRule === "valid") return { left: 0, right: 0, effectiveKernel };
  if (config.paddingRule === "same") {
    const total = effectiveKernel - 1;
    return { left: Math.floor(total / 2), right: Math.ceil(total / 2), effectiveKernel };
  }
  return { left: config.padding, right: config.padding, effectiveKernel };
}

export function validateConfig(config) {
  const bounds = {
    length: [5, 30], inChannels: [1, 8], outChannels: [1, 8],
    kernelSize: [1, 7], stride: [1, 6], padding: [0, 10],
    dilation: [1, 5], groups: [1, 8],
  };
  for (const [name, [min, max]] of Object.entries(bounds)) {
    if (!Number.isInteger(config[name]) || config[name] < min || config[name] > max) {
      return `${name} 必须是 ${min}–${max} 的整数。`;
    }
  }
  if (!["custom", "valid", "same"].includes(config.paddingRule)) return "未知的填充规则。";
  if (!["zeros", "reflect", "replicate", "circular"].includes(config.paddingMode)) return "未知的填充模式。";
  if (config.inChannels % config.groups || config.outChannels % config.groups) {
    return "groups 必须同时整除输入和输出通道数。";
  }
  if (config.paddingRule === "same" && config.stride !== 1) {
    return "PyTorch 的 padding='same' 只支持 stride=1。";
  }
  const padding = resolvePadding(config);
  if (config.paddingMode === "reflect" && Math.max(padding.left, padding.right) >= config.length) {
    return "reflect 模式要求两侧填充量都小于输入长度。";
  }
  if (config.length + padding.left + padding.right < padding.effectiveKernel) {
    return "有效卷积核大于填充后的输入长度；请减小卷积核或空洞率，或增加填充。";
  }
  return null;
}

function inputValue(channel, index) {
  return ((channel * 7 + index * 3 + 4) % 13 - 6) / 10;
}

function weightValue(outChannel, localChannel, kernelIndex) {
  return ((outChannel * 5 + localChannel * 3 + kernelIndex * 7 + 2) % 11 - 5) / 10;
}

function biasValue(outChannel) {
  return ((outChannel * 3 + 1) % 5 - 2) / 10;
}

export function sourceIndex(index, length, mode) {
  if (index >= 0 && index < length) return index;
  if (mode === "zeros") return null;
  if (mode === "replicate") return Math.max(0, Math.min(length - 1, index));
  if (mode === "circular") return ((index % length) + length) % length;
  // Reflection does not repeat either endpoint.
  const period = 2 * length - 2;
  const reflected = ((index % period) + period) % period;
  return reflected < length ? reflected : period - reflected;
}

export function computeConv1d(config, supplied = {}) {
  const error = validateConfig(config);
  if (error) throw new RangeError(error);

  const padding = resolvePadding(config);
  const outputLength = Math.floor(
    (config.length + padding.left + padding.right - padding.effectiveKernel) / config.stride
  ) + 1;
  const channelsPerGroup = config.inChannels / config.groups;
  const outputsPerGroup = config.outChannels / config.groups;
  const input = supplied.input ?? Array.from({ length: config.inChannels }, (_, channel) =>
    Array.from({ length: config.length }, (_, index) => inputValue(channel, index))
  );
  const weights = supplied.weights ?? Array.from({ length: config.outChannels }, (_, outChannel) =>
    Array.from({ length: channelsPerGroup }, (_, localChannel) =>
      Array.from({ length: config.kernelSize }, (_, kernelIndex) =>
        weightValue(outChannel, localChannel, kernelIndex)
      )
    )
  );
  const biases = supplied.biases ?? Array.from({ length: config.outChannels }, (_, channel) => biasValue(channel));

  const result = { config, padding, input, weights, biases, outputLength, channelsPerGroup, outputsPerGroup };
  result.output = Array.from({ length: config.outChannels }, (_, outChannel) =>
    Array.from({ length: outputLength }, (_, position) => getStepDetail(result, outChannel, position).total)
  );
  return result;
}

export function getStepDetail(result, outChannel, position) {
  const { config, padding, input, weights, biases, channelsPerGroup, outputsPerGroup } = result;
  const group = Math.floor(outChannel / outputsPerGroup);
  const terms = [];
  for (let localChannel = 0; localChannel < channelsPerGroup; localChannel++) {
    const inChannel = group * channelsPerGroup + localChannel;
    for (let kernelIndex = 0; kernelIndex < config.kernelSize; kernelIndex++) {
      const paddedIndex = position * config.stride + kernelIndex * config.dilation;
      const inputIndex = paddedIndex - padding.left;
      const mappedIndex = sourceIndex(inputIndex, config.length, config.paddingMode);
      const inputNumber = mappedIndex === null ? 0 : input[inChannel][mappedIndex];
      const weight = weights[outChannel][localChannel][kernelIndex];
      terms.push({ inChannel, localChannel, kernelIndex, paddedIndex, inputIndex, mappedIndex, inputNumber, weight, product: inputNumber * weight });
    }
  }
  const sum = terms.reduce((total, term) => total + term.product, 0);
  const bias = config.bias ? biases[outChannel] : 0;
  return { outChannel, position, group, terms, sum, bias, total: sum + bias };
}
