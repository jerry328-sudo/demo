"""Reproduce the frozen GCN weights used by the browser demo.

Run with: python demos/gcn-inductive/train_weights.py
Requires NumPy. Training graphs and the test graph are disjoint.
"""

import json
from pathlib import Path

import numpy as np


TRAIN_GRAPHS = [
    ([0.9, 0.7, 0.35, -0.2, -0.65, -0.9, 0.55, -0.5],
     [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (1, 6), (4, 7)]),
    ([0.8, 0.55, 0.1, -0.55, -0.8, 0.75, -0.2, 0.45],
     [(0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (3, 6), (5, 7)]),
    ([-0.85, -0.6, -0.1, 0.55, 0.85, -0.7, 0.25, 0.7],
     [(0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (2, 6), (4, 7)]),
]


def adjacency(n, edges):
    a = np.eye(n)
    for i, j in edges:
        a[i, j] = a[j, i] = 1
    degree = a.sum(axis=1)
    return a / np.sqrt(degree[:, None] * degree[None, :])


def make_graph(signals, edges):
    s = np.array(signals)
    x = np.stack([s, np.ones_like(s)], axis=1)
    # Soft class targets keep the small teaching example from saturating at 0/1.
    y = (0.5 + 0.35 * np.where(s > 0, 1, -1))[:, None]
    return x, y, adjacency(len(s), edges)


def train(depth):
    rng = np.random.default_rng(70 + depth)
    shape = [2] + [5] * (depth - 1) + [1]
    weights = [rng.normal(0, 0.45, (a, b)) for a, b in zip(shape, shape[1:])]
    moment = [np.zeros_like(w) for w in weights]
    variance = [np.zeros_like(w) for w in weights]
    graphs = [make_graph(*graph) for graph in TRAIN_GRAPHS]

    for step in range(1, 1001):
        gradients = [np.zeros_like(w) for w in weights]
        for x, y, a in graphs:
            states = [x]
            messages = []
            for layer, weight in enumerate(weights):
                message = a @ states[-1]
                pre = message @ weight
                states.append(np.tanh(pre) if layer < depth - 1 else pre)
                messages.append(message)

            probability = 1 / (1 + np.exp(-np.clip(states[-1], -30, 30)))
            delta = (probability - y) / (len(graphs) * len(y))
            for layer in range(depth - 1, -1, -1):
                if layer < depth - 1:
                    delta *= 1 - states[layer + 1] ** 2
                gradients[layer] += messages[layer].T @ delta
                delta = a.T @ (delta @ weights[layer].T)

        for layer in range(depth):
            gradient = gradients[layer] + 0.001 * weights[layer]
            moment[layer] = 0.9 * moment[layer] + 0.1 * gradient
            variance[layer] = 0.999 * variance[layer] + 0.001 * gradient ** 2
            corrected_m = moment[layer] / (1 - 0.9 ** step)
            corrected_v = variance[layer] / (1 - 0.999 ** step)
            weights[layer] -= 0.022 * corrected_m / (np.sqrt(corrected_v) + 1e-8)

    return [np.round(w, 7).tolist() for w in weights]


if __name__ == "__main__":
    models = {str(depth): train(depth) for depth in range(1, 5)}
    target = Path(__file__).with_name("weights.json")
    target.write_text(json.dumps(models, separators=(",", ":")) + "\n")
    print(f"Saved {target}")
