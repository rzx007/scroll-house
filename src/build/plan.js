// The drawing layer: the sheet, the room annotations, and the sky that the
// sheet fades into as the camera drops toward the door.
import * as THREE from 'three';
import { makeDuskSkyTexture } from '../lib/textures.js';

const SHEET = 240; // metres; big enough that its far edge stays off screen
const TILE = 4; // metres per texture tile
const PAPER_COLOR = 0xf4f1e9;
const PAPER_LINE = '#cfc9bb';
const PAPER_LINE_MAJOR = '#b3ab99';

export function makePaperTexture(size = 1024) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  const step = size / TILE; // one metre
  g.strokeStyle = PAPER_LINE;
  g.lineWidth = 2;
  for (let i = 0; i <= TILE; i++) {
    const p = Math.round(i * step) + 0.5;
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, size);
    g.stroke();
    g.beginPath();
    g.moveTo(0, p);
    g.lineTo(size, p);
    g.stroke();
  }
  g.strokeStyle = PAPER_LINE_MAJOR;
  g.lineWidth = 4;
  g.strokeRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(SHEET / TILE, SHEET / TILE);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

export function createPaperGround() {
  const tex = makePaperTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.6,
  });
  // While the sheet is up the ground has to be unlit paper, or it reads as a
  // grey slab next to the flat-paper floors. uFlat blends it into the lighting
  // as the camera comes down and the site turns real.
  const uFlat = { value: 1 };
  const uPaper = { value: new THREE.Color(PAPER_COLOR).convertSRGBToLinear() };
  // Once the sheet goes, the ground has to stop reading as an infinite flat
  // plate. Two things do that: a lawn tone with slow variation instead of one
  // dead grey, and a fade toward a horizon colour with distance, which is what
  // actually sells depth outside a window.
  const uLawn = { value: new THREE.Color(0.60, 0.62, 0.50) };
  const uHorizon = { value: new THREE.Color(0.30, 0.29, 0.28) };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uFlat, uPaper, uLawn, uHorizon });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vGW;\nuniform float uFlat;\nuniform vec3 uPaper;\nuniform vec3 uLawn;\nuniform vec3 uHorizon;'
      )
      // The 1 m grid belongs to the drawing. As a site it becomes lawn.
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         {
           float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
           float vary = 0.94 + 0.12 * sin(vGW.x * 0.11) * sin(vGW.z * 0.09);
           vec3 ground = uLawn * lum * vary;
           diffuseColor.rgb = mix(ground, diffuseColor.rgb, uFlat);
         }`
      )
      .replace(
        '#include <tonemapping_fragment>',
        `{
           gl_FragColor.rgb = mix(gl_FragColor.rgb, diffuseColor.rgb * uPaper, uFlat);
           float far = smoothstep(26.0, 105.0, length(vGW.xz)) * (1.0 - uFlat);
           gl_FragColor.rgb = mix(gl_FragColor.rgb, uHorizon, far * 0.9);
         }
         #include <tonemapping_fragment>`
      );
  };
  mat.customProgramCacheKey = () => 'vykor-paper-ground';

  const geo = new THREE.PlaneGeometry(SHEET, SHEET);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.09;
  mesh.receiveShadow = true;
  return {
    mesh,
    mat,
    // 1 = white drafting sheet, 0 = lit site paving
    setPaper: (v) => {
      uFlat.value = v;
    },
  };
}

export function createSkyDome() {
  const tex = makeDuskSkyTexture();
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  const u = {
    uMix: { value: 0 },
    uPaperSky: { value: new THREE.Color(PAPER_COLOR).convertSRGBToLinear() },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkyPos;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvSkyPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vSkyPos;\nuniform float uMix;\nuniform vec3 uPaperSky;'
      )
      .replace(
        '#include <tonemapping_fragment>',
        'gl_FragColor.rgb = mix(uPaperSky, gl_FragColor.rgb, uMix);\n#include <tonemapping_fragment>'
      );
  };
  mat.customProgramCacheKey = () => 'vykor-sky';
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  mesh.renderOrder = -1000;
  return {
    mesh,
    setMix: (v) => (u.uMix.value = v),
    // Swap in the real environment map once it has loaded. The paper/dusk
    // blend keeps working, it just blends into a photograph instead of a
    // gradient.
    //
    // A Radiance HDR carries values well above 1 where the sky is bright, and
    // shown at full strength through tone mapping that region simply goes
    // white. Scaling the dome is how you keep colour in the sunset while the
    // same HDR still lights the room at full strength: the backdrop and the
    // light source are allowed to disagree, and that is what a photographer
    // would do anyway.
    setEnv(tex, brightness = 0.55) {
      mat.map = tex;
      mat.color.setScalar(brightness);
      mat.needsUpdate = true;
    },
  };
}

// Room annotation. Positions are projected to screen space every frame.
export class LabelLayer {
  constructor(container, entries) {
    this.container = container;
    this.items = entries.map((e) => {
      const el = document.createElement('div');
      el.className = 'plan-label' + (e.major ? ' is-major' : '');
      el.innerHTML =
        `<span class="plan-label__name">${e.name}</span>` +
        (e.dim ? `<span class="plan-label__dim">${e.dim}</span>` : '');
      container.appendChild(el);
      return { ...e, el };
    });
  }

  update(camera, width, height, opacity) {
    if (opacity <= 0.001) {
      if (this.container.style.opacity !== '0') this.container.style.opacity = '0';
      return;
    }
    this.container.style.opacity = String(opacity);
    const v = new THREE.Vector3();
    for (const it of this.items) {
      v.set(it.x, 0.02, it.z).project(camera);
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (-v.y * 0.5 + 0.5) * height;
      const visible = v.z < 1;
      it.el.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      it.el.style.visibility = visible ? 'visible' : 'hidden';
    }
  }
}

// A title block in the corner of the sheet, the way a drawing set has one.
export function createTitleBlock() {
  const el = document.createElement('div');
  el.className = 'title-block';
  el.innerHTML = `
    <div class="title-block__row"><span>项目</span><strong>一栋住宅</strong></div>
    <div class="title-block__row"><span>图名</span><strong>一层平面图</strong></div>
    <div class="title-block__row"><span>比例</span><strong>1:100</strong></div>
    <div class="title-block__row"><span>剖切</span><strong>+1.200</strong></div>`;
  return el;
}
