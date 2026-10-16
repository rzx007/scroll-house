// The section cut.
//
// One clipping plane rides up through the model and removes everything above
// it, which is how a floor plan is actually made: cut the building at 1.20 m
// and look down. The caps close every cut wall so you never see into a hollow
// box, and at 0.00 m they are what draws the wall poché of the sheet.
// A plane through a surface is a coin toss: fragments exactly on the cut give
// undefined results and you get banding across every floor slab, whose top face
// sits at y = 0. Lifting the cut by a few millimetres makes the test decisive.
const CLIP_EPS = 0.006;

export class SectionCut {
  constructor(capGroup, caps, clipPlanes) {
    this.capGroup = capGroup;
    this.caps = caps;
    this.plane = clipPlanes[0];
    this.set(0);
  }

  // clipY is the height of the cut: 0 -> 2.86, just above the 2.80 m walls so
  // nothing is cut once the house is whole.
  set(clipY) {
    this.plane.constant = clipY + CLIP_EPS;
    this.capGroup.position.y = clipY + CLIP_EPS;
    for (const c of this.caps) {
      const on = clipY >= c.y0 - 1e-4 && clipY <= c.y1 + 1e-4;
      c.mesh.visible = on;
      c.line.visible = on;
    }
  }
}

export class RevealController {
  constructor({ bank, edges, capGroup, caps, clipPlanes }) {
    this.bank = bank;
    this.edges = edges;
    this.cut = new SectionCut(capGroup, caps, clipPlanes);
  }

  setSection(clipY) {
    this.cut.set(clipY);
  }

  // alpha 1 = roof slab present, 0 = opened up so you can see the rooms
  setRoof(alpha) {
    this.bank.setAlpha('roof', alpha);
  }

  setRoofEdges(scale) {
    this.edges.setOpacity('roof', scale);
  }

  // 0 = pure drawing, 1 = full material
  setRoomReveal(group, v) {
    this.bank.setReveal(group, v);
  }

  // Line work never fully disappears: the drawing stays legible over the render.
  setRoomEdges(group, v) {
    this.edges.setOpacity(group, v);
  }
}
