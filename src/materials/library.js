// Every surface in the house uses ONE material that can be either a flat
// paper drawing or a full PBR finish. A single uniform sweeps a noisy plane
// across the space, so a room materialises out of the drawing instead of
// cross-fading between two meshes.
import * as THREE from 'three';
import {
  makeWoodFloorTexture,
  makeStoneTileTexture,
  makeRevealNoiseTexture,
} from '../lib/textures.js';

// Paper colour, converted to linear because the mix happens before tone mapping.
const PAPER = new THREE.Color(0xf2eee5).convertSRGBToLinear();

const REVEAL_CHUNK = /* glsl */ `
varying vec3 vWPos;
uniform float uReveal;
uniform float uAlpha;
uniform float uLineAlpha;
uniform vec3 uSweepOrigin;
uniform vec3 uSweepDir;
uniform float uSweepLen;
uniform sampler2D uNoise;
uniform float uNoiseAmp;
uniform vec3 uPaper;
uniform float uPaperGrain;
uniform vec3 uKeyDir;
`;

const REVEAL_FN = /* glsl */ `
float vykorMask(vec3 p) {
  float d = dot(p - uSweepOrigin, uSweepDir) / uSweepLen;
  float n = texture2D(uNoise, p.xz * 0.06 + vec2(p.y * 0.11, 0.0)).r - 0.5;
  float n2 = texture2D(uNoise, p.zx * 0.21 + vec2(0.37, p.y * 0.05)).r - 0.5;
  float cut = uReveal * 1.42 - 0.21;
  return (cut - d) + (n * 0.72 + n2 * 0.28) * uNoiseAmp;
}
`;

const REVEAL_APPLY = /* glsl */ `
{
  float rm = vykorMask(vWPos);
  float k = smoothstep(-0.028, 0.028, rm);

  // The drawing state is not flat white: it is a white massing model. Shading
  // comes from the surface normal alone, so it carries no texture and no cast
  // shadow. Seen from overhead every face points up, so the sheet still reads
  // as a clean plan; the moment the camera tilts, walls gain direction.
  float nL = 0.5 + 0.5 * dot(normalize(normal), uKeyDir);
  float sky = 0.5 + 0.5 * normal.y;
  vec3 paperForm = uPaper * (0.54 + 0.60 * nL * (0.72 + 0.28 * sky));
  vec3 paper = mix(uPaper, paperForm, uPaperGrain);

  gl_FragColor.rgb = mix(paper, gl_FragColor.rgb, k);
  gl_FragColor.a = mix(uLineAlpha, gl_FragColor.a, k) * uAlpha;
}
`;

export class MaterialBank {
  constructor() {
    this.noise = makeRevealNoiseTexture();
    this.woodTex = makeWoodFloorTexture();
    this.stoneTex = makeStoneTileTexture();
    this.byGroup = { drawing: [], built: [] };
    this.mats = new Map();
    this.sweeps = new Map();
  }

  // groups: "drawing" = stays a line drawing for all of Phase 1.
  //         "firstRoom" = the south living band, revealed at the end.
  _register(key, groups, mat) {
    const list = Array.isArray(groups) ? groups : [groups];
    mat.userData.groups = list;
    mat.userData.uniforms = {
      uReveal: { value: 0 },
      uAlpha: { value: 1 },
      uLineAlpha: { value: 1 },
      // Deliberately inert defaults: sweep straight up over a kilometre, so a
      // material that is never given a sweep stays at uReveal = 0 and reads as
      // a drawing no matter where it sits in the world.
      uSweepOrigin: { value: new THREE.Vector3() },
      uSweepDir: { value: new THREE.Vector3(0, 1, 0) },
      uSweepLen: { value: 1000 },
      uNoise: { value: this.noise },
      uNoiseAmp: { value: 0.16 },
      uPaper: { value: PAPER.clone() },
      uPaperGrain: { value: 1 },
      uKeyDir: { value: new THREE.Vector3(-0.5, 0.22, 0.78) },
    };
    const u = mat.userData.uniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + REVEAL_CHUNK + REVEAL_FN)
        .replace(
          '#include <tonemapping_fragment>',
          REVEAL_APPLY + '\n#include <tonemapping_fragment>'
        );
    };
    mat.customProgramCacheKey = () => 'vykor-reveal';
    this.mats.set(key, mat);
    for (const g of new Set(list)) (this.byGroup[g] || (this.byGroup[g] = [])).push(mat);
    return mat;
  }

  // Simple flat PBR surface (a plain colour, no map).
  solid(kind, group, opts = {}) {
    const key = `${kind}::${group}`;
    if (this.mats.has(key)) return this.mats.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color: opts.color ?? 0xffffff,
      roughness: opts.roughness ?? 0.9,
      metalness: opts.metalness ?? 0,
      side: opts.side ?? THREE.FrontSide,
      transparent: !!opts.transparent,
      opacity: opts.opacity ?? 1,
      envMapIntensity: opts.envMapIntensity ?? 0.85,
    });
    if (opts.lineAlpha !== undefined) {
      this._register(key, group, mat);
      mat.userData.uniforms.uLineAlpha.value = opts.lineAlpha;
    } else {
      this._register(key, group, mat);
    }
    return mat;
  }

  // Floor with its own map instance so the tile repeat matches the room size.
  floor(kind, group, w, d) {
    const key = `${kind}::${group}::${w.toFixed(1)}x${d.toFixed(1)}`;
    if (this.mats.has(key)) return this.mats.get(key);
    const tex = (kind === 'tile' ? this.stoneTex : this.woodTex).clone();
    tex.needsUpdate = true;
    if (kind === 'tile') tex.repeat.set(w / 1.6, d / 1.6);
    else tex.repeat.set(Math.max(1, w / 4.4), Math.max(1, d / 4.4));
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: kind === 'wood' ? 0xffffff : 0xffffff,
      roughness: kind === 'tile' ? 0.42 : 0.62,
      metalness: 0,
      envMapIntensity: 0.7,
    });
    return this._register(key, group, mat);
  }

  glass(group) {
    const key = `glass::${group}`;
    if (this.mats.has(key)) return this.mats.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xbdd6e2,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1.4,
    });
    this._register(key, group, mat);
    mat.userData.uniforms.uLineAlpha.value = 0.08;
    return mat;
  }

  // Roof + ceiling are the same slab so the fade that reveals the interior
  // from above and the ceiling you sit under are one object.
  // The roof and the ceiling are one slab. It belongs to its room group so the
  // reveal sweep reaches it, and to the "roof" group so its fade can be driven
  // on its own while the camera drops.
  roofSlab(group) {
    const key = `roofslab::${group}`;
    if (this.mats.has(key)) return this.mats.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xefe9df,
      roughness: 0.94,
      metalness: 0,
      side: THREE.DoubleSide,
      envMapIntensity: 0.55,
    });
    this._register(key, [group, 'roof'], mat);
    return mat;
  }

  setSweep(group, origin, dir, len) {
    this.sweeps.set(group, { origin, dir, len });
    for (const m of this.byGroup[group] || []) {
      const u = m.userData.uniforms;
      u.uSweepOrigin.value.copy(origin);
      u.uSweepDir.value.copy(dir);
      u.uSweepLen.value = len;
    }
  }

  setReveal(group, v) {
    for (const m of this.byGroup[group] || []) m.userData.uniforms.uReveal.value = v;
  }

  setAlpha(group, v) {
    for (const m of this.byGroup[group] || []) m.userData.uniforms.uAlpha.value = v;
  }

  setPaperGrain(group, v) {
    for (const m of this.byGroup[group] || []) m.userData.uniforms.uPaperGrain.value = v;
  }

  // Direction the drawing is lit from, so the white model and the render agree.
  setKeyDir(dir) {
    for (const m of this.mats.values()) m.userData.uniforms.uKeyDir.value.copy(dir).normalize();
  }
}

// Line work: the black drawing lines are the real edges of the real geometry.
export class EdgeMaterialStore {
  constructor() {
    this.mats = new Map();
  }
  get(group, opacity = 0.88) {
    const key = `edge::${group}`;
    if (!this.mats.has(key)) {
      const mat = new THREE.LineBasicMaterial({
        color: 0x151311,
        transparent: true,
        opacity,
        depthWrite: true,
      });
      mat.userData = { group, baseOpacity: opacity };
      this.mats.set(key, mat);
    }
    return this.mats.get(key);
  }
  setOpacity(group, v) {
    const m = this.mats.get(`edge::${group}`);
    if (m) m.opacity = m.userData.baseOpacity * v;
  }
}
