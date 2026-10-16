// Monotone cubic (PCHIP) interpolation.
// Used for every scroll-driven track: camera position, target, fov,
// wall height, roof fade. PCHIP never overshoots its keyframes, so a
// value that must land exactly on a key (like the 1.20 m section frame)
// stays exactly there.

function tangents(x, y) {
  const n = x.length;
  if (n === 1) return [0];
  const h = new Array(n - 1);
  const d = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = x[i + 1] - x[i];
    d[i] = (y[i + 1] - y[i]) / h[i];
  }
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return m;
}

export class Track {
  constructor(keys) {
    this.x = [];
    this.y = [];
    this.m = [];
    if (keys) keys.forEach(([t, v]) => this.add(t, v));
    this._solve();
  }

  add(t, v) {
    this.x.push(t);
    this.y.push(v);
    this._dirty = true;
    return this;
  }

  _solve() {
    const order = this.x.map((t, i) => i).sort((a, b) => this.x[a] - this.x[b]);
    this.x = order.map((i) => this.x[i]);
    this.y = order.map((i) => this.y[i]);
    this.m = tangents(this.x, this.y);
    this._dirty = false;
  }

  at(t) {
    if (this._dirty) this._solve();
    const x = this.x;
    const y = this.y;
    const m = this.m;
    const n = x.length;
    if (n === 0) return 0;
    if (n === 1) return y[0];
    if (t <= x[0]) return y[0];
    if (t >= x[n - 1]) return y[n - 1];
    let i = 0;
    while (i < n - 2 && t > x[i + 1]) i++;
    const h = x[i + 1] - x[i];
    const s = (t - x[i]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (
      (2 * s3 - 3 * s2 + 1) * y[i] +
      (s3 - 2 * s2 + s) * h * m[i] +
      (-2 * s3 + 3 * s2) * y[i + 1] +
      (s3 - s2) * h * m[i + 1]
    );
  }
}

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function smoothstep(a, b, v) {
  const t = clamp01((v - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
}
