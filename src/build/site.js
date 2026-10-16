// The grounds.
//
// The house is the subject and the outdoors is only ever seen through the south
// glazing, so this is built around three things that read at eye height rather
// than around completeness:
//
//   1. a reflective pool just outside the terrace, because at dusk a sheet of
//      water doubles the sky and gives the view its contrast
//   2. a treeline far enough out to be pure silhouette against the sunset
//   3. the site kept as a DRAWING. Boundary, paving, pool edge and planting
//      beds are drawn in line work like a site plan, and they stay drawn at low
//      opacity over the render. This is the same idea as the building: the
//      drawing and the thing are one model. It also means no 3D vegetation to
//      get wrong.
//
// The 3D parts live in the bank's "site" group with uReveal pinned at 1, so the
// only thing driving them is uAlpha: invisible while the sheet is still a sheet,
// fading in as the camera comes down. The line work is plain LineBasicMaterial
// and never goes away.
import * as THREE from 'three';

const LINE_Y = 0.004;
const LINE_COLOR = 0x151311;

// Zones, in metres. The pool and its deck sit south of the 3.6 m terrace with a
// strip of lawn between, so from the living room you read lawn, then water.
const POOL = { x0: -8.5, x1: 8.5, z0: 13.5, z1: 21.5 };
const DECK = { x0: -11.5, x1: 11.5, z0: 13.0, z1: 22.0 };
const BOUNDS = { x0: -28, x1: 28, z0: -24, z1: 30 };
const TREELINE_RADIUS = 76;

export function buildSite(bank) {
  const root = new THREE.Group();
  const drawn = new THREE.Group(); // line work, always visible
  const built = new THREE.Group(); // water and planting, fades in
  root.add(drawn, built);

  const lineMat = new THREE.LineBasicMaterial({
    color: LINE_COLOR,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });

  const loop = (pts) => {
    const v = pts.map(([x, z]) => new THREE.Vector3(x, LINE_Y, z));
    v.push(v[0].clone());
    drawn.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(v), lineMat));
  };
  const rect = (r) =>
    loop([
      [r.x0, r.z0],
      [r.x1, r.z0],
      [r.x1, r.z1],
      [r.x0, r.z1],
    ]);
  const path = (pts) => loop(pts);

  // ---- the site plan ----
  rect(BOUNDS); // property boundary
  rect(DECK); // pool deck
  rect(POOL); // water edge
  rect({ x0: -10.2, x1: 10.2, z0: 8.0, z1: 11.6 }); // terrace, re-drawn as drawn work
  rect({ x0: -1.8, x1: 0.9, z0: 8.0, z1: 10.4 }); // entrance porch

  // planting beds: two flanking the pool, one long run along the west boundary
  rect({ x0: -15.5, x1: -11.5, z0: 12.4, z1: 22.6 });
  rect({ x0: 11.5, x1: 15.5, z0: 12.4, z1: 22.6 });
  rect({ x0: BOUNDS.x0 + 1.5, x1: BOUNDS.x0 + 6.5, z0: -20, z1: 26 });
  rect({ x0: BOUNDS.x1 - 6.5, x1: BOUNDS.x1 - 1.5, z0: -20, z1: 26 });
  rect({ x0: -22, x1: 22, z0: BOUNDS.z0 + 1.5, z1: BOUNDS.z0 + 5.5 });

  // a walk from the porch out to the pool deck, and a cross walk along the deck
  path([
    [0.9, 10.4],
    [0.9, 13.0],
  ]);
  path([
    [-10.2, 12.0],
    [10.2, 12.0],
  ]);

  // ---- water ----
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(POOL.x1 - POOL.x0, POOL.z1 - POOL.z0).rotateX(-Math.PI / 2),
    bank.solid('water', 'site', {
      color: 0x223038,
      roughness: 0.05,
      metalness: 0.12,
      envMapIntensity: 2.4,
      transparent: true,
      depthWrite: true,
    })
  );
  water.position.set((POOL.x0 + POOL.x1) / 2, 0.0, (POOL.z0 + POOL.z1) / 2);
  water.receiveShadow = false;
  built.add(water);

  // pool coping, so the water reads as a constructed basin rather than a hole
  const copingMat = bank.solid('coping', 'site', {
    color: 0xbab2a4,
    roughness: 0.7,
    transparent: true,
  });
  const cope = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, d), copingMat);
    m.position.set(x, 0.045, z);
    built.add(m);
  };
  const cw = 0.45;
  cope(POOL.x1 - POOL.x0 + cw * 2, cw, 0, POOL.z0 - cw / 2);
  cope(POOL.x1 - POOL.x0 + cw * 2, cw, 0, POOL.z1 + cw / 2);
  cope(cw, POOL.z1 - POOL.z0, POOL.x0 - cw / 2, (POOL.z0 + POOL.z1) / 2);
  cope(cw, POOL.z1 - POOL.z0, POOL.x1 + cw / 2, (POOL.z0 + POOL.z1) / 2);

  // ---- treeline ----
  // One InstancedMesh, so a hundred canopies cost one draw call. They are pure
  // silhouette: no edge lines, no trunks, dark, and deliberately low detail —
  // anything more and they read as cheap 3D rather than as distance.
  // Detail 1 rather than 0: at 20 faces the silhouette is visibly faceted, and
  // these are read as outlines against the sky where the silhouette is all you
  // see. Instancing makes the extra vertices free.
  const canopy = new THREE.IcosahedronGeometry(1, 1);
  const treeMat = bank.solid('canopy', 'site', {
    color: 0x33402f,
    roughness: 0.95,
    flatShading: true,
    transparent: true,
  });
  const COUNT = 360;
  const trees = new THREE.InstancedMesh(canopy, treeMat, COUNT);
  trees.castShadow = false;
  trees.receiveShadow = false;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let seed = 8;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < COUNT; i++) {
    const ang = (i / COUNT) * Math.PI * 2;
    const rad = TREELINE_RADIUS + rnd() * 22;
    // Two sine waves of different frequency set the height, so the top of the
    // treeline rises and falls in long swells with a ragged edge on top of
    // that. Pure per-tree noise reads as scattered bushes, not as distance.
    const wave = 0.5 + 0.5 * Math.sin(ang * 4 + 0.6) * Math.sin(ang * 9 + 2.1);
    const sy = 3.4 + 2.6 * wave + rnd() * 1.0;
    const sx = 2.4 + rnd() * 1.8;
    // sunk so the base sits on the ground rather than half-buried
    pos.set(Math.sin(ang) * rad, sy * 0.42, Math.cos(ang) * rad);
    scl.set(sx, sy, sx * (0.8 + rnd() * 0.5));
    q.setFromAxisAngle(up, rnd() * Math.PI);
    m4.compose(pos, q, scl);
    trees.setMatrixAt(i, m4);
  }
  trees.instanceMatrix.needsUpdate = true;
  built.add(trees);

  // Water and planting start hidden and fade in as the sheet gives way, so the
  // overhead frame stays a clean site plan.
  built.visible = false;

  return {
    root,
    // 0 = drawing, 1 = rendered
    setPhase(v) {
      // Line work never fully leaves, for the same reason the building's does
      // not: the drawing stays legible over what it describes.
      lineMat.opacity = 0.85 - 0.62 * v;
      built.visible = v > 0.005;
      bank.setAlpha('site', v);
    },
  };
}
