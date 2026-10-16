// Parameterised furniture for the whole house.
//
// Everything is generated from primitives, which is the point: the furniture is
// part of the same model as the walls, so it appears on the drawing as its own
// footprint and takes part in the same reveal sweep as the room it stands in.
// Materials are fetched per room group, so a bedroom's bed turns from drawing to
// render on that bedroom's clock and not before.
//
// Pieces are authored head-on-the-north-wall unless a rotation is given, and
// every placement below is checked against the door swings in layout.js.
import * as THREE from 'three';

export function buildFurniture(bank, edges, clipPlanes) {
  const root = new THREE.Group();

  // One material set per room group. Cached by the bank, so this is just a
  // convenient way to ask for the same names every time.
  const sets = new Map();
  const M = (group) => {
    if (!sets.has(group)) {
      sets.set(group, {
        fabric: bank.solid('fabric', group, { color: 0x9d9385, roughness: 0.96 }),
        cushion: bank.solid('cushion', group, { color: 0xb4a999, roughness: 0.97 }),
        linen: bank.solid('linen', group, { color: 0xdad2c4, roughness: 0.98 }),
        bedding: bank.solid('bedding', group, { color: 0xe6dfd3, roughness: 0.99 }),
        towel: bank.solid('towel', group, { color: 0xd9d2c6, roughness: 1.0 }),
        wool: bank.solid('wool', group, { color: 0xbab0a1, roughness: 1.0 }),
        woodDark: bank.solid('woodDark', group, { color: 0x453527, roughness: 0.52 }),
        woodMid: bank.solid('woodMid', group, { color: 0x74593a, roughness: 0.55 }),
        brass: bank.solid('brass', group, { color: 0xb18d55, roughness: 0.32, metalness: 0.85 }),
        stoneTop: bank.solid('stoneTop', group, { color: 0x2f2d2a, roughness: 0.22 }),
        pale: bank.solid('paleStone', group, { color: 0xc9c2b5, roughness: 0.4 }),
        steel: bank.solid('steel', group, { color: 0x8e8b86, roughness: 0.35, metalness: 0.7 }),
        ceramic: bank.solid('ceramic', group, { color: 0xe6e0d5, roughness: 0.25 }),
        porcelain: bank.solid('porcelain', group, { color: 0xf2efe9, roughness: 0.14 }),
        glassPane: bank.solid('showerGlass', group, {
          color: 0xc6dae4, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.18,
        }),
        leaf: bank.solid('leaf', group, { color: 0x4c5c39, roughness: 0.85 }),
        pot: bank.solid('pot', group, { color: 0x3a3330, roughness: 0.7 }),
      });
    }
    return sets.get(group);
  };

  const edgeMat = (group) => edges.get(group);

  // A box with its drawing overlay. (x, y, z) is the centre.
  const box = (group, mat, x, y, z, w, h, d, opts = {}) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = true;
    if (opts.ry) mesh.rotation.y = opts.ry;
    if (opts.rx) mesh.rotation.x = opts.rx;
    root.add(mesh);
    if (opts.edges !== false) {
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 18), edgeMat(group));
      l.position.copy(mesh.position);
      l.rotation.copy(mesh.rotation);
      root.add(l);
    }
    return mesh;
  };

  // Group of pieces, so a rotated item is authored head-on then placed.
  const at = (group, x, z, ry = 0) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    root.add(g);
    const put = (mat, lx, y, lz, w, h, d, opts = {}) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(lx, y, lz);
      mesh.castShadow = opts.cast !== false;
      mesh.receiveShadow = true;
      g.add(mesh);
      if (opts.edges !== false) {
        const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 18), edgeMat(group));
        l.position.copy(mesh.position);
        g.add(l);
      }
      return mesh;
    };
    g.userData.put = put;
    return g;
  };

  // ---------------------------------------------------------------- pieces
  // Bed. Head sits at local -z, so the default has the head on a north wall.
  const bed = (group, x, z, w, d, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.woodDark, 0, 0.15, 0, w - 0.12, 0.3, d - 0.12, { cast: false });
    p(m.woodDark, 0, 0.62, -d / 2 + 0.06, w, 0.86, 0.12); // headboard
    p(m.bedding, 0, 0.44, 0.03, w - 0.16, 0.26, d - 0.2);
    p(m.bedding, 0, 0.62, d / 4, w - 0.12, 0.1, d * 0.5); // duvet folded to the foot
    p(m.pillow ?? m.bedding, -w / 4, 0.64, -d / 2 + 0.38, w * 0.42, 0.16, 0.34);
    p(m.bedding, w / 4, 0.64, -d / 2 + 0.38, w * 0.42, 0.16, 0.34);
    p(m.linen, 0, 0.68, d / 2 - 0.35, w - 0.3, 0.06, 0.7); // throw
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      p(m.woodMid, sx * (w / 2 - 0.16), 0.06, sz * (d / 2 - 0.16), 0.07, 0.12, 0.07, { edges: false });
    }
    return g;
  };

  const nightstand = (group, x, z, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.woodDark, 0, 0.26, 0, 0.48, 0.4, 0.42);
    p(m.brass, 0, 0.03, 0, 0.36, 0.06, 0.32, { edges: false });
    p(m.woodDark, 0, 0.48, 0, 0.52, 0.04, 0.46);
    p(m.ceramic, 0, 0.58, 0, 0.12, 0.16, 0.12);
    return g;
  };

  const wardrobe = (group, x, z, w, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    const bays = Math.max(2, Math.round(w / 0.75));
    p(m.woodMid, 0, 1.1, 0, w, 2.2, 0.62);
    for (let i = 1; i < bays; i++) {
      p(m.woodDark, -w / 2 + (w * i) / bays, 1.1, 0.32, 0.02, 2.1, 0.02, { edges: false });
    }
    p(m.brass, -w / 2 + w / (bays * 2), 1.15, 0.33, 0.03, 0.5, 0.03, { edges: false });
    p(m.brass, w / 2 - w / (bays * 2), 1.15, 0.33, 0.03, 0.5, 0.03, { edges: false });
    return g;
  };

  const sofa = (group, x, z, w, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    const d = 0.98;
    p(m.fabric, 0, 0.19, 0, w, 0.3, d);
    p(m.fabric, 0, 0.62, -d / 2 + 0.1, w, 0.62, 0.21);
    p(m.fabric, -w / 2 + 0.11, 0.42, 0, 0.21, 0.48, d);
    p(m.fabric, w / 2 - 0.11, 0.42, 0, 0.21, 0.48, d);
    const seats = Math.max(2, Math.round((w - 0.4) / 0.95));
    for (let i = 0; i < seats; i++) {
      p(m.cushion, -w / 2 + 0.22 + ((w - 0.44) * (i + 0.5)) / seats, 0.39, 0.04,
        (w - 0.48) / seats, 0.15, 0.86);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      p(m.woodDark, sx * (w / 2 - 0.16), 0.02, sz * (d / 2 - 0.16), 0.09, 0.04, 0.09, { edges: false });
    }
    return g;
  };

  const armchair = (group, x, z, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.fabric, 0, 0.2, 0, 0.78, 0.3, 0.78);
    p(m.fabric, 0, 0.56, -0.3, 0.78, 0.5, 0.18);
    p(m.fabric, -0.32, 0.36, 0, 0.14, 0.34, 0.78);
    p(m.fabric, 0.32, 0.36, 0, 0.14, 0.34, 0.78);
    p(m.cushion, 0, 0.38, 0.02, 0.6, 0.12, 0.66);
    return g;
  };

  const rug = (group, x, z, w, d, ry = 0) =>
    box(group, M(group).wool, x, 0.012, z, w, 0.024, d, { ry, cast: false });

  const table = (group, x, z, w, d, ry = 0, tall = false) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    const h = tall ? 0.92 : 0.75;
    p(m.woodDark, 0, h, 0, w, 0.06, d);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      p(m.woodDark, sx * (w / 2 - 0.12), h / 2, sz * (d / 2 - 0.12), 0.07, h, 0.07);
    }
    if (!tall) p(m.woodDark, 0, h * 0.35, 0, w - 0.5, 0.05, d - 0.24, { edges: false });
    return g;
  };

  const chair = (group, x, z, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.woodMid, 0, 0.44, 0, 0.46, 0.05, 0.46);
    p(m.woodMid, 0, 0.68, -0.2, 0.46, 0.44, 0.05);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      p(m.woodMid, sx * 0.18, 0.22, sz * 0.18, 0.04, 0.44, 0.04, { edges: false });
    }
    return g;
  };

  // Desk chair on a swivel base.
  const taskChair = (group, x, z, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.fabric, 0, 0.45, 0, 0.52, 0.09, 0.5);
    p(m.fabric, 0, 0.72, -0.21, 0.5, 0.5, 0.08);
    p(m.steel, 0, 0.3, 0, 0.07, 0.3, 0.07, { edges: false });
    for (const a of [0, 1, 2, 3, 4]) {
      const ang = (a / 5) * Math.PI * 2;
      p(m.steel, Math.cos(ang) * 0.2, 0.03, Math.sin(ang) * 0.2, 0.28, 0.03, 0.05,
        { edges: false });
    }
    return g;
  };

  const bookshelf = (group, x, z, w, h, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.woodDark, 0, h / 2, 0, w, h, 0.34);
    const shelves = Math.max(2, Math.round(h / 0.42));
    for (let i = 1; i < shelves; i++) {
      p(m.woodMid, 0, (h * i) / shelves, 0.16, w - 0.06, 0.03, 0.3, { edges: false });
    }
    return g;
  };

  const console_ = (group, x, z, w, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.woodDark, 0, 0.38, 0, w, 0.76, 0.42);
    p(m.brass, 0, 0.04, 0, w - 0.1, 0.08, 0.34, { edges: false });
    return g;
  };

  const dresser = (group, x, z, w, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.woodMid, 0, 0.42, 0, w, 0.84, 0.5);
    const drawers = Math.max(2, Math.round(w / 0.6));
    for (let i = 0; i < drawers; i++) {
      p(m.woodDark, -w / 2 + (w * (i + 0.5)) / drawers, 0.42, 0.26, (w / drawers) - 0.05, 0.24, 0.02,
        { edges: false });
    }
    p(m.ceramic, 0, 0.95, 0, 0.16, 0.22, 0.16);
    return g;
  };

  const planter = (group, x, z, s = 1) => {
    const m = M(group);
    const g = at(group, x, z);
    const p = g.userData.put;
    p(m.pot, 0, 0.26 * s, 0, 0.55 * s, 0.52 * s, 0.55 * s);
    for (const [lx, ly, h, tilt] of [[0.05, 0.85, 1.0, 0.35], [-0.1, 0.95, 1.2, -0.28],
                                     [0.12, 0.75, 0.9, 0.5], [-0.14, 1.05, 1.1, -0.5]]) {
      const leaf = p(m.leaf, lx * s, ly * s, 0.04 * s, 0.5 * s, h * s, 0.06, { cast: false });
      leaf.rotation.z = tilt;
      leaf.rotation.y = lx + 0.4;
    }
    return g;
  };

  // ---- bathroom pieces ----
  const vanity = (group, x, z, w, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.woodDark, 0, 0.4, 0, w, 0.72, 0.52);
    p(m.pale, 0, 0.79, 0, w + 0.04, 0.06, 0.56);
    for (const sx of [-1, 1]) {
      p(m.brass, sx * w * 0.24, 0.9, -0.08, 0.04, 0.22, 0.04, { edges: false });
      p(m.porcelain, sx * w * 0.24, 0.84, 0.02, 0.42, 0.11, 0.34);
    }
    p(m.pale, 0, 1.5, 0.24, w, 0.9, 0.05); // mirror
    p(m.brass, w / 2 - 0.06, 0.9, 0.3, 0.03, 0.3, 0.03, { edges: false });
    return g;
  };

  const wc = (group, x, z, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.porcelain, 0, 0.21, 0.06, 0.38, 0.42, 0.52);
    p(m.porcelain, 0, 0.42, 0.03, 0.4, 0.06, 0.5);
    p(m.porcelain, 0, 0.45, -0.24, 0.4, 0.5, 0.16);
    return g;
  };

  const shower = (group, x, z, w, d, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.pale, 0, 0.03, 0, w, 0.06, d);
    p(m.glassPane, -w / 2 + 0.01, 1.05, 0, 0.02, 2.1, d, { edges: false, cast: false });
    p(m.glassPane, 0, 1.05, d / 2 - 0.01, w, 2.1, 0.02, { edges: false, cast: false });
    p(m.brass, w / 2 - 0.12, 1.95, 0, 0.05, 0.05, 0.3, { edges: false });
    p(m.steel, w / 2 - 0.12, 2.1, 0.14, 0.22, 0.03, 0.22, { edges: false });
    return g;
  };

  const bathTub = (group, x, z, w, d, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.porcelain, 0, 0.29, 0, w, 0.56, d);
    p(m.glassPane, 0, 0.53, 0, w - 0.16, 0.06, d - 0.16, { edges: false, cast: false });
    p(m.brass, -w / 2 + 0.08, 0.62, 0, 0.04, 0.3, 0.04, { edges: false });
    p(m.towel, w / 2 + 0.14, 0.95, 0, 0.05, 0.7, 0.42, { edges: false });
    return g;
  };

  const shelves = (group, x, z, w, h, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.pale, 0, h / 2, 0, w, h, 0.36);
    const n = Math.max(2, Math.round(h / 0.4));
    for (let i = 1; i < n; i++) {
      p(m.towel, 0, (h * i) / n, 0.17, w - 0.08, 0.02, 0.3, { edges: false });
    }
    return g;
  };

  const appliances = (group, x, z, n, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.woodDark, 0, 0.86, 0, n * 0.62, 0.06, 0.64);
    for (let i = 0; i < n; i++) {
      const lx = -((n - 1) * 0.62) / 2 + i * 0.62;
      p(m.steel, lx, 0.43, 0, 0.58, 0.82, 0.6);
      p(m.glassPane, lx, 0.5, 0.31, 0.44, 0.42, 0.03, { edges: false, cast: false });
    }
    return g;
  };

  const island = (group, x, z, w, d, ry = 0) => {
    const m = M(group);
    const g = at(group, x, z, ry);
    const p = g.userData.put;
    p(m.woodDark, 0, 0.45, 0, w, 0.9, d);
    p(m.stoneTop, 0, 0.935, 0, w + 0.1, 0.07, d + 0.1);
    p(m.ceramic, 0, 1.0, 0, 0.3, 0.06, 0.2);
    return g;
  };

  // ------------------------------------------------------------ placements
  // South band (its own group, revealed as one space in Phase 1).
  {
    const g = 'firstRoom';
    const m = M(g);
    sofa(g, 3.0, 1.42, 3.05);
    rug(g, 3.0, 3.35, 4.8, 3.3);
    {
      const t = at(g, 3.0, 3.35);
      const p = t.userData.put;
      p(m.woodMid, 0, 0.36, 0, 1.6, 0.06, 0.8);
      p(m.brass, 0, 0.18, 0, 0.08, 0.36, 0.08);
      p(m.woodMid, 0, 0.02, 0, 1.4, 0.04, 0.62);
      p(m.ceramic, -0.42, 0.45, 0, 0.16, 0.12, 0.16);
      p(m.linen, 0.2, 0.42, 0.02, 0.42, 0.05, 0.3);
    }
    armchair(g, 5.55, 3.35, -Math.PI / 2);
    armchair(g, 0.55, 3.35, Math.PI / 2);
    {
      const t = at(g, 6.35, 1.2);
      const p = t.userData.put;
      p(m.stoneTop, 0, 0.5, 0, 0.44, 0.05, 0.44);
      p(m.brass, 0, 0.25, 0, 0.07, 0.5, 0.07);
      p(m.brass, 0, 0.02, 0, 0.3, 0.04, 0.3);
    }
    console_(g, -2.06, 2.5, 1.8);
    {
      const t = at(g, -4.64, 4.3);
      const p = t.userData.put;
      p(m.woodDark, 0, 0.74, 0, 2.8, 0.06, 1.1);
      p(m.woodDark, 0, 0.36, 0, 2.2, 0.05, 0.7, { edges: false });
      for (const sx of [-1.25, 1.25]) p(m.woodDark, sx, 0.37, 0, 0.08, 0.74, 0.9);
      p(m.ceramic, 0, 0.82, 0, 0.5, 0.1, 0.3);
    }
    for (let i = 0; i < 3; i++) {
      chair(g, -5.59 + i * 0.95, 3.48);
      chair(g, -5.59 + i * 0.95, 5.12, Math.PI);
    }
    chair(g, -3.02, 4.3, Math.PI / 2);
    island(g, -8.9, 4.0, 1.05, 3.0);
    planter(g, -2.0, 6.6);
    // terrace
    for (const lx of [2.3, 3.4]) {
      const l = at(g, lx, 9.5);
      const p = l.userData.put;
      p(m.woodMid, 0, 0.24, 0, 0.72, 0.08, 1.95);
      p(m.linen, 0, 0.33, 0.05, 0.66, 0.1, 1.8);
      const back = p(m.woodMid, 0, 0.5, -0.78, 0.72, 0.06, 0.62);
      back.rotation.x = -0.5;
    }
    {
      const t = at(g, 4.5, 9.5);
      const p = t.userData.put;
      p(m.woodDark, 0, 0.3, 0, 0.5, 0.06, 0.5);
      p(m.stoneTop, 0, 0.34, 0, 0.44, 0.03, 0.44, { edges: false });
    }
  }

  // Master bedroom. Door from the corridor is at x -9.66..-8.56 on z = -1.86,
  // so the whole south strip stays clear.
  {
    const g = 'master';
    rug(g, -8.4, -5.5, 3.6, 2.8);
    bed(g, -8.4, -6.75, 1.95, 2.15);
    nightstand(g, -9.75, -7.5);
    nightstand(g, -7.05, -7.5);
    console_(g, -8.4, -4.35, 1.6, 0); // bench at the foot
    dresser(g, -6.5, -3.4, 1.8, -Math.PI / 2);
    armchair(g, -10.2, -3.6, Math.PI * 0.75);
    planter(g, -9.9, -2.4, 0.85);
  }

  // Ensuite. Door from the master is at z -6.80..-5.80 on x = -5.72.
  {
    const g = 'mbath';
    vanity(g, -4.42, -7.6, 1.8, 0);
    bathTub(g, -4.95, -5.2, 1.5, 0.75);
    shower(g, -3.75, -6.9, 1.2, 1.6);
    wc(g, -5.35, -7.5, Math.PI);
  }

  // Walk-in wardrobe: doors from the master (x = -5.72) and the corridor
  // (z = -1.86), so the middle is circulation and the runs hug the far walls.
  {
    const g = 'wardrobe';
    wardrobe(g, -4.2, -4.05, 2.4, 0);
    wardrobe(g, -3.5, -3.0, 2.0, -Math.PI / 2);
    island(g, -4.6, -3.1, 0.7, 1.0);
    console_(g, -4.9, -2.2, 1.2);
  }

  // Guest bathroom: 6.1 m deep, door at x -2.06..-1.16 on z = -1.86.
  {
    const g = 'gbath';
    vanity(g, -1.15, -7.6, 1.7, 0);
    wc(g, -2.5, -7.4, Math.PI);
    shower(g, -0.9, -5.4, 1.0, 1.5);
    shelves(g, -2.6, -4.2, 0.8, 1.8, Math.PI / 2);
  }

  // Bedroom 1. Door at x 0.64..1.64 on z = -1.86.
  {
    const g = 'bed2';
    rug(g, 1.6, -5.4, 3.0, 2.4);
    bed(g, 1.6, -6.6, 1.6, 2.05);
    nightstand(g, 0.6, -7.4);
    wardrobe(g, 3.1, -6.0, 2.4, -Math.PI / 2);
    table(g, -0.02, -3.4, 1.3, 0.6, Math.PI / 2);
    chair(g, 0.62, -3.4, -Math.PI / 2);
    planter(g, 3.0, -2.6, 0.8);
  }

  // Study. Door at x 4.54..5.54 on z = -1.86.
  {
    const g = 'study';
    rug(g, 5.3, -5.0, 2.6, 2.2);
    table(g, 5.3, -6.3, 1.8, 0.8);
    taskChair(g, 5.3, -5.3, Math.PI);
    bookshelf(g, 6.75, -4.4, 2.6, 2.2, -Math.PI / 2);
    armchair(g, 4.2, -3.1, Math.PI * 0.85);
    planter(g, 6.7, -2.6, 0.8);
  }

  // Bedroom 2. Door at x 8.04..9.04 on z = -1.86.
  {
    const g = 'bed3';
    rug(g, 9.05, -5.4, 3.0, 2.4);
    bed(g, 9.05, -6.6, 1.6, 2.05);
    nightstand(g, 8.05, -7.4);
    wardrobe(g, 7.6, -6.0, 2.2, Math.PI / 2);
    dresser(g, 10.4, -3.6, 1.6, -Math.PI / 2);
    planter(g, 7.8, -2.6, 0.8);
  }

  // Utility. Doors from the corridor (z = 0.46) and to the east bathroom.
  {
    const g = 'utility';
    appliances(g, 8.4, 0.95, 3);
    shelves(g, 10.4, 1.9, 1.6, 2.1, -Math.PI / 2);
    island(g, 9.0, 2.6, 1.2, 0.7);
  }

  // East bathroom. Doors from the utility and from the living room.
  {
    const g = 'wc';
    vanity(g, 7.9, 6.9, 1.7, 0);
    wc(g, 10.4, 6.9, Math.PI);
    shower(g, 10.2, 4.6, 1.4, 1.5);
    shelves(g, 8.2, 4.1, 0.9, 1.6, Math.PI);
  }

  // Corridor: only what furniture can be walked past.
  {
    const g = 'hall';
    console_(g, -7.6, -1.55, 1.2);
    console_(g, 3.0, -1.55, 1.2);
    rug(g, -2.4, -0.7, 3.6, 1.2);
  }

  root.traverse((o) => {
    if (o.material && !o.material.clippingPlanes) {
      o.material.clippingPlanes = clipPlanes;
      o.material.clipShadows = true;
    }
  });

  return root;
}
