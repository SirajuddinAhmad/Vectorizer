import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronsLeftRight, Columns2, Grid2x2, Image as ImageIcon,
  Maximize, Minus, MousePointerClick, Plus, Spline,
} from 'lucide-react';
import type { SourceImage } from '../lib/image';
import { formatBytes } from '../lib/image';
import type { VecResult } from '../lib/vectorize';
import { cn } from '../utils/cn';
import { IconBtn, StatChip } from './ui';

export type ViewMode = 'compare' | 'original' | 'vector';

interface Props {
  source: SourceImage | null;
  result: VecResult | null;
  stage: string | null;
  mode: ViewMode;
  onMode: (m: ViewMode) => void;
  onSampleClick: () => void;
}

export default function Viewport({ source, result, stage, mode, onMode, onSampleClick }: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [holder, setHolder] = useState({ w: 800, h: 600 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cmp, setCmp] = useState(0.52);
  const [checker, setChecker] = useState(true);
  const dragging = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  /* observe size */
  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setHolder({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setHolder({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    if (!source) return;
    const k = Math.min(holder.w / source.width, holder.h / source.height) * 0.88;
    setScale(Math.min(k, 4));
    setPan({ x: 0, y: 0 });
  }, [source, holder.w, holder.h]);

  /* fit on new image */
  const lastSrc = useRef<string | null>(null);
  useEffect(() => {
    if (source && source.url !== lastSrc.current) {
      lastSrc.current = source.url;
      const k = Math.min(holder.w / source.width, holder.h / source.height) * 0.88;
      setScale(Math.min(k, 4));
      setPan({ x: 0, y: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, holder.w, holder.h]);

  /* wheel zoom to cursor */
  useEffect(() => {
    const el = holderRef.current;
    if (!el || !source) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cx = holder.w / 2, cy = holder.h / 2;
      const px = e.clientX - el.getBoundingClientRect().left;
      const py = e.clientY - el.getBoundingClientRect().top;
      setScale((s) => {
        const ns = Math.min(16, Math.max(0.05, s * Math.exp(-e.deltaY * 0.0016)));
        setPan((p) => {
          const ratio = ns / s;
          return { x: px - cx - (px - cx - p.x) * ratio, y: py - cy - (py - cy - p.y) * ratio };
        });
        return ns;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [source, holder]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!source || e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragging.current;
    if (!d) return;
    setPan({ x: d.px + e.clientX - d.sx, y: d.py + e.clientY - d.sy });
  };
  const endDrag = () => { dragging.current = null; };

  const zoomBy = (f: number) =>
    setScale((s) => Math.min(16, Math.max(0.05, s * f)));

  /* compare handle drag */
  const cmpDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const st = stageRef.current;
    if (!st) return;
    const move = (ev: PointerEvent) => {
      const r = st.getBoundingClientRect();
      setCmp(Math.min(0.98, Math.max(0.02, (ev.clientX - r.left) / r.width)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const showVector = !!result && (mode === 'vector' || mode === 'compare');
  const showRaster = !!source && (mode === 'original' || mode === 'compare');
  const delta = result && source?.bytes ? (1 - result.bytes / source.bytes) * 100 : null;

  return (
    <div ref={holderRef} className="relative flex-1 min-h-[420px] overflow-hidden bg-grid select-none">
      {/* crop-mark corners */}
      {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos) => (
        <span key={pos} className={cn('absolute font-mono text-fog/40 text-xs pointer-events-none z-10', pos)}>+</span>
      ))}

      {/* ---------------- empty state ---------------- */}
      {!source && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 anim-fadeup">
          {/* animated tracer decoration */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-70" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 600" fill="none">
            <path className="anim-dash" d="M40 480 C 200 240, 300 520, 430 330 C 540 170, 640 420, 760 140"
              stroke="#D4FF3F" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="6 8" fill="none" />
            <path d="M-40 120 C 160 300, 320 60, 480 220 C 610 350, 700 180, 860 300"
              stroke="white" strokeOpacity="0.07" strokeWidth="1.5" fill="none" />
            {[{ x: 40, y: 480 }, { x: 430, y: 330 }, { x: 760, y: 140 }].map((p, i) => (
              <g key={i}>
                <rect x={p.x - 4} y={p.y - 4} width="8" height="8" fill="#0A0B0D" stroke="#D4FF3F" strokeOpacity="0.8" />
              </g>
            ))}
          </svg>

          <div className="relative text-center">
            <div className="font-mono text-[10px] tracking-[0.35em] text-lime mb-5">
              [01] BROWSER-NATIVE VECTORIZER
            </div>
            <h1 className="font-display font-bold leading-[0.9] tracking-tight text-bone text-[13vw] md:text-[7vw]">
              RASTER&nbsp;IN<span className="text-lime">.</span>
              <br />
              <span className="text-outline">VECTORS&nbsp;OUT</span><span className="text-lime">.</span>
            </h1>
            <p className="font-mono text-[10px] md:text-[11px] tracking-[0.14em] text-fog mt-6 uppercase">
              Quantize · Trace contours · <span className="text-bone">Butter-smooth bézier edges</span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
              <button
                onClick={onSampleClick}
                className="flex items-center gap-2 bg-lime text-ink font-mono text-[10px] font-bold tracking-[0.16em] px-4 py-2.5 hover:brightness-110 transition cursor-pointer"
              >
                <MousePointerClick size={13} /> TRY A SAMPLE
              </button>
              <span className="font-mono text-[9px] tracking-[0.2em] text-fog px-2">OR</span>
              <span className="font-mono text-[9px] tracking-[0.2em] text-fog border border-line px-3 py-2.5">
                DROP / PASTE ANY IMAGE
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- stage ---------------- */}
      {source && (
        <div
          className={cn('absolute inset-0', dragging.current ? 'cursor-grabbing' : 'cursor-grab')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onDoubleClick={() => {
            const natural = 1;
            if (Math.abs(scale - natural) < 0.02) fit(); else { setScale(1); setPan({ x: 0, y: 0 }); }
          }}
        >
          <div
            ref={stageRef}
            className="absolute left-1/2 top-1/2 shadow-[0_0_80px_rgba(0,0,0,0.55)]"
            style={{
              width: source.width,
              height: source.height,
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${scale})`,
            }}
          >
            {/* checker underlay */}
            {checker && showVector && (
              <div className="absolute inset-0 vk-checker" />
            )}
            {/* vector layer */}
            {showVector && (
              <div
                className="absolute inset-0 vk-vec"
                dangerouslySetInnerHTML={{ __html: result!.svg }}
              />
            )}
            {/* raster layer (clipped in compare) */}
            {showRaster && (
              <img
                src={source.url}
                alt={source.name}
                draggable={false}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={mode === 'compare' ? { clipPath: `inset(0 ${(1 - cmp) * 100}% 0 0)` } : undefined}
              />
            )}
            {/* processing scan */}
            {stage && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="vk-scanline" />
              </div>
            )}
            {/* compare divider */}
            {mode === 'compare' && result && (
              <>
                <div
                  className="absolute top-0 bottom-0 w-px bg-lime z-20 pointer-events-none"
                  style={{ left: `${cmp * 100}%` }}
                />
                <button
                  onPointerDown={cmpDrag}
                  className="absolute z-30 top-1/2 w-9 h-9 bg-ink border border-lime text-lime flex items-center justify-center cursor-ew-resize hover:bg-lime hover:text-ink transition-colors"
                  style={{ left: `${cmp * 100}%`, transform: `translate(-50%,-50%) scale(${1 / scale})` }}
                  title="Drag to compare"
                >
                  <ChevronsLeftRight size={15} />
                </button>
                <span
                  className="absolute z-20 top-2 font-mono text-[8.5px] tracking-[0.2em] bg-ink/85 text-bone px-2 py-1 border border-line pointer-events-none"
                  style={{ left: 8, transform: `scale(${1 / scale})`, transformOrigin: 'top left' }}
                >
                  RASTER
                </span>
                <span
                  className="absolute z-20 top-2 font-mono text-[8.5px] tracking-[0.2em] bg-lime text-ink font-bold px-2 py-1 pointer-events-none"
                  style={{ right: 8, transform: `scale(${1 / scale})`, transformOrigin: 'top right' }}
                >
                  VECTOR
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* stage ticker */}
      {stage && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 pointer-events-none">
          <div className="flex items-center gap-2 bg-ink/90 backdrop-blur border border-lime/40 px-3 py-1.5">
            <span className="w-1.5 h-1.5 bg-lime animate-ping" />
            <span className="font-mono text-[9px] tracking-[0.22em] text-lime">{stage}</span>
          </div>
          <div className="w-44 h-px bg-white/10 overflow-hidden">
            <div className="h-full w-1/3 bg-lime vk-progress" />
          </div>
        </div>
      )}

      {/* zoom toolbar */}
      {source && (
        <div className="absolute bottom-3 left-3 z-40 flex items-center gap-1 anim-fadeup">
          <IconBtn onClick={() => zoomBy(0.8)} title="Zoom out"><Minus size={13} /></IconBtn>
          <button
            onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}
            title="Actual size (1:1)"
            className="h-7 px-2 border border-line bg-ink/80 backdrop-blur font-mono text-[10px] text-bone tabular-nums hover:border-fog/60 transition-colors cursor-pointer"
          >
            {Math.round(scale * 100)}%
          </button>
          <IconBtn onClick={() => zoomBy(1.25)} title="Zoom in"><Plus size={13} /></IconBtn>
          <IconBtn onClick={fit} title="Fit to view"><Maximize size={12} /></IconBtn>
          <IconBtn active={checker} onClick={() => setChecker((c) => !c)} title="Transparency checkerboard">
            <Grid2x2 size={12} />
          </IconBtn>
        </div>
      )}

      {/* view modes */}
      {source && (
        <div className="absolute bottom-3 right-3 z-40 flex items-center gap-1 anim-fadeup">
          <IconBtn active={mode === 'compare'} onClick={() => onMode('compare')} title="Compare slider">
            <Columns2 size={13} />
          </IconBtn>
          <IconBtn active={mode === 'original'} onClick={() => onMode('original')} title="Original only">
            <ImageIcon size={13} />
          </IconBtn>
          <IconBtn active={mode === 'vector'} onClick={() => onMode('vector')} title="Vector only">
            <Spline size={13} />
          </IconBtn>
        </div>
      )}

      {/* stats */}
      {source && result && (
        <div className="absolute top-3 left-3 z-30 flex flex-wrap items-center gap-1 pointer-events-none anim-fadeup max-w-[70%]">
          <StatChip label="Paths" value={result.pathCount} />
          <StatChip label="Nodes" value={result.nodeCount.toLocaleString('en-US')} />
          <StatChip label="Layers" value={result.layers.length} />
          <StatChip label="SVG" value={formatBytes(result.bytes)} accent />
          {delta != null && (
            <StatChip
              label="vs source"
              value={`${delta > 0 ? '−' : '+'}${Math.abs(delta).toFixed(1)}%`}
              accent={delta > 0}
            />
          )}
          <StatChip label={`${result.traceWidth}×${result.traceHeight} trace`} value="" />
        </div>
      )}
    </div>
  );
}
