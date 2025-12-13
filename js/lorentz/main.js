import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SpacetimeDiagram } from "./diagram.js";
import { setupUI } from "./ui.js";

const container = document.getElementById("canvas");
if (!container) throw new Error("Missing #canvas");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a12);

const viewSize = 24;
const camera = createOrthoCamera(container.clientWidth, container.clientHeight, viewSize);
camera.position.set(0, 0, 20);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;
controls.zoomSpeed = 1.1;
controls.mouseButtons = {
  LEFT: THREE.MOUSE.PAN,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN
};

const diagram = new SpacetimeDiagram({ extent: 10, gridStep: 1, primeGridStep: 2 });
scene.add(diagram.group);
setupUI(diagram);

function renderLoop() {
  requestAnimationFrame(renderLoop);
  controls.update();
  renderer.render(scene, camera);
}
renderLoop();

resize();
window.addEventListener("resize", resize);

function resize() {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;
  renderer.setSize(width, height, false);

  const aspect = width / height;
  const halfH = viewSize / 2;
  const halfW = halfH * aspect;
  camera.left = -halfW;
  camera.right = halfW;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
}

function createOrthoCamera(width, height, size) {
  const aspect = width / height;
  const halfH = size / 2;
  const halfW = halfH * aspect;
  return new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, 200);
}

