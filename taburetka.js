import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// ---------- НАСТРОЙКИ (меняй здесь) ----------
const MODEL_PATH = './assets/taburetka.obj';
const TEXTURE_PATH = './assets/textures/wood.jpg'; // .jpg или .png
// ----------------------------------------------

const canvas = document.getElementById('stoolCanvas');
const fallback = document.getElementById('stoolFallback');
const stage = document.getElementById('stoolStage');
const filterGroup = document.querySelector('.filter-group');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
} catch (e) {
  showFallback('WebGL недоступен в этом браузере.');
  throw e;
}

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
controls.minDistance = 2;
controls.maxDistance = 12;
controls.maxPolarAngle = Math.PI / 2 + 0.1;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.2;
controls.target.set(0, 1.1, 0);

// ---------- Свет ----------
scene.add(new THREE.AmbientLight(0xfff1dc, 0.55));

const key = new THREE.DirectionalLight(0xffe3bf, 1.4);
key.position.set(4, 6, 3);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 4;
key.shadow.camera.bottom = -4;
scene.add(key);

const rim = new THREE.DirectionalLight(0xb87333, 0.5);
rim.position.set(-4, 3, -3);
scene.add(rim);

// ---------- Пол с тенью ----------
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(6, 64),
  new THREE.ShadowMaterial({ opacity: 0.35 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;
floor.receiveShadow = true;
scene.add(floor);

const floorVisual = new THREE.Mesh(
  new THREE.CircleGeometry(6, 64),
  new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1 })
);
floorVisual.rotation.x = -Math.PI / 2;
floorVisual.position.y = -0.02;
scene.add(floorVisual);

// ---------- Загрузка модели ----------
const textureLoader = new THREE.TextureLoader();
const objLoader = new OBJLoader();

let texture;
try {
  texture = textureLoader.load(TEXTURE_PATH);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
} catch (e) {
  console.warn('Текстура не загружена, используется базовый материал.');
}

const woodMat = new THREE.MeshStandardMaterial({
  color: texture ? 0xffffff : 0xe8a65a,
  map: texture || null,
  roughness: 0.7,
  metalness: 0.0,
});
const wireMat = new THREE.MeshBasicMaterial({
  color: 0xd9a76a,
  wireframe: true,
});

let model = null;
let wireMode = false;

objLoader.load(
  MODEL_PATH,
  (loadedModel) => {
    model = normalizeModel(loadedModel);
    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = woodMat;
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    scene.add(model);
    setupFilters(model);
  },
  (xhr) => {
    if (xhr.total) {
      console.log(`Загрузка модели: ${((xhr.loaded / xhr.total) * 100).toFixed(0)}%`);
    }
  },
  (err) => {
    console.error('Ошибка загрузки .obj:', err);
    showFallback('Не удалось загрузить модель taburetka.obj. Проверь путь и наличие файла.');
  }
);

// ---------- Нормализация модели (масштаб + центрирование) ----------
function normalizeModel(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Приводим к высоте ~2.5 единицы
  const targetHeight = 2.5;
  const scale = targetHeight / Math.max(size.x, size.y, size.z);
  obj.scale.setScalar(scale);

  // Пересчитываем после масштаба
  const box2 = new THREE.Box3().setFromObject(obj);
  const center2 = box2.getCenter(new THREE.Vector3());
  obj.position.sub(center2);
  obj.position.y += targetHeight / 2; // ставим на "пол"

  return obj;
}

// ---------- Режим каркаса ----------
const applyMode = () => {
  if (!model) return;
  model.traverse((obj) => {
    if (obj.isMesh) obj.material = wireMode ? wireMat : woodMat;
  });
};

document.getElementById('stoolRotate').addEventListener('click', (e) => {
  wireMode = false;
  applyMode();
  controls.autoRotate = true;
  e.currentTarget.classList.add('is-active');
  e.currentTarget.setAttribute('aria-pressed', 'true');
  document.getElementById('stoolWire').classList.remove('is-active');
  document.getElementById('stoolWire').setAttribute('aria-pressed', 'false');
});

document.getElementById('stoolWire').addEventListener('click', (e) => {
  wireMode = true;
  applyMode();
  controls.autoRotate = false;
  e.currentTarget.classList.add('is-active');
  e.currentTarget.setAttribute('aria-pressed', 'true');
  document.getElementById('stoolRotate').classList.remove('is-active');
  document.getElementById('stoolRotate').setAttribute('aria-pressed', 'false');
});

// ---------- Фильтры деталей (работают если в OBJ есть именованные группы) ----------
function setupFilters(root) {
  const groups = {};
  root.traverse((obj) => {
    if (obj.isMesh && obj.name) {
      const name = obj.name.toLowerCase();
      if (name.includes('seat') || name.includes('сидень') || name.includes('sit')) {
        groups.seat = groups.seat || [];
        groups.seat.push(obj);
      }
      if (name.includes('leg') || name.includes('ножк')) {
        groups.legs = groups.legs || [];
        groups.legs.push(obj);
      }
      if (name.includes('rung') || name.includes('cross') || name.includes('пронож')) {
        groups.rungs = groups.rungs || [];
        groups.rungs.push(obj);
      }
    }
  });

  // Если групп нет — скрываем фильтры
  if (!groups.seat && !groups.legs && !groups.rungs) {
    if (filterGroup) filterGroup.style.display = 'none';
    return;
  }

  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      filterBtns.forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');

      // Скрыть все mesh, показать нужные
      root.traverse((obj) => {
        if (obj.isMesh) obj.visible = false;
      });

      if (filter === 'all') {
        root.traverse((obj) => { if (obj.isMesh) obj.visible = true; });
      } else {
        (groups[filter] || []).forEach((m) => { m.visible = true; });
      }
    });
  });
}

// ---------- Fallback ----------
function showFallback(msg) {
  if (canvas) canvas.hidden = true;
  if (fallback) {
    fallback.hidden = false;
    fallback.innerHTML = `<p>${msg}</p>`;
  }
}

// ---------- Ресайз ----------
const resize = () => {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
resize();
window.addEventListener('resize', resize);

// ---------- Анимация ----------
const tick = () => {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
};
tick();
