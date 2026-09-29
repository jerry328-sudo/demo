import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { generateSamplingGrid } from "./brillouin_sampling_math.js";

const container = document.getElementById("visualization");
const errorMessage = document.getElementById("error-message");
const methodSelect = document.getElementById("method");
const gridInputs = ["nx", "ny", "nz"].map((id) => document.getElementById(id));
const colorInput = document.getElementById("color");
const opacityInput = document.getElementById("opacity");
const counter = document.getElementById("counter");
const gridSummary = document.getElementById("grid-summary");
const colorValue = document.getElementById("color-value");
const opacityValue = document.getElementById("opacity-value");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.up.set(0, 0, 1);
camera.position.set(2.4, 1.45, 2.35);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);
} catch (error) {
  errorMessage.textContent = "当前浏览器无法启动三维视图，请检查 WebGL 是否可用。";
  errorMessage.hidden = false;
  throw error;
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 2.9;
controls.maxDistance = 9;

scene.add(new THREE.AmbientLight(0xffffff, 0.78));
const keyLight = new THREE.DirectionalLight(0xd7f5ff, 1.4);
keyLight.position.set(3, 5, 4);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x3278ff, 0.8);
fillLight.position.set(-3, -2, -4);
scene.add(fillLight);

// The Wigner–Seitz cell of the BCC reciprocal lattice is a truncated octahedron.
const bzVertices = [];
for (const fixedAxis of [0, 1, 2]) {
  for (const fixedSign of [-1, 1]) {
    for (const otherAxis of [0, 1, 2].filter((axis) => axis !== fixedAxis)) {
      for (const otherSign of [-1, 1]) {
        const vertex = [0, 0, 0];
        vertex[fixedAxis] = fixedSign;
        vertex[otherAxis] = otherSign * 0.5;
        bzVertices.push(new THREE.Vector3(...vertex));
      }
    }
  }
}

const bzGeometry = new ConvexGeometry(bzVertices);
const bzSurface = new THREE.Mesh(bzGeometry, new THREE.MeshPhongMaterial({
  color: 0x15589d,
  emissive: 0x092d55,
  transparent: true,
  opacity: 0.19,
  side: THREE.DoubleSide,
  depthWrite: false,
  shininess: 65,
}));
scene.add(bzSurface);

const bzEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(bzGeometry),
  new THREE.LineBasicMaterial({ color: 0x2bdeff })
);
scene.add(bzEdges);

const axisGeometry = new THREE.BufferGeometry();
axisGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
  0, 0, 0, 1.1, 0, 0,
  0, 0, 0, 0, 1.1, 0,
  0, 0, 0, 0, 0, 1.1,
], 3));
axisGeometry.setAttribute("color", new THREE.Float32BufferAttribute([
  0.55, 0.2, 0.2, 0.94, 0.34, 0.34,
  0.17, 0.37, 0.83, 0.3, 0.54, 1,
  0.2, 0.52, 0.38, 0.27, 0.83, 0.5,
], 3));
scene.add(new THREE.LineSegments(axisGeometry, new THREE.LineBasicMaterial({
  vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false,
})));

function addAxisLabel(letter, color, position) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  context.font = "bold 42px Segoe UI, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  context.fillText(letter, 32, 33);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false,
  }));
  sprite.position.set(...position);
  sprite.scale.set(0.27, 0.27, 1);
  scene.add(sprite);
}

addAxisLabel("X", "#ff7777", [1.27, 0, 0]);
addAxisLabel("Y", "#719fff", [0, 1.27, 0]);
addAxisLabel("Z", "#65df9a", [0, 0, 1.27]);

const gammaPoint = new THREE.Mesh(
  new THREE.SphereGeometry(0.061, 20, 16),
  new THREE.MeshPhongMaterial({ color: 0xffd04e, emissive: 0x9b6500, shininess: 90 })
);
scene.add(gammaPoint);

const sampleMaterial = new THREE.MeshPhongMaterial({
  color: colorInput.value,
  emissive: colorInput.value,
  emissiveIntensity: 0.32,
  shininess: 85,
  transparent: true,
  opacity: Number(opacityInput.value),
  depthWrite: false,
});
const sampleGeometry = new THREE.SphereGeometry(1, 10, 8);
let sampleMesh = null;

function readGridSize(input, normalize) {
  const value = Number(input.value);
  const normalized = Number.isFinite(value) ? Math.min(16, Math.max(1, Math.floor(value))) : 1;
  if (normalize) input.value = String(normalized);
  return normalized;
}

function clearSamples() {
  if (sampleMesh) {
    scene.remove(sampleMesh);
    sampleMesh.dispose();
    sampleMesh = null;
  }
  counter.textContent = "0";
  gridSummary.textContent = "未显示采样点";
}

function rebuildSamples({ normalize = true } = {}) {
  const [nx, ny, nz] = gridInputs.map((input) => readGridSize(input, normalize));
  const points = generateSamplingGrid(nx, ny, nz, methodSelect.value);
  clearSamples();

  sampleMesh = new THREE.InstancedMesh(sampleGeometry, sampleMaterial, points.length);
  sampleMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D();
  const radius = Math.max(0.012, Math.min(0.032, 0.14 / Math.cbrt(points.length)));
  points.forEach((point, index) => {
    dummy.position.set(...point);
    dummy.scale.setScalar(radius);
    dummy.updateMatrix();
    sampleMesh.setMatrixAt(index, dummy.matrix);
  });
  sampleMesh.instanceMatrix.needsUpdate = true;
  scene.add(sampleMesh);
  counter.textContent = String(points.length);
  gridSummary.textContent = `${nx} × ${ny} × ${nz}`;
}

function updateAppearance() {
  sampleMaterial.color.set(colorInput.value);
  sampleMaterial.emissive.set(colorInput.value);
  sampleMaterial.opacity = Number(opacityInput.value);
  sampleMaterial.needsUpdate = true;
  colorValue.textContent = colorInput.value.toUpperCase();
  opacityValue.textContent = Number(opacityInput.value).toFixed(2);
  document.querySelector(".legend-sample").style.background = colorInput.value;
}

methodSelect.addEventListener("change", rebuildSamples);
gridInputs.forEach((input) => {
  input.addEventListener("input", () => {
    if (gridInputs.every((candidate) => /^[1-9]\d*$/.test(candidate.value) && Number(candidate.value) <= 16)) {
      rebuildSamples({ normalize: false });
    }
  });
  input.addEventListener("change", rebuildSamples);
});
colorInput.addEventListener("input", updateAppearance);
opacityInput.addEventListener("input", updateAppearance);
document.getElementById("reset").addEventListener("click", clearSamples);
document.getElementById("regenerate").addEventListener("click", rebuildSamples);

const resizeObserver = new ResizeObserver(() => {
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) return;
  camera.fov = width < 600 ? 55 : 42;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});
resizeObserver.observe(container);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

updateAppearance();
rebuildSamples();
animate();
