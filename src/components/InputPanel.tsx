import { useRef, useState } from 'react';
import { ArrowRight, Globe, ImagePlus, Link2, Loader2, UploadCloud } from 'lucide-react';
import { SAMPLES } from '../lib/presets';
import { cn } from '../utils/cn';
import { SectionLabel } from './ui';

interface Props {
  onFile: (f: File) => void;
  onUrl: (url: string) => void;
  onSample: (idx: number) => void;
  loadingKey: string | null;
}

export default function InputPanel({ onFile, onUrl, onSample, loadingKey }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [urlText, setUrlText] = useState('');

  const submitUrl = () => {
    const u = urlText.trim();
    if (!u) return;
    onUrl(/^https?:\/\//i.test(u) ? u : `https://${u}`);
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* dropzone */}
      <section>
        <SectionLabel>INPUT · RASTER</SectionLabel>
        <button
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
          className={cn(
            'relative w-full border border-dashed p-5 text-left transition-all duration-200 cursor-pointer overflow-hidden group',
            dragOver ? 'border-lime bg-lime/[0.06]' : 'border-fog/35 hover:border-lime/70 hover:bg-white/[0.02]',
          )}
        >
          <div className="flex items-start justify-between">
            <UploadCloud size={22} className={cn('transition-colors', dragOver ? 'text-lime' : 'text-fog group-hover:text-lime')} />
            <span className="font-mono text-[8.5px] tracking-[0.2em] text-fog/70">PNG · JPG · WEBP</span>
          </div>
          <div className="mt-4 font-display font-bold text-[15px] leading-tight text-bone">
            DROP AN IMAGE<br />
            <span className="text-fog font-medium text-[12px] font-display">
              or click to browse your device
            </span>
          </div>
          {dragOver && (
            <div className="absolute inset-0 pointer-events-none border border-lime/60 animate-pulse" />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
        />
      </section>

      {/* url */}
      <section>
        <SectionLabel right={<Globe size={11} className="text-fog" />}>PULL FROM INTERNET</SectionLabel>
        <div className="flex border border-line bg-abyss focus-within:border-lime/60 transition-colors">
          <div className="flex items-center pl-2.5 text-fog">
            {loadingKey === 'url' ? <Loader2 size={12} className="animate-spin text-lime" /> : <Link2 size={12} />}
          </div>
          <input
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitUrl()}
            placeholder="https://any-image-url.com/pic.jpg"
            spellCheck={false}
            className="flex-1 bg-transparent outline-none font-mono text-[10.5px] text-bone placeholder:text-fog/50 px-2 py-2.5 min-w-0"
          />
          <button
            onClick={submitUrl}
            disabled={!urlText.trim()}
            className="px-3 border-l border-line text-fog hover:text-ink hover:bg-lime transition-colors cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fog"
            title="Fetch & vectorize"
          >
            <ArrowRight size={13} />
          </button>
        </div>
        <p className="font-mono text-[8.5px] text-fog/60 mt-1.5 leading-relaxed">
          DIRECT CORS FIRST · AUTOMATIC PROXY FALLBACK
        </p>
      </section>

      {/* samples */}
      <section>
        <SectionLabel right={<span className="font-mono text-[8.5px] text-fog/60">1-CLICK DEMOS</span>}>
          SAMPLE GALLERY
        </SectionLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {SAMPLES.map((s, i) => {
            const isLoading = loadingKey === `sample-${i}`;
            return (
              <button
                key={s.name}
                onClick={() => onSample(i)}
                className="relative aspect-square overflow-hidden border border-line group cursor-pointer"
                title={`${s.name} — ${s.credit}`}
              >
                <img
                  src={s.thumb}
                  alt={s.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/45 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity font-mono text-[8px] tracking-[0.15em] text-lime uppercase text-center px-1 leading-relaxed">
                    {isLoading ? 'LOADING…' : 'VECTORIZE'}
                  </span>
                </div>
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/50">
                    <Loader2 size={14} className="animate-spin text-lime" />
                  </div>
                )}
                {s.builtin && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-lime rotate-45" />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <ImagePlus size={10} className="text-fog/60 shrink-0" />
          <p className="font-mono text-[8.5px] text-fog/60 leading-relaxed">
            PHOTOS VIA PEXELS · FETCHED LIVE · DIAMOND = BUILT-IN
          </p>
        </div>
      </section>
    </div>
  );
}
