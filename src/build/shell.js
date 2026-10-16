// Turns layout data into geometry.
//
// Each wall is one centreline. It is split into solid boxes around its
// openings. Every box gets three things: an edge-line overlay, a section
// cap, and the box itself.
//
//   - the edge lines are the real edges of the real geometry, so the
//     "drawing" is not a separate asset
//   - the cap is the dark fill a floor plan shows where a wall is cut; it
//     slides up with the cut plane and is what makes the flat state read
//     as a printed plan
import * as THREE from 'three';

const capMat = new THREE.MeshBasicMaterial({
  color: 0x38332b,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
});
const capEdgeMat = new THREE.LineBasicMaterial({
  color: 0x151311,
  transparent: true,
  opacity: 0.92,
});

const CEILING_OPTS = { color: 0xefeae0, roughness: 0.96, side: THREE.DoubleSide, envMapIntensity: 0.5 };

function boxMesh(w, h, d, mat, castShadow = true, receiveShadow = true) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

function lineOverlay(geo, mat) {
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 18), mat);
  lines.castShadow = false;
  lines.receiveShadow = false;
  return lines;
}

// Split one wall into solid runs plus its glazing.
function splitWall(wall) {
  const H = wall.h ?? 2.8;
  const horizontal = Math.abs(wall.z1 - wall.z0) < 1e-6;
  const lo = horizontal ? Math.min(wall.x0, wall.x1) : Math.min(wall.z0, wall.z1);
  const hi = horizontal ? Math.max(wall.x0, wall.x1) : Math.max(wall.z0, wall.z1);
  const fixed = horizontal ? wall.z0 : wall.x0;
  const total = hi - lo;

  const runs = [];
  const glass = [];
  const openings = (wall.openings || []).slice().sort((p, q) => p.s - q.s);

  let cursor = 0;
  for (const o of openings) {
    const s0 = Math.max(0, o.s);
    const s1 = Math.min(total, o.s + o.w);
    if (s1 <= s0) continue;
    if (s0 > cursor) runs.push({ a: cursor, b: s0, y0: 0, y1: H });
    if (o.y0 > 0.01) runs.push({ a: s0, b: s1, y0: 0, y1: o.y0 });
    if (o.y1 < H - 0.01) runs.push({ a: s0, b: s1, y0: o.y1, y1: H });
    if (o.kind === 'win' || o.kind === 'glazing') {
      glass.push({ a: s0, b: s1, y0: o.y0, y1: o.y1, kind: o.kind });
    }
    cursor = Math.max(cursor, s1);
  }
  if (cursor < total) runs.push({ a: cursor, b: total, y0: 0, y1: H });

  return { runs, glass, horizontal, lo, fixed, t: wall.t, total, H };
}

// Map a distance-along-the-wall to a world (x, z).
function alongXZ(info, along) {
  const p = info.lo + along;
  return info.horizontal ? { x: p, z: info.fixed } : { x: info.fixed, z: p };
}

export function buildShell(HOUSE, SLABS, bank, edges, clipPlanes) {
  const root = new THREE.Group();
  const capGroup = new THREE.Group();
  const caps = [];
  const glassMaterials = new Set();

  // Wall materials are per group like every other surface: a wall has to turn
  // from drawing to render on the clock of the room it belongs to, and a shared
  // material would freeze every room at once.
  const pickWall = (t, group) => {
    const ext = t > 0.2;
    return bank.solid(ext ? 'wallExt' : 'wallIn', group, {
      color: ext ? 0xd7ccba : 0xe9e2d6,
      roughness: ext ? 0.93 : 0.95,
      side: THREE.DoubleSide,
    });
  };

  const registerCap = (cx, cz, w, d, y0, y1) => {
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, capMat);
    mesh.position.set(cx, 0, cz);
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 18), capEdgeMat);
    line.position.set(cx, 0, cz);
    capGroup.add(mesh, line);
    caps.push({ y0, y1, mesh, line });
  };

  for (const wall of HOUSE.walls) {
    const info = splitWall(wall);
    const mat = pickWall(info.t, wall.group);
    const edgeMat = edges.get(wall.group);

    for (const r of info.runs) {
      const len = r.b - r.a;
      const hgt = r.y1 - r.y0;
      const c = alongXZ(info, (r.a + r.b) / 2);
      const w = info.horizontal ? len : info.t;
      const d = info.horizontal ? info.t : len;

      const mesh = boxMesh(w, hgt, d, mat);
      mesh.position.set(c.x, (r.y0 + r.y1) / 2, c.z);
      root.add(mesh);
      const lines = lineOverlay(mesh.geometry, edgeMat);
      lines.position.copy(mesh.position);
      root.add(lines);

      registerCap(c.x, c.z, w, d, r.y0, r.y1);
    }

    for (const g of info.glass) {
      const gm = bank.glass(wall.group);
      glassMaterials.add(gm);
      const len = g.b - g.a;
      const hgt = g.y1 - g.y0;
      const c = alongXZ(info, (g.a + g.b) / 2);

      const pane = boxMesh(
        info.horizontal ? len : 0.03,
        hgt,
        info.horizontal ? 0.03 : len,
        gm,
        false,
        false
      );
      pane.position.set(c.x, (g.y0 + g.y1) / 2, c.z);
      root.add(pane);
      const paneLines = lineOverlay(pane.geometry, edgeMat);
      paneLines.position.copy(pane.position);
      root.add(paneLines);

      if (g.kind !== 'glazing') continue;

      const frameMat = bank.solid('frame', wall.group, {
        color: 0x2b2723,
        roughness: 0.5,
        metalness: 0.4,
      });
      const n = Math.max(1, Math.round(len / (HOUSE.mullionSpacing || 1.25)));
      for (let i = 1; i < n; i++) {
        const cc = alongXZ(info, g.a + (len * i) / n);
        const bar = boxMesh(
          info.horizontal ? 0.05 : info.t * 0.7,
          hgt,
          info.horizontal ? info.t * 0.7 : 0.05,
          frameMat,
          false,
          false
        );
        bar.position.set(cc.x, (g.y0 + g.y1) / 2, cc.z);
        root.add(bar);
      }
      for (const rail of [{ y: g.y0 + 0.04, h: 0.08 }, { y: g.y1 - 0.04, h: 0.08 }]) {
        const railMesh = boxMesh(
          info.horizontal ? len : info.t * 0.7,
          rail.h,
          info.horizontal ? info.t * 0.7 : len,
          frameMat,
          false,
          false
        );
        railMesh.position.set(c.x, rail.y, c.z);
        root.add(railMesh);
      }
    }
  }

  // ---- floors and ceilings, one per room ----
  // The ceiling has to belong to its room, not to one roof slab over the whole
  // house: otherwise you stand in a bedroom and the ceiling above you never
  // renders. The roof above it stays put and keeps the model closed outside.
  const floorGroup = new THREE.Group();
  root.add(floorGroup);
  for (const room of HOUSE.rooms) {
    const g = room.group || room.id;
    const w = room.x1 - room.x0;
    const d = room.z1 - room.z0;
    const cx = (room.x0 + room.x1) / 2;
    const cz = (room.z0 + room.z1) / 2;
    const edgeMat = edges.get(g);

    const slab = boxMesh(w, 0.08, d, bank.floor(room.floor, g, w, d), false, true);
    slab.position.set(cx, -0.04, cz);
    floorGroup.add(slab);
    const slabLines = lineOverlay(slab.geometry, edgeMat);
    slabLines.position.copy(slab.position);
    floorGroup.add(slabLines);

    const ceil = boxMesh(w, 0.06, d, bank.solid('ceil', g, CEILING_OPTS), false, true);
    ceil.position.set(cx, 2.83, cz);
    floorGroup.add(ceil);
    const ceilLines = lineOverlay(ceil.geometry, edgeMat);
    ceilLines.position.copy(ceil.position);
    floorGroup.add(ceilLines);
  }

  // ---- slabs: roof, canopy, terrace ----
  for (const s of SLABS) {
    const w = s.x1 - s.x0;
    const d = s.z1 - s.z0;
    const h = s.y1 - s.y0;
    const isRoof = s.kind === 'roof';
    const mat = isRoof
      ? bank.roofSlab(s.group)
      : bank.solid('stone', s.group, { color: 0xb9b1a3, roughness: 0.78 });
    const mesh = boxMesh(w, h, d, mat, isRoof, true);
    mesh.position.set((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, (s.z0 + s.z1) / 2);
    root.add(mesh);
    const lines = lineOverlay(mesh.geometry, edges.get(isRoof ? 'roof' : s.group));
    lines.position.copy(mesh.position);
    root.add(lines);
  }

  // The section plane applies to walls, slabs, lines and floors. The caps are
  // exempt: they ride exactly on the plane.
  root.traverse((o) => {
    if (o.material && !o.material.clippingPlanes) {
      o.material.clippingPlanes = clipPlanes;
      o.material.clipShadows = true;
    }
  });

  return { root, capGroup, caps, glassMaterials };
}

// How far below the cut plane a box top may sit and still read as "below the
// cut" line work. Keeps window sills showing in plan.
export const CAP_EPS = 1e-4;
