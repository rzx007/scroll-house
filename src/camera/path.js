// One camera, one continuous path, no cuts.
//
// The plan is read straight down through a long lens, so it looks like an
// orthographic drawing. The camera stays LOCKED there for the whole wall-rise
// stage: the drawing has to stay fully framed while the walls grow out of it,
// so the only thing moving is the building. Descent starts after.
//
// Framing is done with DISTANCE, not with a wider lens. A portrait viewport
// needs a lot more room to hold a 22 m wide sheet, and widening the field of
// view to get it would destroy the orthographic look and then collide with the
// 55 deg cap. So the plan lens is fixed and the camera backs off instead; the
// overhead keyframes are derived from that distance.
//
// The whole descent happens in the YZ plane with the up vector fixed at
// (0,1,0). That is what keeps north at the top of the screen while the view is
// overhead: looking straight down, the world's -Z becomes the screen's up.
import * as THREE from 'three';
import { Track } from '../lib/interp.js';

const PLAN_FOV = 20; // the drafting lens: long enough to flatten the sheet
const PLAN_CENTER_Z = 1.7; // middle of the sheet's north-south extent
const DIST_MIN = 70;
const DIST_MAX = 170;
const OVERHEAD_UNTIL = 0.34;
const FOV_MAX = 55;

// t, position x/y/z, target x/y/z. Position y is absolute from the descent on;
// the overhead keys are rebuilt from the fitted distance.
const KEYS = [
  [0.0, 0, 0, 0, 0, 0.0, PLAN_CENTER_Z],
  [0.12, 0, 0, 0, 0, 0.0, PLAN_CENTER_Z],
  [0.34, 0, 0, 0, 0, 0.0, PLAN_CENTER_Z],
  // Pull SOUTH first, by a long way, before dropping. Getting 25 m of
  // horizontal offset before the descent means the house is seen from in front
  // as the elevation falls away, instead of the camera sinking through its own
  // roof and looking down into an open box.
  // While the camera is out in the open the aim sits at the middle of the
  // building, not at the door, or the house sinks to the bottom of the frame
  // with an empty sky above it. It drops to door height only at the end.
  [0.38, 0, 66, 26.0, 0, 1.8, 5.2],
  [0.42, 0, 48, 30.0, 0, 2.4, 6.2],
  [0.48, 0, 32, 30.0, 0, 2.7, 6.8],
  [0.54, 0, 18, 27.0, 0, 2.5, 7.3],
  [0.6, 0, 8, 21.0, 0, 2.0, 7.8],
  // End of descent: outside the terrace, just above eye height, facing the door.
  [0.65, 0, 3.2, 16.0, 0, 1.65, 8.0],
  [0.7, 0, 1.8, 12.5, 0, 1.55, 8.0],
  [0.78, 0, 1.62, 9.2, 0, 1.55, 4.0],
  [0.84, -0.3, 1.62, 6.0, 2.0, 1.5, 5.6],
  [0.92, -1.1, 1.62, 3.4, 4.4, 1.36, 6.2],
  // Arrival settles into the north-west of the room and looks south-east:
  // seating across the middle, the south glazing and the terrace beyond.
  [1.0, -1.6, 1.6, 1.4, 6.0, 1.3, 6.4],

  // ---- the rest of the house ----
  //
  // Discipline for every doorway: come to the centre of the opening, cross it
  // along the wall's normal, and only then turn. Crossing a jam at an angle is
  // what puts the camera inside a wall, and tools/verify-path.mjs fails the
  // build on exactly that.
  //
  // Rooms are visited by stepping in, dwelling, and backing out while still
  // facing into the room, so the reversal reads as a retreat rather than a
  // bounce. roomWardrobe and the two service spaces are small enough to take
  // from the threshold.
  [1.06, -1.9, 1.6, 2.8, 1.6, 1.35, 5.6],
  [1.1, -2.3, 1.6, 4.6, -4.0, 1.35, 4.8],
  [1.14, -3.4, 1.6, 5.2, -8.0, 1.32, 4.8], // round the end of the feature wall
  [1.18, -5.4, 1.6, 4.8, -9.6, 1.32, 4.4], // dining
  [1.22, -6.9, 1.6, 4.36, -10.2, 1.3, 4.0], // through the kitchen pass
  [1.27, -8.9, 1.6, 4.2, -9.6, 1.34, 2.0], // kitchen
  [1.31, -8.46, 1.6, 3.4, -8.46, 1.42, 0.6],
  [1.34, -8.46, 1.6, 1.4, -8.46, 1.45, -0.6],
  [1.37, -8.46, 1.6, 0.2, -8.46, 1.46, -1.2], // through the pass into the corridor
  [1.4, -8.6, 1.6, -0.9, -9.11, 1.48, -1.4],
  [1.43, -9.11, 1.6, -1.2, -9.11, 1.48, -3.0], // through the master door
  [1.47, -9.11, 1.6, -2.6, -8.4, 1.45, -5.2],
  [1.52, -8.9, 1.6, -4.6, -7.2, 1.42, -6.6], // master bedroom
  [1.57, -7.6, 1.6, -6.3, -6.0, 1.44, -6.3],
  [1.6, -6.6, 1.6, -6.3, -5.4, 1.45, -6.3],
  [1.62, -6.3, 1.6, -6.3, -5.0, 1.45, -6.35], // through into the ensuite
  [1.65, -5.0, 1.6, -6.3, -3.7, 1.45, -6.5], // ensuite
  // back out of the ensuite all the way into the master before turning south,
  // or the diagonal clips the middle of the dividing wall
  [1.68, -6.1, 1.6, -6.3, -6.1, 1.45, -3.2],
  [1.71, -6.1, 1.6, -4.4, -5.6, 1.45, -2.9],
  [1.74, -6.3, 1.6, -2.8, -4.8, 1.45, -2.8],
  [1.77, -5.2, 1.6, -2.8, -4.2, 1.45, -2.8], // through into the wardrobe
  [1.8, -4.4, 1.6, -2.8, -3.6, 1.45, -3.0], // wardrobe
  [1.83, -4.61, 1.6, -2.0, -4.61, 1.45, -0.8],
  [1.86, -4.61, 1.6, -1.6, -3.5, 1.48, -0.7], // back into the corridor
  [1.89, -3.8, 1.6, -0.7, 0.0, 1.48, -0.7],
  [1.93, -1.61, 1.6, -0.9, -1.61, 1.48, -2.4],
  [1.96, -1.61, 1.6, -1.55, -1.61, 1.46, -3.2], // through the guest bath door
  [1.99, -1.61, 1.6, -2.8, -1.2, 1.45, -4.6], // guest bathroom
  [2.02, -1.61, 1.6, -2.6, -1.61, 1.45, -1.2],
  [2.05, -1.61, 1.6, -1.55, -1.61, 1.47, -0.5], // back out
  [2.08, -1.0, 1.6, -0.7, 3.0, 1.48, -0.7],
  [2.12, 1.14, 1.6, -0.9, 1.14, 1.48, -2.4],
  [2.15, 1.14, 1.6, -1.55, 1.14, 1.46, -3.2], // through the bedroom 1 door
  [2.18, 1.14, 1.6, -2.8, 1.8, 1.45, -4.8], // bedroom 1
  [2.21, 1.6, 1.6, -5.0, 2.6, 1.42, -6.4],
  [2.24, 1.14, 1.6, -3.0, 1.14, 1.45, -1.2], // back out
  [2.27, 1.14, 1.6, -1.55, 1.4, 1.47, -0.6],
  [2.3, 2.4, 1.6, -0.7, 5.6, 1.48, -0.7],
  [2.33, 5.04, 1.6, -0.9, 5.04, 1.48, -2.4],
  [2.36, 5.04, 1.6, -1.55, 5.04, 1.46, -3.2], // through the study door
  [2.39, 5.04, 1.6, -2.8, 5.7, 1.45, -5.0], // study
  [2.42, 5.5, 1.6, -5.0, 6.5, 1.42, -6.4],
  [2.45, 5.04, 1.6, -3.0, 5.04, 1.45, -1.2], // back out
  [2.48, 5.04, 1.6, -1.55, 5.3, 1.47, -0.6],
  [2.51, 6.4, 1.6, -0.7, 8.6, 1.48, -0.7],
  [2.54, 8.54, 1.6, -0.9, 8.54, 1.48, -2.4],
  [2.57, 8.54, 1.6, -1.55, 8.54, 1.46, -3.2], // through the bedroom 2 door
  [2.6, 8.54, 1.6, -2.8, 9.2, 1.45, -5.0], // bedroom 2
  [2.63, 9.0, 1.6, -5.0, 9.9, 1.42, -6.4],
  [2.66, 8.54, 1.6, -3.0, 8.54, 1.45, -1.2], // back out
  [2.69, 8.54, 1.6, -1.55, 8.4, 1.47, -0.6],
  [2.72, 7.69, 1.6, -0.9, 7.69, 1.48, 1.0],
  [2.75, 7.69, 1.6, 0.6, 7.69, 1.46, 2.2], // through into the utility room
  [2.78, 7.9, 1.6, 2.4, 8.8, 1.45, 3.2],
  [2.81, 9.07, 1.6, 2.9, 9.07, 1.45, 4.6],
  [2.84, 9.07, 1.6, 3.35, 9.07, 1.45, 5.2], // through into the east bathroom
  [2.87, 9.07, 1.6, 4.6, 8.4, 1.44, 6.4],
  [2.9, 9.07, 1.6, 5.5, 7.4, 1.45, 5.5],
  [2.94, 7.2, 1.6, 5.5, 2.0, 1.46, 5.2], // through into the living room
  [2.98, 6.0, 1.6, 5.4, -1.5, 1.45, 5.0],
  // Closing frame: standing at the east end of the living room, looking back
  // down the whole 13.8 m open span. It arrives at 2.96 and holds to the end of
  // the page, so the last thing you see is a settled shot rather than a camera
  // that stops dead at the exact bottom of the scroll.
  [2.96, 6.4, 1.6, 5.2, -6.0, 1.45, 4.6],
];

// Field of view as a multiple of the plan lens, capped at eye level. It stays
// long while the camera is far out, so the house reads at scale, and opens as
// the camera closes on the door.
const FOV_MUL = [
  [0.0, 1.0],
  [0.34, 1.0],
  [0.42, 1.15],
  [0.48, 1.4],
  [0.54, 1.8],
  [0.6, 2.2],
  [0.65, 2.5],
  [0.7, 2.62],
  [0.78, 2.75],
  [1.0, 2.75],
];

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    camera.up.set(0, 1, 0);
    this.fovMul = new Track(FOV_MUL);
    this._tgt = new THREE.Vector3();
    this.lastFov = -1;
    this.planDistance = DIST_MIN;
    this._setDistance(DIST_MIN);
  }

  _setDistance(d) {
    this.planDistance = d;
    const keys = KEYS.map((k) =>
      k[0] <= OVERHEAD_UNTIL + 1e-9
        ? [k[0], k[1], d, PLAN_CENTER_Z + d * 0.012, k[4], k[5], k[6]]
        : k
    );
    const col = (i) => new Track(keys.map((k) => [k[0], k[i]]));
    this.px = col(1);
    this.py = col(2);
    this.pz = col(3);
    this.tx = col(4);
    this.ty = col(5);
    this.tz = col(6);
  }

  // How far back the sheet needs the camera for this viewport.
  fitPlan(bounds, aspect) {
    const halfW = (bounds.x1 - bounds.x0) / 2;
    const halfH = (bounds.z1 - bounds.z0) / 2;
    const pad = 1.14; // breathing room around the drawing
    const tanV = Math.tan((PLAN_FOV * Math.PI) / 360);
    const a = Math.max(0.25, aspect);
    const needed = Math.max((halfH * pad) / tanV, (halfW * pad) / (a * tanV));
    const d = Math.min(DIST_MAX, Math.max(DIST_MIN, needed));
    if (Math.abs(d - this.planDistance) > 0.5) this._setDistance(d);
    this.lastFov = -1;
    return d;
  }

  fovAt(t) {
    return Math.min(FOV_MAX, PLAN_FOV * this.fovMul.at(t));
  }

  apply(t) {
    const c = this.camera;
    c.position.set(this.px.at(t), this.py.at(t), this.pz.at(t));
    this._tgt.set(this.tx.at(t), this.ty.at(t), this.tz.at(t));
    const f = this.fovAt(t);
    if (Math.abs(f - this.lastFov) > 1e-4) {
      c.fov = f;
      c.updateProjectionMatrix();
      this.lastFov = f;
    }
    c.lookAt(this._tgt);
  }

  get target() {
    return this._tgt;
  }
}
