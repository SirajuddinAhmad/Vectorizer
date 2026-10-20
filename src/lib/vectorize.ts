/* ============================================================
   VEKTORA tracing engine
   Raster → Quantize → Marching-squares contours →
   Douglas-Peucker simplify → adaptive Catmull-Rom Bézier smoothing
   ============================================================ */

export type VecMode = 'color' | 'mono';

export interface VecOptions {
  mode: VecMode;
  colors: number;       // 2..16 palette size (color mode)
  blur: number;         // 0..100 → gaussian pre-filter radius
  detail: number;       // 0..100 → inverse of simplify tolerance
  smoothness: number;   // 0..100 → catmull-rom tension
  cornerSharp: number;  // 0..100 → corner keep angle
  threshold: number;    // 0..255 (mono mode)
  invert: boolean;
  ink: string;          // mono fill color
  removeBg: boolean;    // drop detected background layer (color mode)
}

export interface VecLayer {
  color: string;
  d: string;
  area: number;
  segments: number;
  loops: number;
}

export interface VecResult {
  svg: string;
  width: number;
  height: number;
  traceWidth: number;
  traceHeight: number;
  layers: VecLayer[];
  palette: string[];
  pathCount: number;
  nodeCount: number;
  bytes: number;
  bgRemoved: boolean;
}

export type StageFn = (stage: string | null) => void;

const MAX_TRACE_DIM = 780;
const tick = () => new Promise<void>((r) => setTimeout(r, 16));

/* ------------------------------------------------------------
   1 · Rasterize (with optional gaussian pre-blur via canvas)
------------------------------------------------------------ */
interface RGB { r: number; g: number; b: number }

function rasterize(img: HTMLImageElement, blurPx: number) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.min(1, MAX_TRACE_DIM / Math.max(iw, ih));
  const w = Math.max(2, Math.round(iw * scale));
  const h = Math.max(2, Math.round(ih * scale));

  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  if (blurPx > 0.05 && 'filter' in ctx) {
    const pad = Math.ceil(blurPx * 3) + 2;
    const tmp = document.createElement('canvas');
    tmp.width = w + pad * 2; tmp.height = h + pad * 2;
    const tctx = tmp.getContext('2d')!;
    tctx.drawImage(img, pad, pad, w, h);
    // wrap edges so the blur doesn't darken the frame
    tctx.drawImage(tmp, -w + pad, pad, w, h);
    tctx.drawImage(tmp, pad, -h + pad, w, h);
    ctx.filter = `blur(${blurPx.toFixed(2)}px)`;
    ctx.drawImage(tmp, -pad, -pad);
    ctx.filter = 'none';
  } else {
    ctx.drawImage(img, 0, 0, w, h);
  }
  return { w, h, data: ctx.getImageData(0, 0, w, h).data };
}

/* ------------------------------------------------------------
   2 · Median-cut color quantization
------------------------------------------------------------ */
export function medianCutPalette(data: Uint8ClampedArray, k: number): RGB[] {
  const n = data.length / 4;
  const stride = Math.max(1, Math.floor(n / 14000));
  const px: RGB[] = [];
  for (let i = 0; i < n; i += stride) {
    const o = i * 4;
    px.push({ r: data[o], g: data[o + 1], b: data[o + 2] });
  }
  if (px.length === 0) return [{ r: 128, g: 128, b: 128 }];

  const boxes: RGB[][] = [px];
  while (boxes.length < k) {
    let best = -1, bestRange = 0, bestChan: keyof RGB = 'r';
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.length < 2) continue;
      let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
      for (const p of box) {
        if (p.r < rMin) rMin = p.r; if (p.r > rMax) rMax = p.r;
        if (p.g < gMin) gMin = p.g; if (p.g > gMax) gMax = p.g;
        if (p.b < bMin) bMin = p.b; if (p.b > bMax) bMax = p.b;
      }
      const ranges: [keyof RGB, number][] = [['r', rMax - rMin], ['g', gMax - gMin], ['b', bMax - bMin]];
      ranges.sort((a, b) => b[1] - a[1]);
      if (ranges[0][1] > bestRange) { bestRange = ranges[0][1]; best = i; bestChan = ranges[0][0]; }
    }
    if (best < 0 || bestRange <= 0) break;
    const box = boxes[best].sort((a, b) => a[bestChan] - b[bestChan]);
    const mid = box.length >> 1;
    if (mid === 0) break;
    boxes.splice(best, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.filter((b) => b.length > 0).map((box) => {
    let r = 0, g = 0, b = 0;
    for (const p of box) { r += p.r; g += p.g; b += p.b; }
    return { r: Math.round(r / box.length), g: Math.round(g / box.length), b: Math.round(b / box.length) };
  });
}

function labelImage(data: Uint8ClampedArray, palette: RGB[]): Int16Array {
  const n = data.length / 4;
  const labels = new Int16Array(n);
  const K = palette.length;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    let bi = 0, bd = Infinity;
    for (let k2 = 0; k2 < K; k2++) {
      const p = palette[k2];
      const dr = r - p.r, dg = g - p.g, db = b - p.b;
      const d = dr * dr * 0.9 + dg * dg * 1.2 + db * db;
      if (d < bd) { bd = d; bi = k2; }
    }
    labels[i] = bi;
  }
  return labels;
}

/* ------------------------------------------------------------
   3 · Marching-squares contour extraction
------------------------------------------------------------ */
type Pt = [number, number];

// edge point IDs: N, E, S, W (cell edge midpoints, doubled coords)
const SEGS: Record<number, [string, string][]> = {
  1: [['W', 'N']], 2: [['N', 'E']], 3: [['W', 'E']],
  4: [['E', 'S']], 5: [['W', 'N'], ['E', 'S']], 6: [['N', 'S']],
  7: [['W', 'S']], 8: [['W', 'S']], 9: [['N', 'S']],
  10: [['N', 'E'], ['W', 'S']], 11: [['E', 'S']], 12: [['W', 'E']],
  13: [['N', 'E']], 14: [['W', 'N']],
};

function shoelace(pts: Pt[]): number {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function traceMask(mask: Uint8Array, w: number, h: number): { pts: Pt[]; area: number }[] {
  const XW = (w + 2) * 2 + 2;
  const adj = new Map<number, number[]>();
  const pushAdj = (a: number, b: number) => {
    let l = adj.get(a); if (!l) { l = []; adj.set(a, l); } l.push(b);
  };
  const at = (x: number, y: number) =>
    x >= 0 && x < w && y >= 0 && y < h ? mask[y * w + x] : 0;
  const ptOf = (id: string, x: number, y: number): Pt =>
    id === 'N' ? [2 * x + 3, 2 * y + 2]
      : id === 'E' ? [2 * x + 4, 2 * y + 3]
        : id === 'S' ? [2 * x + 3, 2 * y + 4]
          : [2 * x + 2, 2 * y + 3]; // W

  // cells x,y in [-1 .. w-1] so shapes touching the frame close properly
  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const c =
        (at(x, y) ? 1 : 0) | (at(x + 1, y) ? 2 : 0) |
        (at(x + 1, y + 1) ? 4 : 0) | (at(x, y + 1) ? 8 : 0);
      if (c === 0 || c === 15) continue;
      for (const [p, q] of SEGS[c]) {
        const A = ptOf(p, x, y), B = ptOf(q, x, y);
        const ka = A[1] * XW + A[0], kb = B[1] * XW + B[0];
        pushAdj(ka, kb); pushAdj(kb, ka);
      }
    }
  }

  const loops: { pts: Pt[]; area: number }[] = [];
  for (const [start, list] of adj) {
    while (list.length > 0) {
      const chain: number[] = [start];
      let cur = start;
      let closed = false;
      for (let guard = 0; guard < 2_000_000; guard++) {
        const nbrs = adj.get(cur);
        if (!nbrs || nbrs.length === 0) break;
        const next = nbrs.pop()!;
        const back = adj.get(next)!;
        const bi = back.indexOf(cur);
        if (bi >= 0) back.splice(bi, 1);
        if (next === start) { closed = true; break; }
        chain.push(next);
        cur = next;
      }
      if (!closed || chain.length < 3) continue;
      // +0.5 align: sample points sit on pixel centers, so contours hug pixel footprints exactly
      const pts = chain.map((k2) => [((k2 % XW) - 1) / 2, (Math.floor(k2 / XW) - 1) / 2] as Pt);
      loops.push({ pts, area: shoelace(pts) });
    }
  }
  return loops;
}

/* ------------------------------------------------------------
   4 · Douglas-Peucker simplification (closed loops)
------------------------------------------------------------ */
function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / Math.sqrt(len2);
}

function simplifyLoop(pts: Pt[], tol: number): Pt[] {
  const n = pts.length;
  if (n <= 6 || tol <= 0.01) return pts;
  let anchor = 0;
  for (let i = 1; i < n; i++)
    if (pts[i][0] > pts[anchor][0] || (pts[i][0] === pts[anchor][0] && pts[i][1] > pts[anchor][1])) anchor = i;
  const rot = pts.slice(anchor).concat(pts.slice(0, anchor));
  rot.push(rot[0]);
  const keep = new Array(rot.length).fill(false);
  keep[0] = keep[rot.length - 1] = true;
  const stack: [number, number][] = [[0, rot.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop()!;
    let dmax = 0, idx = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const d = perpDist(rot[i], rot[i0], rot[i1]);
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax > tol && idx > 0) { keep[idx] = true; stack.push([i0, idx], [idx, i1]); }
  }
  const out = rot.filter((_, i) => keep[i]);
  out.pop();
  return out.length >= 3 ? out : pts;
}

/* ------------------------------------------------------------
   5 · Adaptive corner detection + Catmull-Rom Bézier smoothing
------------------------------------------------------------ */
function cornerFlags(pts: Pt[], thrDeg: number): boolean[] {
  const n = pts.length;
  const flags = new Array<boolean>(n).fill(false);
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], p = pts[i], b = pts[(i + 1) % n];
    const v1x = a[0] - p[0], v1y = a[1] - p[1];
    const v2x = b[0] - p[0], v2y = b[1] - p[1];
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    if (l1 < 1e-6 || l2 < 1e-6) { flags[i] = true; continue; }
    let cos = (v1x * v2x + v1y * v2y) / (l1 * l2);
    cos = Math.max(-1, Math.min(1, cos));
    const ang = (Math.acos(cos) * 180) / Math.PI;
    flags[i] = ang < thrDeg;
  }
  return flags;
}

const f = (v: number) => {
  const r = Math.round(v);
  return Math.abs(v - r) < 0.05 ? String(r) : v.toFixed(1);
};

function loopToPath(pts: Pt[], corners: boolean[], t: number): string {
  const n = pts.length;
  const parts: string[] = [`M${f(pts[0][0])} ${f(pts[0][1])}`];
  if (t <= 0.01) {
    for (let i = 1; i < n; i++) parts.push(`L${f(pts[i][0])} ${f(pts[i][1])}`);
    parts.push('Z');
    return parts.join(' ');
  }
  const k = t / 6;
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[i1], p3 = pts[(i + 2) % n];
    const c1x = corners[i] ? p1[0] : p1[0] + (p2[0] - p0[0]) * k;
    const c1y = corners[i] ? p1[1] : p1[1] + (p2[1] - p0[1]) * k;
    const c2x = corners[i1] ? p2[0] : p2[0] - (p3[0] - p1[0]) * k;
    const c2y = corners[i1] ? p2[1] : p2[1] - (p3[1] - p1[1]) * k;
    parts.push(`C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/* ------------------------------------------------------------
   Main pipeline
------------------------------------------------------------ */
const hex = (p: RGB) =>
  '#' + [p.r, p.g, p.b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');

export async function vectorizeImage(
  img: HTMLImageElement,
  opts: VecOptions,
  onStage?: StageFn,
): Promise<VecResult> {
  const stage = onStage ?? (() => {});
  stage('PRE-FILTER · GAUSSIAN');
  await tick();
  const blurPx = (opts.blur / 100) * 3.5;
  const { w, h, data } = rasterize(img, blurPx);

  stage(opts.mode === 'color' ? 'QUANTIZE · MEDIAN-CUT' : 'QUANTIZE · LUMINANCE');
  await tick();

  let specs: { color: string; mask: Uint8Array }[] = [];
  let bgRemoved = false;
  const npix = w * h;

  if (opts.mode === 'mono') {
    const mask = new Uint8Array(npix);
    for (let i = 0; i < npix; i++) {
      const o = i * 4;
      const g = data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114;
      const on = opts.invert ? g >= opts.threshold : g < opts.threshold;
      mask[i] = on ? 1 : 0;
    }
    specs = [{ color: opts.ink, mask }];
  } else {
    const palette = medianCutPalette(data, opts.colors);
    const labels = labelImage(data, palette);
    let bgIdx = -1;
    if (opts.removeBg) {
      const cornerLabels = [labels[0], labels[w - 1], labels[(h - 1) * w], labels[npix - 1]];
      const counts = new Map<number, number>();
      for (const c of cornerLabels) counts.set(c, (counts.get(c) ?? 0) + 1);
      let best = -1, bestN = 1;
      for (const [k2, v] of counts) if (v > bestN) { bestN = v; best = k2; }
      bgIdx = best;
    }
    for (let c = 0; c < palette.length; c++) {
      if (c === bgIdx) { bgRemoved = true; continue; }
      const mask = new Uint8Array(npix);
      for (let i = 0; i < npix; i++) mask[i] = labels[i] === c ? 1 : 0;
      specs.push({ color: hex(palette[c]), mask });
    }
    if (specs.length === 0) specs = [{ color: hex(palette[0]), mask: new Uint8Array(npix).fill(1) }];
  }

  // mapped parameters
  const tol = Math.pow((101 - opts.detail) / 100, 2) * 2.8 + 0.02;
  const minArea = Math.pow((101 - opts.detail) / 100, 2) * 36 + 0.5;
  const thrDeg = 45 + (opts.cornerSharp / 100) * 120;
  const tension = opts.smoothness / 100;

  stage('TRACE · MARCHING SQUARES');
  await tick();
  const traced = specs.map((s) => ({ spec: s, loops: traceMask(s.mask, w, h) }));

  stage('SMOOTH · CATMULL-ROM');
  await tick();
  const layers: VecLayer[] = [];
  let nodeCount = 0, pathCount = 0;
  for (const { spec, loops } of traced) {
    const dParts: string[] = [];
    let area = 0, segments = 0, loopN = 0;
    for (const loop of loops) {
      if (Math.abs(loop.area) < minArea || loop.pts.length < 3) continue;
      area += Math.abs(loop.area);
      const simple = simplifyLoop(loop.pts, tol);
      const crn = cornerFlags(simple, thrDeg);
      dParts.push(loopToPath(simple, crn, tension));
      segments += simple.length;
      loopN++;
    }
    if (dParts.length) {
      layers.push({ color: spec.color, d: dParts.join(' '), area, segments, loops: loopN });
      nodeCount += segments;
      pathCount += loopN;
    }
  }
  layers.sort((a, b) => b.area - a.area);

  stage('COMPILE · SVG');
  await tick();
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  const paths = layers
    .map((l) => `  <path fill="${l.color}" fill-rule="evenodd" d="${l.d}"/>`)
    .join('\n');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${w} ${h}" shape-rendering="geometricPrecision">\n${paths}\n</svg>`;

  stage(null);
  return {
    svg,
    width: W, height: H,
    traceWidth: w, traceHeight: h,
    layers,
    palette: layers.map((l) => l.color),
    pathCount, nodeCount,
    bytes: new Blob([svg]).size,
    bgRemoved,
  };
}
