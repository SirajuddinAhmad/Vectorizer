import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import Header from './components/Header';
import InputPanel from './components/InputPanel';
import ControlPanel from './components/ControlPanel';
import Viewport, { type ViewMode } from './components/Viewport';
import { DEFAULT_OPTIONS, SAMPLES } from './lib/presets';
import {
  downloadSvg, loadFromFile, loadFromUrl, svgToJsx,
  type LoadedImage,
} from './lib/image';
import { vectorizeImage, type VecOptions, type VecResult } from './lib/vectorize';

const MARQUEE =
  'RASTER → VECTOR ✦ MEDIAN-CUT QUANTIZATION ✦ MARCHING SQUARES CONTOURS ✦ DOUGLAS–PEUCKER SIMPLIFY ✦ CATMULL–ROM BÉZIER SMOOTHING ✦ ADAPTIVE CORNER LOCK ✦ 100% CLIENT-SIDE ✦ NOTHING UPLOADED ✦ ';

export default function App() {
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [opts, setOpts] = useState<VecOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<VecResult | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('compare');
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);

  const runId = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg });
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  /* ---------------- image intake ---------------- */
  const acceptLoaded = useCallback((li: LoadedImage) => {
    setLoaded(li);
    setMode((m) => (m === 'original' ? 'compare' : m));
    notify(`LOADED · ${li.meta.name.toUpperCase()} · ${li.meta.width}×${li.meta.height}`);
  }, [notify]);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith('image/')) { notify('NOT AN IMAGE FILE'); return; }
    setLoadingKey('file');
    try { acceptLoaded(await loadFromFile(f)); }
    catch { notify('COULD NOT READ THAT FILE'); }
    finally { setLoadingKey(null); }
  }, [acceptLoaded, notify]);

  const handleUrl = useCallback(async (url: string) => {
    setLoadingKey('url');
    try { acceptLoaded(await loadFromUrl(url)); }
    catch { notify('FETCH FAILED — CORS BLOCKED · TRY ANOTHER URL'); }
    finally { setLoadingKey(null); }
  }, [acceptLoaded, notify]);

  const handleSample = useCallback(async (idx: number) => {
    const s = SAMPLES[idx];
    setLoadingKey(`sample-${idx}`);
    try {
      const li = await loadFromUrl(s.url);
      li.meta.name = s.name.toLowerCase().replace(/\s+/g, '-') + '.png';
      li.meta.via = s.credit;
      acceptLoaded(li);
    } catch { notify('SAMPLE UNAVAILABLE OFFLINE'); }
    finally { setLoadingKey(null); }
  }, [acceptLoaded, notify]);

  /* ---------------- tracing pipeline ---------------- */
  useEffect(() => {
    if (!loaded) { setResult(null); return; }
    const id = ++runId.current;
    const img = loaded.img;
    const timer = setTimeout(async () => {
      try {
        const res = await vectorizeImage(img, opts, (s) => {
          if (runId.current === id) setStage(s);
        });
        if (runId.current !== id) return;
        setResult(res);
        setStage(null);
      } catch (e) {
        console.error(e);
        if (runId.current === id) { setStage(null); notify('TRACE FAILED'); }
      }
    }, loaded ? 160 : 0);
    return () => clearTimeout(timer);
  }, [loaded, opts, notify]);

  /* ---------------- global drop / paste ---------------- */
  useEffect(() => {
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFile(f);
    };
    const onDrag = (e: DragEvent) => e.preventDefault();
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith('image/'));
      if (f) { handleFile(f); notify('PASTED FROM CLIPBOARD'); }
    };
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragover', onDrag);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragover', onDrag);
      window.removeEventListener('paste', onPaste);
    };
  }, [handleFile, notify]);

  /* ---------------- export ---------------- */
  const onDownload = useCallback(() => {
    if (!result || !loaded) return;
    downloadSvg(result.svg, loaded.meta.name);
    notify('SVG SAVED TO DISK');
  }, [result, loaded, notify]);

  const onCopy = useCallback((kind: 'svg' | 'jsx') => {
    if (!result) return;
    const text = kind === 'jsx' ? svgToJsx(result.svg) : result.svg;
    navigator.clipboard.writeText(text)
      .then(() => notify(kind === 'jsx' ? 'JSX MARKUP COPIED' : 'SVG MARKUP COPIED'))
      .catch(() => notify('CLIPBOARD BLOCKED BY BROWSER'));
  }, [result, notify]);

  const onOpen = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.svg], { type: 'image/svg+xml' });
    window.open(URL.createObjectURL(blob), '_blank');
  }, [result]);

  const patchOpts = useCallback((patch: Partial<VecOptions>) => {
    setOpts((o) => ({ ...o, ...patch }));
  }, []);

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-ink text-bone lg:overflow-hidden">
      <Header busy={!!stage} hasImage={!!loaded} />

      <main className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[290px_minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)]">
        {/* input column */}
        <aside className="order-2 lg:order-1 border-t lg:border-t-0 lg:border-r border-line bg-panel/40 overflow-y-auto vk-scroll lg:h-full">
          <InputPanel
            onFile={handleFile}
            onUrl={handleUrl}
            onSample={handleSample}
            loadingKey={loadingKey}
          />
        </aside>

        {/* viewport */}
        <div className="order-1 lg:order-2 h-[62vh] lg:h-auto min-h-0 flex">
          <Viewport
            source={loaded?.meta ?? null}
            result={result}
            stage={stage}
            mode={mode}
            onMode={setMode}
            onSampleClick={() => handleSample(0)}
          />
        </div>

        {/* engine column */}
        <aside className="order-3 border-t lg:border-t-0 lg:border-l border-line bg-panel/40 lg:h-full lg:min-h-0">
          <ControlPanel
            opts={opts}
            onChange={patchOpts}
            onPreset={patchOpts}
            result={result}
            hasImage={!!loaded}
            onDownload={onDownload}
            onCopy={onCopy}
            onOpen={onOpen}
          />
        </aside>
      </main>

      {/* footer marquee */}
      <footer className="h-9 shrink-0 border-t border-line bg-abyss overflow-hidden flex items-center relative z-20">
        <div className="vk-marquee whitespace-nowrap font-mono text-[9px] tracking-[0.3em] text-fog/70">
          <span>{MARQUEE}</span><span>{MARQUEE}</span>
        </div>
        <div className="absolute right-0 top-0 bottom-0 flex items-center gap-2 bg-abyss pl-4 pr-4 border-l border-line">
          <span className="w-1.5 h-1.5 bg-lime rotate-45" />
          <span className="font-mono text-[9px] tracking-[0.25em] text-bone">VEKTORA ENGINE</span>
        </div>
      </footer>

      {/* toast */}
      {toast && (
        <div
          key={toast.id}
          className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-ink/95 backdrop-blur border border-lime/50 px-4 py-2 anim-toast"
        >
          <CheckCircle2 size={13} className="text-lime" />
          <span className="font-mono text-[10px] tracking-[0.18em] text-bone">{toast.msg}</span>
        </div>
      )}

      {/* film grain */}
      <div className="vk-noise" />
    </div>
  );
}
