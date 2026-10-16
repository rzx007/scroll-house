// Procedural textures. Phase 1 ships zero binary assets: every map is drawn
// into a canvas at load time. Phase 2 swaps these for CC0 maps from ambientCG.
import * as THREE from 'three';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

// Deterministic hash noise so every reload looks the same.
function hash(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 144665;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, y, octaves, seed) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * f, y * f, seed + o * 17) * amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum;
}

export function makeWoodFloorTexture(size = 1024) {
  const c = canvas(size);
  const g = c.getContext('2d');
  // Neutral greige oak rather than a saturated orange. The warmth in the room
  // should come from the late sun, not from the timber.
  const rows = 6;
  const plankH = size / rows;
  g.fillStyle = '#b3a189';
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  const px = img.data;
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / plankH);
    const tone = 0.95 + hash(0, row, 7) * 0.1;
    const along = hash(row, 3, 11) * 300;
    for (let x = 0; x < size; x++) {
      // long grain streaks running along the plank
      const grain = fbm((x + along) * 0.012, row * 9 + y * 0.09, 4, 3);
      const streak = Math.sin((x + along) * 0.05 + grain * 8) * 0.5 + 0.5;
      let v = tone * (0.965 + grain * 0.07 - streak * 0.02);
      // seam between planks
      const dy = y - row * plankH;
      if (dy < 2 || dy > plankH - 2) v *= 0.8;
      const i = (y * size + x) * 4;
      px[i] = Math.min(255, 185 * v);
      px[i + 1] = Math.min(255, 166 * v);
      px[i + 2] = Math.min(255, 136 * v);
      px[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function makeStoneTileTexture(size = 1024) {
  const c = canvas(size);
  const g = c.getContext('2d');
  const tiles = 2;
  const t = size / tiles;
  g.fillStyle = '#cdc6b9';
  g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  const px = img.data;
  for (let y = 0; y < size; y++) {
    const ty = Math.floor(y / t);
    for (let x = 0; x < size; x++) {
      const tx = Math.floor(x / t);
      const tone = 0.93 + hash(tx, ty, 5) * 0.14;
      const mottle = fbm(x * 0.02, y * 0.02, 4, 23);
      let v = tone * (0.93 + mottle * 0.16);
      const dx = x - tx * t;
      const dy = y - ty * t;
      if (dx < 2 || dy < 2) v *= 0.82;
      const i = (y * size + x) * 4;
      px[i] = Math.min(255, 205 * v);
      px[i + 1] = Math.min(255, 198 * v);
      px[i + 2] = Math.min(255, 185 * v);
      px[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Grey-red fbm used by the reveal dissolve in the shader.
export function makeRevealNoiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x * 0.045, y * 0.045, 4, 91);
      const v = Math.max(0, Math.min(255, Math.round(n * 255)));
      const i = (y * size + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// Small equirectangular dusk sky, converted to a PMREM environment so the
// PBR materials have something to reflect. Phase 2 replaces this with a
// Poly Haven CC0 HDRI.
export function makeDuskSkyTexture() {
  const w = 512;
  const h = 256;
  const c = canvas(w);
  c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#20304a');
  grad.addColorStop(0.42, '#6d7e93');
  grad.addColorStop(0.52, '#e9a56b');
  // Below the horizon this is the ground bounce, and it is the only thing
  // lighting every down-facing surface indoors. Keep it light and neutral, or
  // every ceiling turns into a brown slab.
  grad.addColorStop(0.62, '#a8927a');
  grad.addColorStop(1.0, '#8c8377');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // low sun glow
  const sun = g.createRadialGradient(w * 0.72, h * 0.55, 4, w * 0.72, h * 0.55, w * 0.22);
  sun.addColorStop(0, 'rgba(255, 214, 160, 0.95)');
  sun.addColorStop(1, 'rgba(255, 180, 120, 0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
