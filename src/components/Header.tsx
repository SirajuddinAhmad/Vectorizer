import { Activity } from 'lucide-react';
import { cn } from '../utils/cn';

export default function Header({ busy, hasImage }: { busy: boolean; hasImage: boolean }) {
  return (
    <header className="h-14 shrink-0 border-b border-line bg-ink/90 backdrop-blur flex items-center justify-between px-4 lg:px-6 relative z-30">
      {/* logo */}
      <div className="flex items-center gap-3">
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden>
          <rect x="1.5" y="1.5" width="29" height="29" stroke="#D4FF3F" strokeWidth="1.5" />
          <path d="M7 22 C 7 12, 13 12, 16 16 C 19 20, 25 20, 25 10" stroke="#D4FF3F" strokeWidth="1.8" fill="none" />
          <rect x="5.5" y="20.5" width="3" height="3" fill="#0A0B0D" stroke="#D4FF3F" />
          <rect x="14.5" y="14.5" width="3" height="3" fill="#0A0B0D" stroke="#D4FF3F" />
          <rect x="23.5" y="8.5" width="3" height="3" fill="#D4FF3F" />
        </svg>
        <div className="leading-none">
          <div className="font-display font-bold text-[17px] tracking-[0.12em] text-bone">
            VEKTORA<span className="text-lime">.</span>
          </div>
          <div className="font-mono text-[8.5px] tracking-[0.3em] text-fog mt-1">
            RASTER → SVG TRACING ENGINE
          </div>
        </div>
      </div>

      {/* center spec — desktop only */}
      <div className="hidden xl:flex items-center gap-6 font-mono text-[9px] tracking-[0.2em] text-fog uppercase">
        <span>MEDIAN-CUT QUANTIZE</span>
        <span className="text-line">/</span>
        <span>MARCHING SQUARES</span>
        <span className="text-line">/</span>
        <span>CATMULL-ROM SMOOTHING</span>
      </div>

      {/* status */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex items-center gap-2 border px-2.5 py-1.5 font-mono text-[9px] tracking-[0.22em] uppercase transition-colors',
            busy ? 'border-lime/50 text-lime' : 'border-line text-fog',
          )}
        >
          <Activity size={11} className={busy ? 'animate-pulse' : ''} />
          {busy ? 'TRACING…' : hasImage ? 'READY' : 'IDLE'}
          <span className={cn('w-1.5 h-1.5 rounded-full', busy ? 'bg-lime animate-ping' : 'bg-fog/50')} />
        </div>
        <div className="hidden md:block font-mono text-[9px] tracking-[0.2em] text-fog border border-line px-2.5 py-1.5">
          V2.4 · BROWSER-NATIVE
        </div>
      </div>
    </header>
  );
}
