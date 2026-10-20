/* Image loading (local file · internet URL with CORS fallback) + export utils */

export interface SourceImage {
  url: string;
  name: string;
  width: number;
  height: number;
  bytes: number | null;
  via: string;
}

export interface LoadedImage {
  img: HTMLImageElement;
  meta: SourceImage;
}

function toMeta(img: HTMLImageElement, url: string, name: string, bytes: number | null, via: string): LoadedImage {
  return {
    img,
    meta: { url, name, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, bytes, via },
  };
}

export function metaFromLoaded(li: LoadedImage): SourceImage { return li.meta; }

export function loadFromFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(toMeta(img, url, file.name, file.size, 'local file'));
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unreadable image file')); };
    img.src = url;
  });
}

function probeDirect(url: string, timeout = 12000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const t = setTimeout(() => { img.src = ''; reject(new Error('timeout')); }, timeout);
    img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); reject(new Error('blocked')); };
    img.src = url;
  });
}

async function fetchViaProxies(url: string): Promise<{ blobUrl: string; bytes: number }> {
  const proxies = [
    (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  ];
  let lastErr: unknown = null;
  for (const wrap of proxies) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(wrap(url), { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!blob.type.startsWith('image/') && blob.size < 1024) throw new Error('not an image');
      return { blobUrl: URL.createObjectURL(blob), bytes: blob.size };
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All proxies failed');
}

function nameFromUrl(url: string): string {
  try {
    const p = new URL(url).pathname.split('/').filter(Boolean);
    const last = p[p.length - 1] || 'image';
    return last.includes('.') ? last : `${last.slice(0, 24) || 'image'}.png`;
  } catch { return 'remote-image.png'; }
}

export async function loadFromUrl(url: string): Promise<LoadedImage> {
  const name = nameFromUrl(url);
  let host = '';
  try { host = new URL(url).hostname; } catch { host = 'web'; }
  // 1 · direct (works for CORS-enabled hosts: pexels, unsplash, picsum…)
  try {
    const img = await probeDirect(url);
    return toMeta(img, url, name, null, host);
  } catch { /* fall through to proxies */ }
  // 2 · proxy cascade
  const { blobUrl, bytes } = await fetchViaProxies(url);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('proxy image unreadable'));
    i.src = blobUrl;
  });
  return toMeta(img, blobUrl, name, bytes, `${host} · proxy`);
}

/* ---------------- export ---------------- */

export function formatBytes(b: number | null | undefined): string {
  if (b == null) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export function downloadSvg(svg: string, name: string) {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  const base = name.replace(/\.\w+$/, '').replace(/[^\w-]+/g, '-').toLowerCase() || 'vektora';
  a.href = URL.createObjectURL(blob);
  a.download = `${base}-vectorized.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function svgToJsx(svg: string): string {
  return svg
    .replace(/\s?xmlns="[^"]*"/, '')
    .replace(/fill-rule/g, 'fillRule')
    .replace(/shape-rendering/g, 'shapeRendering')
    .replace(/clip-rule/g, 'clipRule');
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
