// Checks the camera path against the building's solid geometry.
//
//   node tools/verify-path.mjs [aspect]
//
// The camera is the one thing that can silently ruin this page by flying
// through a wall, and with 25 screens of touring almost every wall in the house
// gets crossed at least once. It uses the REAL interpolator from
// src/lib/interp.js and parses the keyframes out of src/camera/path.js, so the
// only thing not exercised here is three.js itself.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Track } from '../src/lib/interp.js';
import { TOTAL } from '../src/layout.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/camera/path.js'), 'utf8');

const PLAN_CENTER_Z = 1.7;
const PLAN_FOV = 20;
const OVERHEAD_UNTIL = 0.34;

function grabArray(label) {
  const i = src.indexOf(label + ' = [');
  if (i < 0) throw new Error('could not find ' + label);
  const j = src.indexOf('];', i);
  const body = src
    .slice(src.indexOf('[', i), j + 1)
    .replace(/\/\/[^\n]*/g, '')
    .replace(/PLAN_CENTER_Z/g, String(PLAN_CENTER_Z))
    .replace(/,(\s*[\]])/g, '$1');
  return JSON.parse(body);
}

const KEYS = grabArray('const KEYS');
const FOV_MUL = grabArray('const FOV_MUL');

// Mirror of CameraRig.fitPlan.
const halfW = 11.2;
const halfH = 9.9;
const pad = 1.14;
const aspect = Number(process.argv[2] || 1.78);
const tanV = Math.tan((PLAN_FOV * Math.PI) / 360);
const D = Math.min(
  170,
  Math.max(70, Math.max((halfH * pad) / tanV, (halfW * pad) / (Math.max(0.25, aspect) * tanV)))
);

const keys = KEYS.map((k) =>
  k[0] <= OVERHEAD_UNTIL + 1e-9
    ? [k[0], k[1], D, PLAN_CENTER_Z + D * 0.012, k[4], k[5], k[6]]
    : k
);
const col = (i) => new Track(keys.map((k) => [k[0], k[i]]));
const px = col(1);
const py = col(2);
const pz = col(3);
const fovAt = (t) => Math.min(55, PLAN_FOV * new Track(FOV_MUL).at(t));

// Every wall as a solid slab, with the openings that pierce it. A hole is
// [along0, along1, y0, y1] measured along the wall.
//   axis 'z': the wall runs east-west at z = v; along is x.
//   axis 'x': the wall runs north-south at x = v; along is z.
const WALLS = [
  { name: 'front facade', axis: 'z', v: 7.88, a0: -11.2, a1: 11.2, th: 0.24, h: 2.8,
    holes: [[-1.6, 0.7, 0, 2.4]] },
  { name: 'north facade', axis: 'z', v: -8.08, a0: -11.2, a1: 11.2, th: 0.24, h: 2.8,
    holes: [[-10, -6.4, 0.8, 2.45], [-5.58, -4.38, 1.4, 2.4], [-2.88, -1.68, 1.4, 2.4],
            [-1.04, 1.36, 0.8, 2.45], [2.12, 4.32, 0.8, 2.45], [5.32, 7.72, 0.8, 2.45]] },
  { name: 'corridor N', axis: 'z', v: -1.8, a0: -11.02, a1: 11.02, th: 0.12, h: 2.8,
    holes: [[-9.66, -8.56, 0, 2.2], [-5.06, -4.16, 0, 2.2], [-2.06, -1.16, 0, 2.2],
            [0.64, 1.64, 0, 2.2], [4.54, 5.54, 0, 2.2], [8.04, 9.04, 0, 2.2]] },
  { name: 'corridor S', axis: 'z', v: 0.4, a0: -11.02, a1: 11.02, th: 0.12, h: 2.8,
    holes: [[-9.36, -7.56, 0, 2.3], [7.24, 8.14, 0, 2.2]] },
  { name: 'kitchen divider', axis: 'x', v: -6.9, a0: 0.4, a1: 7.82, th: 0.12, h: 2.8,
    holes: [[3.06, 5.66, 0, 2.3]] },
  { name: 'feature wall', axis: 'x', v: -2.38, a0: 0.4, a1: 4.46, th: 0.12, h: 2.8, holes: [] },
  { name: 'living east wall', axis: 'x', v: 7.12, a0: 0.4, a1: 7.82, th: 0.12, h: 2.8,
    holes: [[5.0, 6.0, 0, 2.2]] },
  { name: 'utility divider', axis: 'z', v: 3.52, a0: 7.12, a1: 10.96, th: 0.12, h: 2.8,
    holes: [[8.62, 9.52, 0, 2.2]] },
  { name: 'master divider', axis: 'x', v: -5.72, a0: -7.96, a1: -1.86, th: 0.12, h: 2.8,
    holes: [[-6.8, -5.8, 0, 2.2], [-3.25, -2.35, 0, 2.2]] },
  { name: 'master|gbath', axis: 'x', v: -3.0, a0: -7.96, a1: -1.86, th: 0.12, h: 2.8, holes: [] },
  { name: 'gbath|bed2', axis: 'x', v: -0.28, a0: -7.96, a1: -1.86, th: 0.12, h: 2.8, holes: [] },
  { name: 'bed2|study', axis: 'x', v: 3.64, a0: -7.96, a1: -1.86, th: 0.12, h: 2.8, holes: [] },
  { name: 'study|bed3', axis: 'x', v: 7.16, a0: -7.96, a1: -1.86, th: 0.12, h: 2.8, holes: [] },
  { name: 'mbath|wardrobe', axis: 'z', v: -4.5, a0: -5.72, a1: -3.12, th: 0.12, h: 2.8, holes: [] },
  { name: 'west facade', axis: 'x', v: -11.08, a0: -8.2, a1: 8.0, th: 0.24, h: 2.8, holes: [] },
  { name: 'east facade', axis: 'x', v: 11.08, a0: -8.2, a1: 8.0, th: 0.24, h: 2.8, holes: [] },
];

// Things with no legitimate interior at all.
const VOIDS = [
  ['roof slab', -11.2, 11.2, 2.80, 3.04, -8.2, 8.0],
  ['terrace canopy', -10.2, 10.2, 2.82, 2.98, 8.0, 10.7],
  ['terrace slab', -10.2, 10.2, -0.08, 0.02, 8.0, 11.6],
  ['porch wall W', -1.88, -1.72, 0, 2.82, 8.0, 10.4],
  ['porch wall E', 0.82, 0.98, 0, 2.82, 8.0, 10.4],
  // The facades are already in WALLS, where their door and window openings are
  // known; listing them here as solid boxes would flag the camera for walking
  // through the front door.
];
const inBox = (b, x, y, z) => x > b[1] && x < b[2] && y > b[3] && y < b[4] && z > b[5] && z < b[6];
const inHole = (holes, along, y) => holes.some((h) => along > h[0] && along < h[1] && y > h[2] && y < h[3]);

let problems = 0;
const log = (...a) => console.log(...a);

log(`aspect ${aspect.toFixed(2)} -> plan distance ${D.toFixed(1)} m, plan lens ${PLAN_FOV} deg`);
log(`timeline runs 0 .. ${TOTAL}\n`);

const STEP = 0.002;
let crossings = 0;
let insideHouseFrom = null;

for (let t = 0; t <= TOTAL + 1e-9; t += STEP) {
  const x = px.at(t);
  const y = py.at(t);
  const z = pz.at(t);

  if (y < 0.15) {
    log(`!! t=${t.toFixed(3)} camera below ground (y=${y.toFixed(2)})`);
    problems++;
  }
  const inFoot = x > -11.2 && x < 11.2 && z > -8.2 && z < 8.0;
  if (inFoot && y < 2.8 && insideHouseFrom === null) insideHouseFrom = t;

  for (const v of VOIDS) {
    if (inBox(v, x, y, z)) {
      log(`!! t=${t.toFixed(3)} inside ${v[0]}`);
      problems++;
    }
  }

  // Inside a wall's thickness, the camera must be within an opening.
  for (const w of WALLS) {
    const along = w.axis === 'z' ? x : z;
    const across = w.axis === 'z' ? z : x;
    if (along < w.a0 || along > w.a1) continue;
    if (y < 0 || y > w.h) continue;
    if (Math.abs(across - w.v) > w.th / 2) continue;
    if (!inHole(w.holes, along, y)) {
      log(
        `!! t=${t.toFixed(3)} inside the solid part of ${w.name}` +
          ` (${w.axis}=${across.toFixed(2)} along=${along.toFixed(2)} y=${y.toFixed(2)})`
      );
      problems++;
    }
  }
}

// Report each wall crossing once, for the record.
for (const w of WALLS) {
  const get = w.axis === 'z' ? pz : px;
  const other = w.axis === 'z' ? px : pz;
  for (let t = 0; t <= TOTAL - STEP; t += STEP) {
    const a = get.at(t) - w.v;
    const b = get.at(t + STEP) - w.v;
    if (!(a * b <= 0) || a === b) continue;
    const along = other.at(t);
    const y = py.at(t);
    if (along < w.a0 || along > w.a1 || y <= 0 || y > w.h) continue;
    crossings++;
    log(`  crossing ${w.name} at t=${t.toFixed(3)}, through an opening`);
  }
}

log(`\n${crossings} wall crossings`);
if (insideHouseFrom === null) {
  log('!! the camera never gets inside the house');
  problems++;
} else {
  log(`enters the house at t=${insideHouseFrom.toFixed(3)}`);
}
log(problems === 0 ? '\nPASS' : `\nFAIL (${problems})`);
process.exit(problems === 0 ? 0 : 1);
