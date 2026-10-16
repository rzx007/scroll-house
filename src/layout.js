// SCHEME A — "横厅宅" (long bar house).
//
// All numbers are metres. X runs east (+), Z runs south (+), Y is up, so
// north is -Z. Every room size in the UI is derived from this file, so the
// dimensions on the drawing can never disagree with the geometry.
//
// Coordinates are wall CENTRELINES. Exterior walls are 0.24 thick, interior
// walls 0.12, so interior faces sit half a wall in from each centreline.
//
// Each room is its own reveal group: the material sweep that turns a room from
// drawing to render is driven per room, timed to when the camera walks in.
// Every wall and slab carries the group of whichever room reveals first from
// the camera's point of view, so nothing ever renders after you have already
// looked at it.

export const T = {
  EXT: 0.24,
  INT: 0.12,
  H: 2.8,
  SECTION: 1.2,
  EYE: 1.6,
};

const H = T.H;

// Wall helper: s is measured from the (x0,z0) end, along the wall.
const op = (s, w, y0, y1, kind) => ({ s, w, y0, y1, kind });

export const HOUSE = {
  // Outer envelope. Scheme A is 22.4 x 16.2 m, 362.9 m2.
  envelope: { x0: -11.2, x1: 11.2, z0: -8.2, z1: 8.0 },

  // Group ids. 'firstRoom' is the open south band, which reveals as one space
  // because it is one space; every other room reveals on its own.
  groups: {
    firstRoom: 'firstRoom',
  },

  rooms: [
    // --- north band: private (z -7.96 .. -1.86, 6.10 deep) ---
    { id: 'master', name: '主卧', x0: -10.96, x1: -5.84, z0: -7.96, z1: -1.86, floor: 'wood' },
    { id: 'mbath', name: '主卫', x0: -5.72, x1: -3.12, z0: -7.96, z1: -4.56, floor: 'tile' },
    { id: 'wardrobe', name: '衣帽间', x0: -5.72, x1: -3.12, z0: -4.44, z1: -1.86, floor: 'wood' },
    { id: 'gbath', name: '客卫', x0: -3.0, x1: -0.4, z0: -7.96, z1: -1.86, floor: 'tile' },
    { id: 'bed2', name: '次卧 1', x0: -0.28, x1: 3.52, z0: -7.96, z1: -1.86, floor: 'wood' },
    { id: 'study', name: '书房', x0: 3.64, x1: 7.04, z0: -7.96, z1: -1.86, floor: 'wood' },
    { id: 'bed3', name: '次卧 2', x0: 7.16, x1: 10.96, z0: -7.96, z1: -1.86, floor: 'wood' },
    // --- corridor ---
    { id: 'hall', name: '走廊', x0: -10.96, x1: 10.96, z0: -1.74, z1: 0.34, floor: 'wood' },
    // --- south band: public (z 0.46 .. 7.76, 7.30 deep) ---
    { id: 'kitchen', name: '开放厨房', x0: -10.96, x1: -6.96, z0: 0.46, z1: 7.76, floor: 'tile', group: 'firstRoom' },
    { id: 'dining', name: '餐厅', x0: -6.84, x1: -2.44, z0: 0.46, z1: 7.76, floor: 'wood', group: 'firstRoom' },
    { id: 'living', name: '起居横厅', x0: -2.32, x1: 7.06, z0: 0.46, z1: 7.76, floor: 'wood', group: 'firstRoom' },
    { id: 'utility', name: '家政', x0: 7.18, x1: 10.96, z0: 0.46, z1: 3.46, floor: 'tile' },
    { id: 'wc', name: '客卫', x0: 7.18, x1: 10.96, z0: 3.58, z1: 7.76, floor: 'tile' },
  ],

  // Terrace and entrance porch live outside the envelope.
  terrace: { x0: -10.2, x1: 10.2, z0: 8.0, z1: 11.6 },
  porch: { x0: -1.8, x1: 0.9, z0: 8.0, z1: 10.4 },
  canopy: { x0: -10.2, x1: 10.2, z0: 8.0, z1: 10.7, y0: 2.82, y1: 2.98 },

  walls: [
    // ============ exterior ============
    {
      id: 'south', x0: -11.08, z0: 7.88, x1: 11.08, z1: 7.88, t: T.EXT, group: 'firstRoom',
      openings: [
        op(1.48, 3.0, 0.9, 2.4, 'win'), // kitchen window
        op(4.48, 4.5, 0.15, 2.55, 'glazing'), // dining
        op(9.48, 2.3, 0.0, 2.4, 'door'), // entrance
        op(11.98, 6.5, 0.15, 2.55, 'glazing'), // living
        op(18.78, 2.0, 0.9, 2.4, 'win'),
      ],
    },
    {
      // The whole north facade is one object, so it can only reveal once. It is
      // given to the corridor, which the camera reaches before any bedroom, so
      // every bedroom already has a finished wall behind it.
      id: 'north', x0: -11.08, z0: -8.08, x1: 11.08, z1: -8.08, t: T.EXT, group: 'hall',
      openings: [
        op(1.08, 3.6, 0.8, 2.45, 'win'),
        op(5.5, 1.2, 1.4, 2.4, 'win'),
        op(8.2, 1.2, 1.4, 2.4, 'win'),
        op(12.0, 2.4, 0.8, 2.45, 'win'),
        op(15.2, 2.2, 0.8, 2.45, 'win'),
        op(18.4, 2.4, 0.8, 2.45, 'win'),
      ],
    },
    {
      id: 'west-n', x0: -11.08, z0: -8.08, x1: -11.08, z1: 0.0, t: T.EXT, group: 'master',
      openings: [op(0.6, 3.0, 0.8, 2.45, 'win')],
    },
    {
      id: 'west-s', x0: -11.08, z0: 0.0, x1: -11.08, z1: 7.88, t: T.EXT, group: 'firstRoom',
      openings: [op(1.92, 3.0, 0.9, 2.4, 'win')],
    },
    {
      id: 'east-n', x0: 11.08, z0: -8.08, x1: 11.08, z1: 0.0, t: T.EXT, group: 'bed3',
      openings: [op(0.6, 3.0, 0.8, 2.45, 'win')],
    },
    {
      id: 'east-s', x0: 11.08, z0: 0.0, x1: 11.08, z1: 7.88, t: T.EXT, group: 'utility',
      openings: [op(0.46, 2.2, 0.9, 2.4, 'win'), op(4.1, 2.6, 0.8, 2.45, 'win')],
    },

    // ============ corridor ============
    {
      id: 'hall-n', x0: -10.96, z0: -1.8, x1: 10.96, z1: -1.8, t: T.INT, group: 'hall',
      openings: [
        op(1.3, 1.1, 0, 2.2, 'door'),
        op(5.9, 0.9, 0, 2.2, 'door'),
        op(8.9, 0.9, 0, 2.2, 'door'),
        op(11.6, 1.0, 0, 2.2, 'door'),
        op(15.5, 1.0, 0, 2.2, 'door'),
        op(19.0, 1.0, 0, 2.2, 'door'),
      ],
    },
    {
      id: 'hall-s', x0: -10.96, z0: 0.4, x1: 10.96, z1: 0.4, t: T.INT, group: 'firstRoom',
      openings: [op(1.6, 1.8, 0, 2.3, 'pass'), op(18.2, 0.9, 0, 2.2, 'door')],
    },

    // ============ north band dividers ============
    {
      id: 'd-master', x0: -5.72, z0: -7.96, x1: -5.72, z1: -1.86, t: T.INT, group: 'master',
      openings: [op(1.16, 1.0, 0, 2.2, 'door'), op(4.71, 0.9, 0, 2.2, 'door')],
    },
    { id: 'd-bath', x0: -3.0, z0: -7.96, x1: -3.0, z1: -1.86, t: T.INT, group: 'master' },
    { id: 'd-bed2', x0: -0.28, z0: -7.96, x1: -0.28, z1: -1.86, t: T.INT, group: 'bed2' },
    { id: 'd-study', x0: 3.64, z0: -7.96, x1: 3.64, z1: -1.86, t: T.INT, group: 'study' },
    { id: 'd-bed3', x0: 7.16, z0: -7.96, x1: 7.16, z1: -1.86, t: T.INT, group: 'bed3' },
    { id: 'd-mbath', x0: -5.72, z0: -4.5, x1: -3.12, z1: -4.5, t: T.INT, group: 'mbath' },

    // ============ south band dividers ============
    {
      id: 'd-kitchen', x0: -6.9, z0: 0.46, x1: -6.9, z1: 7.76, t: T.INT, group: 'firstRoom',
      openings: [op(2.6, 2.6, 0, 2.3, 'pass')],
    },
    // partial feature wall between dining and living
    { id: 'd-feature', x0: -2.38, z0: 0.46, x1: -2.38, z1: 4.46, t: T.INT, group: 'firstRoom' },
    {
      id: 'd-living-e', x0: 7.12, z0: 0.46, x1: 7.12, z1: 7.76, t: T.INT, group: 'firstRoom',
      openings: [op(4.6, 1.0, 0, 2.2, 'door')],
    },
    {
      // door added between the utility room and the east bathroom, so the tour
      // can finish by re-entering the living room instead of backtracking
      id: 'd-utility', x0: 7.12, z0: 3.52, x1: 10.96, z1: 3.52, t: T.INT, group: 'utility',
      openings: [op(1.5, 0.9, 0, 2.2, 'door')],
    },

    // ============ entrance porch ============
    { id: 'porch-w', x0: -1.8, z0: 8.0, x1: -1.8, z1: 10.4, t: 0.16, h: 2.82, group: 'firstRoom' },
    { id: 'porch-e', x0: 0.9, z0: 8.0, x1: 0.9, z1: 10.4, t: 0.16, h: 2.82, group: 'firstRoom' },
  ],

  // Mullion spacing for the full-height glazing.
  mullionSpacing: 1.25,
};

// Slabs that are not walls. The roof sits ABOVE the per-room ceilings so it is
// never what you see from inside: ceilings reveal with their room, the roof
// just stays put and keeps the model closed from outside.
export const SLABS = [
  { id: 'roof', x0: -11.2, x1: 11.2, z0: -8.2, z1: 8.0, y0: 2.86, y1: 3.04, kind: 'roof', group: 'roof' },
  { id: 'canopy', x0: -10.2, x1: 10.2, z0: 8.0, z1: 10.7, y0: 2.82, y1: 2.98, kind: 'roof', group: 'firstRoom' },
  { id: 'terrace', x0: -10.2, x1: 10.2, z0: 8.0, z1: 11.6, y0: -0.08, y1: 0.02, kind: 'stone', group: 'firstRoom' },
];

// When each space turns from drawing to render, and the direction the sweep
// runs. The sweep always runs the way the camera enters, so material appears
// ahead of the viewer rather than around them. Origin is on the room's entry
// edge; len spans the room.
export const REVEALS = [
  // Phase 1: the open south band, revealed west to east on arrival.
  { group: 'firstRoom', a: 0.74, b: 1.0, origin: [-11.2, 0, 4.1], dir: [1, 0, 0], len: 22.4 },
  // Phase 2: the rest of the house, in the order the camera reaches it. Each
  // window opens a little before the camera crosses the threshold and closes
  // just after, so the material is always moving as you step in.
  { group: 'hall', a: 1.28, b: 1.42, origin: [-10.96, 0, -0.7], dir: [1, 0, 0], len: 21.92 },
  { group: 'master', a: 1.38, b: 1.52, origin: [-9.11, 0, -1.86], dir: [0, 0, -1], len: 6.1 },
  { group: 'mbath', a: 1.56, b: 1.66, origin: [-5.72, 0, -6.3], dir: [1, 0, 0], len: 2.6 },
  { group: 'wardrobe', a: 1.72, b: 1.8, origin: [-5.72, 0, -2.8], dir: [1, 0, 0], len: 2.6 },
  { group: 'gbath', a: 1.9, b: 2.0, origin: [-1.61, 0, -1.86], dir: [0, 0, -1], len: 6.1 },
  { group: 'bed2', a: 2.08, b: 2.2, origin: [1.14, 0, -1.86], dir: [0, 0, -1], len: 6.1 },
  { group: 'study', a: 2.3, b: 2.42, origin: [5.04, 0, -1.86], dir: [0, 0, -1], len: 6.1 },
  { group: 'bed3', a: 2.51, b: 2.63, origin: [8.54, 0, -1.86], dir: [0, 0, -1], len: 6.1 },
  { group: 'utility', a: 2.7, b: 2.8, origin: [7.69, 0, 0.46], dir: [0, 0, 1], len: 3.0 },
  { group: 'wc', a: 2.8, b: 2.9, origin: [9.07, 0, 3.58], dir: [0, 0, 1], len: 4.18 },
];

// Length of the whole page, in units of the Phase 1 arc (0..1). Everything in
// src/timeline.js shares this scale, so the section plane, the sky and the
// reveals all read the same keyframe numbers.
export const TOTAL = 3.02;

// Deterministic dimension string for the drawing labels.
export function dim(room) {
  const w = room.x1 - room.x0;
  const d = room.z1 - room.z0;
  return `${w.toFixed(2)} × ${d.toFixed(2)} m`;
}

export function area(room) {
  return (room.x1 - room.x0) * (room.z1 - room.z0);
}
