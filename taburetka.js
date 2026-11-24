import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const canvas = document.getElementById('stoolCanvas');
const fallback = document.getElementById('stoolFallback');
const stage = document.getElementById('stoolStage');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
} catch (e) {
  fallback.hidden = false;
  canvas.hidden = true;
  throw e;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x15110d, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x15110d, 8, 18);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(3.5, 3, 4.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI / 2 + 0.1;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.2;
controls.target.set(0, 1.1, 0);

scene.add(new THREE.AmbientLight(0xfff1dc, 0.55));
const key = new THREE.DirectionalLight(0xffe3bf, 1.2);
key.position.set(4, 6, 3);
scene.add(key);
const rim = new THREE.DirectionalLight(0xb87333, 0.5);
rim.position.set(-4, 3, -3);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(6, 64),
  new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;
scene.add(floor);

const woodMat = new THREE.MeshStandardMaterial({
  color: 0xe8a65a, roughness: 0.7, metalness: 0.0,
});
const wireMat = new THREE.MeshBasicMaterial({
  color: 0xd9a76a, wireframe: true,
});

const stool = new THREE.Group();
const seatGroup = new THREE.Group();
const legsGroup = new THREE.Group();
const rungsGroup = new THREE.Group();

const seat = new THREE.Mesh(
  new THREE.CylinderGeometry(0.6, 0.6, 0.1, 48), woodMat
);
seat.position.y = 1.5;
seatGroup.add(seat);

const legGeom = new THREE.CylinderGeometry(0.055, 0.04, 1.45, 16);
const tilt = THREE.MathUtils.degToRad(8);
for (let i = 0; i < 4; i++) {
  const leg = new THREE.Mesh(legGeom, woodMat);
  const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
  const r = 0.42;
  leg.position.set(Math.cos(angle) * r, 0.75, Math.sin(angle) * r);
  leg.rotation.x = Math.sin(angle) * tilt;
  leg.rotation.z = -Math.cos(angle) * tilt;
  legsGroup.add(leg);
}

const rungGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.85, 12);
for (let i = 0; i < 4; i++) {
  const a1 = (i / 4) * Math.PI * 2 + Math.PI / 4;
  const a2 = ((i + 1) / 4) * Math.PI * 2 + Math.PI / 4;
  const r = 0.32;
  const p1 = new THREE.Vector3(Math.cos(a1) * r, 0.45, Math.sin(a1) * r);
  const p2 = new THREE.Vector3(Math.cos(a2) * r, 0.45, Math.sin(a2) * r);
  const rung = new THREE.Mesh(rungGeom, woodMat);
  const mid = p1.clone().add(p2).multiplyScalar(0.5);
  rung.position.copy(mid);
  rung.lookAt(p2);
  rung.rotateX(Math.PI / 2);
  rungsGroup.add(rung);
}

stool.add(seatGroup);
stool.add(legsGroup);
stool.add(rungsGroup);
scene.add(stool);

let wireMode = false;
const applyMode = () => {
  stool.traverse((obj) => {
    if (obj.isMesh) obj.material = wireMode ? wireMat : woodMat;
  });
};

document.getElementById('stoolRotate').addEventListener('click', (e) => {
  wireMode = false; applyMode();
  controls.autoRotate = true;
  e.currentTarget.classList.add('is-active');
  e.currentTarget.setAttribute('aria-pressed', 'true');
  document.getElementById('stoolWire').classList.remove('is-active');
  document.getElementById('stoolWire').setAttribute('aria-pressed', 'false');
});

document.getElementById('stoolWire').addEventListener('click', (e) => {
  wireMode = true; applyMode();
  controls.autoRotate = false;
  e.currentTarget.classList.add('is-active');
  e.currentTarget.setAttribute('aria-pressed', 'true');
  document.getElementById('stoolRotate').classList.remove('is-active');
  document.getElementById('stoolRotate').setAttribute('aria-pressed', 'false');
});

const filterBtns = document.querySelectorAll('.filter-btn');
const groups = {
  all: [seatGroup, legsGroup, rungsGroup],
  seat: [seatGroup],
  legs: [legsGroup],
  rungs: [rungsGroup],
};

filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const filter = btn.dataset.filter;
    filterBtns.forEach((b) => {
      b.classList.remove('is-active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-pressed', 'true');
    [seatGroup, legsGroup, rungsGroup].forEach((g) => { g.visible = false; });
    groups[filter].forEach((g) => { g.visible = true; });
  });
});

const resize = () => {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
resize();
window.addEventListener('resize', resize);

const tick = () => {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
};
tick();
