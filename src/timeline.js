// Every scroll-driven value, as keyframes.
//
// `t` is NOT normalised to 0..1. It runs 0..TOTAL, where 1.0 is the moment the
// camera arrives in the first room and everything past that is the rest of the
// house. Keeping one shared scale means the section plane, the sky, the room
// reveals and the camera path all quote the same numbers, and extending the
// page never means rescaling what already worked.
import { Track } from './lib/interp.js';
import { REVEALS, TOTAL } from './layout.js';

const tr = (keys) => new Track(keys);

export { TOTAL };

export const TIMELINE = {
  // Height of the section plane. It slows through 1.20 m: that is the frame
  // where the picture is exactly a printed floor plan. It then holds just under
  // the wall heads while the camera is still overhead, so the sheet stays a
  // readable plan, and only clears the roof once the camera has pulled out to
  // the south and started to tilt. The roof therefore arrives as the model
  // turns, rather than snapping over a plan you were still reading.
  section: tr([
    [0.0, 0.0],
    [0.12, 0.0],
    [0.17, 0.55],
    [0.215, 1.2],
    [0.26, 2.1],
    [0.34, 2.7],
    [0.44, 2.79],
    [0.5, 4.0],
    [TOTAL, 4.0],
  ]),

  // Latched on. The roof is an opaque slab controlled entirely by the cut
  // plane: an alpha-blended roof sorted into the transparent pass does not
  // reliably occlude the rooms behind it.
  roofAlpha: tr([
    [0.0, 1],
    [TOTAL, 1],
  ]),

  roofEdge: tr([
    [0.0, 1],
    [TOTAL, 1],
  ]),

  // 1 = white drafting sheet, 0 = lit site paving
  paper: tr([
    [0.0, 1],
    [0.34, 1],
    [0.6, 0],
    [TOTAL, 0],
  ]),

  // 0 = flat paper sky, 1 = dusk gradient
  sky: tr([
    [0.0, 0],
    [0.3, 0],
    [0.58, 1],
    [TOTAL, 1],
  ]),

  // Up from the first frame: the sheet is annotated the moment it appears.
  labels: tr([
    [0.0, 1],
    [0.3, 1],
    [0.42, 0],
    [TOTAL, 0],
  ]),
};

// One reveal track and one edge-fade track per space, built from REVEALS so
// the schedule lives in one place next to the room it belongs to.
export const REVEAL_TRACKS = REVEALS.map((r) => ({
  ...r,
  reveal: tr([
    [r.a, 0],
    [r.b, 1],
  ]),
  // Line work fades back as a room turns solid, but never disappears: the
  // drawing stays legible over the render.
  edge: tr([
    [r.a, 1],
    [r.b, 0.18],
  ]),
}));

export const CAPTIONS = [
  { a: 0.0, b: 0.12, n: '01', t: '图纸', s: '1.20 m 剖切 · 长焦垂直俯视' },
  { a: 0.12, b: 0.34, n: '02', t: '墙体升起', s: '镜头不动，墙从纸面长到 2.80 m' },
  { a: 0.34, b: 0.66, n: '03', t: '下降', s: '先退到南侧，俯角收平至入户门外' },
  { a: 0.66, b: 0.8, n: '04', t: '入户', s: '穿过门斗，降到人眼 1.60 m' },
  { a: 0.8, b: 1.06, n: '05', t: '起居横厅', s: '线稿被材质扫过' },
  { a: 1.06, b: 1.18, n: '06', t: '餐厅', s: '西行穿过开放的餐厅' },
  { a: 1.18, b: 1.32, n: '07', t: '开放厨房', s: '折向北，穿厨房进走廊' },
  { a: 1.32, b: 1.44, n: '08', t: '走廊', s: '21.9 m 的东西向通廊' },
  { a: 1.44, b: 1.86, n: '09', t: '主卧套', s: '主卧 · 主卫 · 衣帽间' },
  { a: 1.86, b: 2.1, n: '10', t: '客卫', s: '走廊北侧，回到通廊' },
  { a: 2.1, b: 2.31, n: '11', t: '次卧 1', s: '走廊北侧' },
  { a: 2.31, b: 2.52, n: '12', t: '书房', s: '走廊北侧' },
  { a: 2.52, b: 2.72, n: '13', t: '次卧 2', s: '走廊东端' },
  { a: 2.72, b: 2.95, n: '14', t: '家政 · 客卫', s: '东侧服务区' },
  { a: 2.95, b: 3.02, n: '15', t: '回到横厅', s: '从东端回望 13.8 m 开间' },
];
