import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// ---------- НАСТРОЙКИ ----------
const MODEL_PATH = './assets/taburetka.obj';
const TEXTURE_PATH = './assets/textures/wood.jpg';
// -------------------------------

const canvas = document.getElementById('stoolCanvas');
const fallback = document.getElementById('stoolFallback');
const stage = document.getElementById('stoolStage');
const filterGroup = document.querySelector('.filter-group');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  showFallback('WebGL недоступен в этом браузере.');
  throw e;
}
fallback.hidden = true; // <-- КЛЮЧЕВОЙ ФИКС: прячем заглушку при рабочем WebGL

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x15110d, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x15110d, 8, 20);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(3.5, 3, 4.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2 + 0.1;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.2;

// ---------- Свет ----------
scene.add(new THREE.AmbientLight(0xfff1dc, 0.6));
const key = new THREE.DirectionalLight(0xffe3bf, 1.4);
key.position.set(4, 6, 3);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
const rim = new THREE.DirectionalLight(0xb87333, 0.5);
rim.position.set(-4, 3, -3);
scene.add(rim);

// ---------- Пол ----------
const floorVisual = new THREE.Mesh(
  new THREE.CircleGeometry(6, 64),
  new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1 })
);
floorVisual.rotation.x = -Math.PI / 2;
floorVisual.position.y = -0.02;
scene.add(floorVisual);

const floorShadow = new THREE.Mesh(
  new THREE.CircleGeometry(6, 64),
  new THREE.ShadowMaterial({ opacity: 0.35 })
);
floorShadow.rotation.x = -Math.PI / 2;
floorShadow.position.y = -0.01;
floorShadow.receiveShadow = true;
scene.add(floorShadow);

// ---------- Материалы ----------
const textureLoader = new THREE.TextureLoader();
let texture = null;
try {
  texture = textureLoader.load(TEXTURE_PATH);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
} catch (e) {
  console.warn('Текстура не загружена — используется базовый материал.');
}

const woodMat = new THREE.MeshStandardMaterial({
  color: texture ? 0xffffff : 0xe8a65a,
  map: texture,
  roughness: 0.7,
  metalness: 0,
});
const wireMat = new THREE.MeshBasicMaterial({ color: 0xd9a76a, wireframe: true });

let model = null;
let wireMode = false;

// ---------- Загрузка OBJ ----------
new OBJLoader().load(
  MODEL_PATH,
  (loaded) => {
    model = normalizeModel(loaded);
    model.traverse((o) => {
      if (o.isMesh) {
        o.material = woodMat;
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(model);
    fitCameraToObject(model);
    setupFilters(model);
    fallback.hidden = true; // <-- на всякий случай ещё раз прячем заглушку
    console.log('Модель отображена. Мешей:', countMeshes(model));
  },
  (xhr) => {
    if (xhr.total) console.log(`Загрузка модели: ${((xhr.loaded / xhr.total) * 100).toFixed(0)}%`);
  },
  (err) => {
    console.error('Ошибка загрузки .obj:', err);
    showFallback('Не удалось загрузить taburetka.obj. Проверь путь и наличие файла.');
  }
);

// ---------- Нормализация (масштаб + посадка на пол) ----------
function normalizeModel(obj) {
  let box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Если размер невалидный (NaN/0) — не трогаем масштаб, только центрируем
  if (isFinite(maxDim) && maxDim > 0) {
    const scale = 2.5 / maxDim;
    obj.scale.setScalar(scale);
    box = new THREE.Box3().setFromObject(obj);
  }

  const center = box.getCenter(new THREE.Vector3());
  obj.position.x -= center.x;
  obj.position.z -= center.z;
  obj.position.y -= box.min.y; // ставим нижнюю точку на уровень пола
  return obj;
}

// ---------- Авто-подгонка камеры под модель ----------
function fitCameraToObject(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.6;

  controls.target.copy(center);
  camera.position.set(center.x + dist * 0.7, center.y + dist * 0.35, center.z + dist);
  controls.minDistance = dist * 0.5;
  controls.maxDistance = dist * 3;
  controls.update();
}

function countMeshes(obj) {
  let n = 0;
  obj.traverse((o) => { if (o.isMesh) n++; });
  return n;
}

// ---------- Режим каркаса ----------
const applyMode = () => {
  if (!model) return;
  model.traverse((o) => { if (o.isMesh) o.material = wireMode ? wireMat : woodMat; });
};

document.getElementById('stoolRotate').addEventListener('click', (e) => {
  wireMode = false; applyMode(); controls.autoRotate = true;
  setActive(e.currentTarget, document.getElementById('stoolWire'));
});
document.getElementById('stoolWire').addEventListener('click', (e) => {
  wireMode = true; applyMode(); controls.autoRotate = false;
  setActive(e.currentTarget, document.getElementById('stoolRotate'));
});

function setActive(on, off) {
  on.classList.add('is-active'); on.setAttribute('aria-pressed', 'true');
  off.classList.remove('is-active'); off.setAttribute('aria-pressed', 'false');
}

// ---------- Фильтры деталей (работают по именам групп в OBJ) ----------
function setupFilters(root) {
  const groups = { seat: [], legs: [], rungs: [] };
  root.traverse((o) => {
    if (!o.isMesh || !o.name) return;
    const n = o.name.toLowerCase();
    if (n.includes('seat') || n.includes('сидень') || n.includes('sit')) groups.seat.push(o);
    else if (n.includes('leg') || n.includes('ножк')) groups.legs.push(o);
    else if (n.includes('rung') || n.includes('cross') || n.includes('пронож')) groups.rungs.push(o);
  });

  const hasGroups = groups.seat.length || groups.legs.length || groups.rungs.length;
  if (!hasGroups) { if (filterGroup) filterGroup.style.display = 'none'; return; }

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      root.traverse((o) => { if (o.isMesh) o.visible = f === 'all'; });
      if (f !== 'all') groups[f].forEach((m) => { m.visible = true; });
    });
  });
}

// ---------- Заглушка ----------
function showFallback(msg) {
  if (canvas) canvas.hidden = true;
  if (fallback) { fallback.hidden = false; fallback.innerHTML = `<p>${msg}</p>`; }
}

// ---------- Ресайз + цикл ----------
const resize = () => {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
resize();
window.addEventListener('resize', resize);

(function tick() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
})();
