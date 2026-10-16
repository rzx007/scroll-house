// Phase 1 entry point.
//
// Structure: the page is one tall scroll container with a fixed canvas over
// it. Lenis smooths the scroll, ScrollTrigger reports progress 0..1, and every
// visual value is read from keyframe tracks at that progress. Nothing is
// animated by a timer, so scrubbing backwards replays the whole build exactly.
import * as THREE from 'three';
import { HOUSE, SLABS, REVEALS, TOTAL } from './layout.js';

import { MaterialBank, EdgeMaterialStore } from './materials/library.js';
import { buildShell } from './build/shell.js';
import { buildFurniture } from './build/furniture.js';
import { createPaperGround, createSkyDome, LabelLayer, createTitleBlock } from './build/plan.js';
import { buildSite } from './build/site.js';
import { RevealController } from './build/reveal.js';
import { CameraRig } from './camera/path.js';
import { makeDuskSkyTexture } from './lib/textures.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TIMELINE, CAPTIONS, REVEAL_TRACKS } from './timeline.js';
import { smoothstep } from './lib/interp.js';

// Query flags, needed before the renderer is built.
//   ?t=0.62   pin the whole timeline to one point (for review and stills)
//   ?still=1  draw a few frames and stop
// The page normally animates forever, which means a headless screenshot never
// settles; pinning plus still mode makes a capture cheap and reproducible.
const qp = new URLSearchParams(location.search);
const pinnedT = qp.has('t')
  ? Math.min(TOTAL, Math.max(0, Number(qp.get('t')) || 0))
  : null;
const stillMode = qp.has('still');
let frameCount = 0;

const dom = {
  stage: document.getElementById('stage'),
  labels: document.getElementById('labels'),
  overlay: document.getElementById('overlay'),
  caption: document.getElementById('caption'),
  captionIndex: document.getElementById('caption-index'),
  captionTitle: document.getElementById('caption-title'),
  captionSub: document.getElementById('caption-sub'),
  rail: document.getElementById('rail'),
  railFill: document.getElementById('rail-fill'),
  hint: document.getElementById('hint'),
  boot: document.getElementById('boot'),
};

// ------------------------------------------------------------ quality tier
// One dial for the whole page. A phone gets fewer pixels, a smaller shadow map
// and no post-processing; everything else is identical, so the stills in
// tools/shot.ps1 always show the full-quality path.
const lowPower =
  window.innerWidth < 900 ||
  (navigator.hardwareConcurrency || 4) <= 4 ||
  qp.has('low');
const QUALITY = {
  dpr: lowPower ? 1.5 : 2,
  shadow: lowPower ? 1024 : 2048,
  bloom: !lowPower,
};

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  // Without this the last frame is dropped once the loop stops, and a
  // screenshot taken afterwards captures an empty buffer.
  preserveDrawingBuffer: stillMode,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY.dpr));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Always ACES. three only tone-maps a material when it is drawing straight to
// the canvas, so in the composer path the materials hand linear HDR to the
// render target and OutputPass applies this setting at the end. Setting it to
// NoToneMapping here would leave the whole page un-tone-mapped.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
renderer.setClearColor(0xf4f1e9, 1);
// Reset once per frame instead of once per render call: the composer makes
// several, and renderer.info would otherwise only describe the last pass.
renderer.info.autoReset = false;
dom.stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(12, window.innerWidth / window.innerHeight, 0.25, 900);

// -------------------------------------------------------------------- env
// Start on the procedurally generated dusk so the page paints immediately, then
// swap in the real CC0 Poly Haven HDRI when the 1.4 MB file arrives. Both feed
// the reflections AND the visible sky, so they have to agree on where the sun
// is; environmentRotation turns the photograph to match the key light.
const ENV_ROTATION_Y = -0.62; // radians; tuned so the HDRI sun sits SW, low
const SKY_BRIGHTNESS = 0.75; // backdrop only; the IBL above runs at full strength
{
  scene.environmentRotation = new THREE.Euler(0, ENV_ROTATION_Y, 0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const fallback = makeDuskSkyTexture();
  const rt = pmrem.fromEquirectangular(fallback);
  scene.environment = rt.texture;
  scene.environmentIntensity = 0.95;
  fallback.dispose();
  pmrem.dispose();
}

// ------------------------------------------------------------------ light
// Late afternoon: the sun is low from the south-west, so it rakes through the
// south glazing and lands across the living room floor.
// The ground half of the hemisphere is deliberately light: it is what lights
// every downward-facing surface indoors, and a dark value turns the ceiling
// into a brown slab.
const hemi = new THREE.HemisphereLight(0xb7c4d0, 0xc2ad93, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffcf9c, 2.4);
sun.position.set(-17, 7.5, 27);
sun.target.position.set(0, 1, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(QUALITY.shadow, QUALITY.shadow);
sun.shadow.camera.left = -26;
sun.shadow.camera.right = 26;
sun.shadow.camera.top = 26;
sun.shadow.camera.bottom = -26;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 90;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);

// A cool bounce from the opposite side keeps the shadow side from going flat.
const fill = new THREE.DirectionalLight(0x9fb6cc, 0.55);
fill.position.set(24, 12, -20);
scene.add(fill);

// ------------------------------------------------------------- the building
const clipPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];
const bank = new MaterialBank();
const edges = new EdgeMaterialStore();

const shell = buildShell(HOUSE, SLABS, bank, edges, clipPlanes);
scene.add(shell.root, shell.capGroup);

const furniture = buildFurniture(bank, edges, clipPlanes);
scene.add(furniture);

// One sweep per space, each running the way the camera enters it, so material
// always appears ahead of the viewer rather than around them. The schedule
// itself lives in layout.js next to the rooms it belongs to.
for (const r of REVEALS) {
  bank.setSweep(
    r.group,
    new THREE.Vector3(...r.origin),
    new THREE.Vector3(...r.dir).normalize(),
    r.len
  );
}
// Anything without a sweep keeps the inert default, so its mask stays negative
// and it reads as a drawing forever. That is exactly what the roof wants: you
// only ever see it from outside, during the descent, when everything is line art.
//
// Matches the sun, so the white model shades the same way the render will.
bank.setKeyDir(sun.position.clone().sub(sun.target.position));

const paper = createPaperGround();
scene.add(paper.mesh);

// The grounds. Its 3D parts are pinned fully rendered and driven purely by
// alpha, so they stay out of the way while the sheet is still a sheet.
const site = buildSite(bank);
bank.setReveal('site', 1);
scene.add(site.root);

const sky = createSkyDome();
// The dome is turned by the same angle as the environment, so the sky you see
// and the sky doing the lighting stay the same photograph.
sky.mesh.rotation.y = ENV_ROTATION_Y;
scene.add(sky.mesh);

// Swap the gradient for the real environment map once it is here. Failure is
// not worth surfacing: the generated sky is a deliberate fallback.
new HDRLoader().load(
  'assets/hdri/safari_sunset.hdr',
  (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromEquirectangular(tex);
    scene.environment = rt.texture;
    pmrem.dispose();
    // Picked by elimination, and the GROUND half mattered more than the sky.
    // venice_sunset is warm but puts a city on the horizon. spaichingen_hill is
    // clean and warm but is a grassy hilltop, and its green ground bounce turns
    // every ceiling in the house olive. safari_sunset is dry veld: warm, nothing
    // built, neutral bounce. Its sky is soft rather than dramatic, which is what
    // the extra key light below is for.
    sky.setEnv(tex, SKY_BRIGHTNESS);
  },
  undefined,
  () => {}
);

// ------------------------------------------------------- post-processing
// Bloom exists for one reason: the low sun through the south glazing should
// bleed a little. The threshold is high and the strength low so it only ever
// catches the sun and the brightest part of the sky, never the plaster.
const composer = QUALITY.bloom ? new EffectComposer(renderer) : null;
let bloomPass = null;
if (composer) {
  composer.addPass(new RenderPass(scene, camera));
  // Deliberately timid. Every increase in strength puts a veil over the whole
  // frame, because the glazing hands bloom an enormous bright area rather than
  // a small highlight. A high threshold and a short radius keep the glow
  // pinned to the sun itself instead of lifting the mid-tones everywhere.
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.14, // strength
    0.42, // radius
    0.965 // threshold
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
}

const reveal = new RevealController({
  bank,
  edges,
  capGroup: shell.capGroup,
  caps: shell.caps,
  clipPlanes,
});

// -------------------------------------------------------------- annotation
const labelData = HOUSE.rooms.map((r) => ({
  x: (r.x0 + r.x1) / 2,
  z: (r.z0 + r.z1) / 2,
  name: r.name,
  dim: `${(r.x1 - r.x0).toFixed(2)} × ${(r.z1 - r.z0).toFixed(2)}`,
  major: r.id === 'living',
  small: r.x1 - r.x0 < 3.0,
}));
labelData.push({
  x: (HOUSE.terrace.x0 + HOUSE.terrace.x1) / 2,
  z: (HOUSE.terrace.z0 + HOUSE.terrace.z1) / 2,
  name: '南向露台',
  dim: `${(HOUSE.terrace.x1 - HOUSE.terrace.x0).toFixed(2)} × ${(
    HOUSE.terrace.z1 - HOUSE.terrace.z0
  ).toFixed(2)}`,
  small: true,
});
const labels = new LabelLayer(dom.labels, labelData);
dom.overlay.appendChild(createTitleBlock());

const rig = new CameraRig(camera);

// Everything the plan sheet has to hold, used to fit the long lens.
const PLAN_BOUNDS = {
  x0: Math.min(HOUSE.envelope.x0, HOUSE.terrace.x0),
  x1: Math.max(HOUSE.envelope.x1, HOUSE.terrace.x1),
  z0: HOUSE.envelope.z0,
  z1: HOUSE.terrace.z1,
};

// The interface flips from ink-on-paper to paper-on-dusk as the sheet goes.
const INK = [27, 25, 23];
const LIGHT = [244, 241, 233];
const rootStyle = document.documentElement.style;
function updateUiInk(t) {
  const k = smoothstep(0.3, 0.52, t);
  const c = INK.map((v, i) => Math.round(v + (LIGHT[i] - v) * k));
  rootStyle.setProperty('--ui', `${c[0]} ${c[1]} ${c[2]}`);
}

// ------------------------------------------------------------------- rail
CAPTIONS.forEach((c, i) => {
  const tick = document.createElement('div');
  tick.className = 'rail__tick';
  tick.dataset.i = String(i);
  tick.innerHTML = `<span class="rail__num">${c.n}</span><span class="rail__name">${c.t}</span>`;
  dom.rail.appendChild(tick);
});
const ticks = Array.from(dom.rail.querySelectorAll('.rail__tick'));

let activeCaption = -1;
function updateCaption(t) {
  let idx = 0;
  for (let i = 0; i < CAPTIONS.length; i++) {
    if (t >= CAPTIONS[i].a - 1e-6) idx = i;
  }
  if (idx !== activeCaption) {
    activeCaption = idx;
    const c = CAPTIONS[idx];
    dom.captionIndex.textContent = c.n;
    dom.captionSub.textContent = c.s;
    dom.captionTitle.textContent = c.t;
    dom.caption.classList.remove('is-in');
    // restart the transition
    void dom.caption.offsetWidth;
    dom.caption.classList.add('is-in');
    ticks.forEach((el, i) => el.classList.toggle('is-active', i === idx));
  }
  const c = CAPTIONS[activeCaption];
  const span = Math.max(1e-4, c.b - c.a);
  const local = Math.min(1, Math.max(0, (t - c.a) / span));
  dom.railFill.style.transform = `scaleY(${(
    (activeCaption + local) /
    CAPTIONS.length
  ).toFixed(4)})`;
}

// --------------------------------------------------------------- scrolling
let progressTarget = 0;
let progress = 0;

const lenis = new Lenis({
  duration: 1.15,
  wheelMultiplier: 1.0,
  touchMultiplier: 1.6,
  smoothWheel: true,
});
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

if (pinnedT === null) {
  ScrollTrigger.create({
    trigger: '#scroll',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      // The tracks are authored in plain timeline units, not 0..1, so the page
      // can grow without rescaling anything that already worked.
      progressTarget = self.progress * TOTAL;
    },
  });
}
// The scroll runway follows the timeline length, so adding a phase is a
// one-number change in layout.js.
//
// SCREENS_PER_UNIT is the pace, and it has to stay at the value Phase 1 was
// tuned at: the whole 0..1 arc was 10 screens. Getting this wrong scales the
// entire experience — 100 here instead of 1000 made every room fly past ten
// times too fast.
const SCREENS_PER_UNIT = 10;
document.getElementById('scroll').style.height = `${TOTAL * SCREENS_PER_UNIT * 100}vh`;
document.getElementById('scroll').dataset.screens = (TOTAL * SCREENS_PER_UNIT).toFixed(1);

let hintHidden = false;
lenis.on('scroll', ({ scroll }) => {
  if (!hintHidden && scroll > 60) {
    hintHidden = true;
    dom.hint.classList.add('is-gone');
  }
});

// ------------------------------------------------------------------ resize
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY.dpr));
  if (composer) {
    // The composer's targets are sized in device pixels, not CSS pixels.
    const dbs = renderer.getDrawingBufferSize(new THREE.Vector2());
    composer.setSize(dbs.x, dbs.y);
  }
  camera.aspect = w / h;
  rig.fitPlan(PLAN_BOUNDS, camera.aspect);
  rig.apply(progress);
  camera.updateProjectionMatrix();
}
rig.fitPlan(PLAN_BOUNDS, camera.aspect);
window.addEventListener('resize', resize);

// -------------------------------------------------------------------- loop
let vw = window.innerWidth;
let vh = window.innerHeight;
window.addEventListener('resize', () => {
  vw = window.innerWidth;
  vh = window.innerHeight;
});

function frame() {
  // renderer.info resets on every render call, and the composer makes several.
  // Reset once per frame instead so the still-mode readout counts the scene
  // passes rather than whichever fullscreen quad happened to run last.
  renderer.info.reset();

  progress = pinnedT === null ? progress + (progressTarget - progress) * 0.16 : pinnedT;
  const t = progress;

  rig.apply(t);

  reveal.setSection(TIMELINE.section.at(t));
  reveal.setRoof(TIMELINE.roofAlpha.at(t));
  reveal.setRoofEdges(TIMELINE.roofEdge.at(t));

  // Walk the house: each space turns from drawing to render on its own clock.
  for (const r of REVEAL_TRACKS) {
    bank.setReveal(r.group, r.reveal.at(t));
    edges.setOpacity(r.group, r.edge.at(t));
  }

  const paperAmt = TIMELINE.paper.at(t);
  paper.setPaper(paperAmt);
  // The grounds come in on the same clock as the sheet going, so the overhead
  // frame is a clean site plan and the grounds exist by the time the camera is
  // low enough to look out of the glazing.
  site.setPhase(1 - paperAmt);
  sky.setMix(TIMELINE.sky.at(t));

  labels.update(camera, vw, vh, TIMELINE.labels.at(t));
  updateCaption(t);
  updateUiInk(t);

  if (composer) composer.render();
  else renderer.render(scene, camera);

  if (stillMode && ++frameCount >= 8) {
    renderer.setAnimationLoop(null);
    // In still mode the last frame is the deliverable, so say out loud what
    // actually got drawn: an empty canvas is otherwise impossible to tell from
    // a slow one.
    const i = renderer.info.render;
    dom.hint.classList.remove('is-gone');
    dom.hint.textContent = `t=${t.toFixed(3)}  calls=${i.calls} tris=${i.triangles}  cam=${camera.position
      .toArray()
      .map((v) => v.toFixed(1))
      .join(',')}`;
    dom.hint.style.letterSpacing = '0';
  }
}
renderer.setAnimationLoop(frame);

// Park the scroll position and lift the boot curtain once the first frame is up.
window.scrollTo(0, 0);
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    dom.boot.classList.add('is-gone');
    updateCaption(0);
  });
});
