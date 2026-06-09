import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const workId = params.get('id');

// ---- Load metadata + render info panel ----
const data = await fetch('data/works.json', { cache: 'no-cache' }).then(r => r.json());
const work = data.works.find(w => w.id === workId) || data.works[0];
const uploader = data.uploaders.find(u => u.id === work.uploaderId) || {};
document.title = `${work.title} — 114-2 數位博物館課程成果`;

$('info').innerHTML = `
  <h1>${work.title}</h1>
  <div class="sub-en">${work.subtitle || ''}</div>
  <div class="info-row"><span class="k">展示單位</span><span class="v">${uploader.name || '—'}</span></div>
  ${uploader.students && uploader.students.length ? `<div class="info-row"><span class="k">學生</span><span class="v">${uploader.students.join('、')}</span></div>` : ''}
  ${work.location ? `<div class="info-row"><span class="k">地點</span><span class="v">${work.location}</span></div>` : ''}
  ${work.date ? `<div class="info-row"><span class="k">建置日期</span><span class="v">${work.date}</span></div>` : ''}
  ${work.method ? `<div class="info-row"><span class="k">建置方式</span><span class="v">${work.method}</span></div>` : ''}
  ${work.coordinates ? `<div class="info-row"><span class="k">座標</span><span class="v">${work.coordinates}</span></div>` : ''}
  <div class="panel-tags">${(work.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}</div>
  <p class="desc">${work.description || ''}</p>
  ${work.credits ? `<p class="credits">${work.credits}</p>` : ''}
`;

// ---- Three.js scene ----
const canvas = $('viewer');
const wrap = canvas.parentElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c0a09);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
camera.position.set(0, 0, 3);

// Lighting (photogrammetry textures are pre-lit, so keep it soft + even)
scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(2, 3, 2); scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-2, 1, -2); scene.add(fill);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.7;
controls.zoomToCursor = true;
controls.minDistance = 0.05;

function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(wrap);
resize();

// ---- Load GLB ----
const draco = new DRACOLoader();
draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

let modelRoot = null;
let homeState = null;
const meshes = [];

loader.load(
  work.model,
  (gltf) => {
    modelRoot = gltf.scene;

    // Orientation is configurable per work (degrees). ContextCapture exports Z-up;
    // this scan was captured lying down, so the default stands it upright.
    // Override in works.json with e.g.  "rotation": [-90, 0, 0]  to taste.
    const rot = Array.isArray(work.rotation) ? work.rotation : [0, 0, 90];
    const d2r = Math.PI / 180;
    modelRoot.rotation.set(rot[0] * d2r, rot[1] * d2r, rot[2] * d2r);
    scene.add(modelRoot);
    modelRoot.updateMatrixWorld(true);

    // Center + scale so the largest dimension fills a ~2-unit view
    const box = new THREE.Box3().setFromObject(modelRoot);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = 2 / maxDim;
    modelRoot.scale.setScalar(s);
    modelRoot.position.sub(center.multiplyScalar(s));

    modelRoot.traverse(o => {
      if (o.isMesh) {
        meshes.push(o);
        o.frustumCulled = true;
        // Photogrammetry shells are single-sided; render both faces so the
        // surface looks solid instead of showing through to the inside.
        if (o.material) o.material.side = THREE.DoubleSide;
      }
    });

    // Frame the camera: front, slightly raised. "camera":[az,elev,dist] overrides.
    const fitH = (size.y * s) / 2 / Math.tan((camera.fov * d2r) / 2);
    const fitW = (size.x * s) / 2 / Math.tan((camera.fov * d2r) / 2) / camera.aspect;
    const dist = Math.max(fitH, fitW) * 1.35;
    const cam = Array.isArray(work.camera) ? work.camera : [0, 12, dist];
    const az = cam[0] * d2r, el = cam[1] * d2r, r = cam[2];
    camera.position.set(
      r * Math.cos(el) * Math.sin(az),
      r * Math.sin(el),
      r * Math.cos(el) * Math.cos(az)
    );
    controls.target.set(0, 0, 0);
    controls.update();
    homeState = { pos: camera.position.clone(), target: controls.target.clone() };

    // Gentle auto-rotate on by default so all sides are visible.
    autoRotate = true; controls.autoRotate = true; controls.autoRotateSpeed = 1.0;
    $('btn-rotate').classList.add('active');

    window.__viewer = { camera, controls, modelRoot, scene, THREE };
    $('loader').classList.add('hidden');
  },
  (e) => {
    if (e.total) {
      const p = Math.round((e.loaded / e.total) * 100);
      $('loader-pct').textContent = `載入模型中… ${p}%`;
    } else {
      $('loader-pct').textContent = `載入中… ${(e.loaded / 1048576).toFixed(1)} MB`;
    }
  },
  (err) => {
    console.error(err);
    $('loader-pct').textContent = '模型載入失敗，請確認 ' + work.model;
  }
);

// ---- Toolbar ----
let autoRotate = false, wire = false;
$('btn-rotate').onclick = (e) => {
  autoRotate = !autoRotate;
  controls.autoRotate = autoRotate;
  controls.autoRotateSpeed = 1.4;
  e.currentTarget.classList.toggle('active', autoRotate);
};
$('btn-reset').onclick = () => {
  if (!homeState) return;
  controls.autoRotate = autoRotate = false;
  $('btn-rotate').classList.remove('active');
  camera.position.copy(homeState.pos);
  controls.target.copy(homeState.target);
  controls.update();
};
$('btn-wire').onclick = (e) => {
  wire = !wire;
  meshes.forEach(m => { if (m.material) m.material.wireframe = wire; });
  e.currentTarget.classList.toggle('active', wire);
};
$('btn-full').onclick = () => {
  if (!document.fullscreenElement) wrap.requestFullscreen?.();
  else document.exitFullscreen?.();
};

// ---- Render loop ----
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
