import { Camera, Check, Code2, Download, ExternalLink, PenTool, Spline } from 'lucide-react';
import { useState } from 'react';
import { INK_COLORS, PRESETS } from '../lib/presets';
import type { VecOptions, VecResult } from '../lib/vectorize';
import { formatBytes } from '../lib/image';
import { cn } from '../utils/cn';
import { SectionLabel, Segmented, SliderRow, Toggle } from './ui';

interface Props {
  opts: VecOptions;
  onChange: (patch: Partial<VecOptions>) => void;
  onPreset: (patch: Partial<VecOptions>) => void;
  result: VecResult | null;
  hasImage: boolean;
  onDownload: () => void;
  onCopy: (kind: 'svg' | 'jsx') => void;
  onOpen: () => void;
}

export default function ControlPanel({
  opts, onChange, onPreset, result, hasImage, onDownload, onCopy, onOpen,
}: Props) {
  const [copied, setCopied] = useState<null | 'svg' | 'jsx'>(null);

  const copyAndFlash = (kind: 'svg' | 'jsx') => {
    onCopy(kind);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto vk-scroll flex flex-col gap-6 p-4">
        {/* presets */}
        <section>
          <SectionLabel>QUICK PRESETS</SectionLabel>
          <div className="grid grid-cols-4 gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => onPreset(p.patch)}
                title={p.hint}
                className="border border-line bg-abyss py-2 font-mono text-[9px] tracking-[0.12em] text-fog hover:text-ink hover:bg-lime hover:border-lime transition-all cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {/* mode */}
        <section>
          <SectionLabel>TRACE MODE</SectionLabel>
          <Segmented
            value={opts.mode}
            onChange={(mode) => onChange({ mode })}
            options={[
              { value: 'color', label: 'FULL COLOR', icon: <Camera size={11} /> },
              { value: 'mono', label: 'MONO INK', icon: <PenTool size={11} /> },
            ]}
          />
          <div className="mt-4 flex flex-col gap-4">
            {opts.mode === 'color' ? (
              <>
                <SliderRow
                  label="Color layers"
                  value={opts.colors}
                  min={2} max={16}
                  onChange={(colors) => onChange({ colors })}
                  format={(v) => `${v} CLRS`}
                />
                <Toggle
                  label="Remove background"
                  hint="auto-detect from corners"
                  checked={opts.removeBg}
                  onChange={(removeBg) => onChange({ removeBg })}
                />
              </>
            ) : (
              <>
                <SliderRow
                  label="Ink threshold"
                  value={opts.threshold}
                  min={0} max={255}
                  onChange={(threshold) => onChange({ threshold })}
                  format={(v) => `${Math.round((v / 255) * 100)}%`}
                />
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-fog mb-1.5">Ink color</div>
                    <div className="flex gap-1.5">
                      {INK_COLORS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => onChange({ ink: c.value })}
                          title={c.label}
                          className={cn(
                            'w-7 h-7 border cursor-pointer transition-transform hover:scale-110',
                            opts.ink === c.value ? 'border-lime ring-1 ring-lime/50' : 'border-line',
                          )}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                    </div>
                  </div>
                  <Toggle
                    label="Invert"
                    checked={opts.invert}
                    onChange={(invert) => onChange({ invert })}
                  />
                </div>
              </>
            )}
          </div>
        </section>

        {/* geometry */}
        <section>
          <SectionLabel right={<Spline size={11} className="text-lime" />}>EDGE GEOMETRY</SectionLabel>
          <div className="flex flex-col gap-4">
            <SliderRow
              accent
              label="Edge smoothing"
              value={opts.smoothness}
              min={0} max={100}
              onChange={(smoothness) => onChange({ smoothness })}
              format={(v) => `${v}%`}
            />
            <SliderRow
              label="Corner sharpness"
              value={opts.cornerSharp}
              min={0} max={100}
              onChange={(cornerSharp) => onChange({ cornerSharp })}
              format={(v) => `${v}%`}
            />
            <SliderRow
              label="Path detail"
              value={opts.detail}
              min={0} max={100}
              onChange={(detail) => onChange({ detail })}
              format={(v) => `${v}%`}
            />
            <SliderRow
              label="Pre-blur · denoise"
              value={opts.blur}
              min={0} max={100}
              onChange={(blur) => onChange({ blur })}
              format={(v) => `${((v / 100) * 3.5).toFixed(1)}PX`}
            />
          </div>
          <p className="font-mono text-[8.5px] text-fog/60 mt-3 leading-relaxed">
            SMOOTHING FITS CATMULL-ROM BÉZIERS THROUGH TRACE POINTS — SHARP CORNERS STAY CRISP.
          </p>
        </section>

        {/* palette */}
        {result && result.palette.length > 0 && (
          <section>
            <SectionLabel right={
              <span className="font-mono text-[9px] text-bone">{result.palette.length}</span>
            }>
              EXTRACTED PALETTE
            </SectionLabel>
            <div className="flex flex-wrap gap-1">
              {result.palette.map((c) => (
                <button
                  key={c}
                  title={c}
                  onClick={() => navigator.clipboard.writeText(c).catch(() => {})}
                  className="w-6 h-6 border border-line cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* export dock */}
      <div className="shrink-0 border-t border-line p-4 bg-panel/60 backdrop-blur">
        <button
          onClick={onDownload}
          disabled={!result}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 font-mono text-[11px] font-bold tracking-[0.18em] uppercase transition-all cursor-pointer',
            result
              ? 'bg-lime text-ink hover:brightness-110 active:scale-[0.99]'
              : 'bg-abyss text-fog/50 border border-line cursor-not-allowed',
          )}
        >
          <Download size={14} />
          DOWNLOAD SVG
          {result && <span className="font-normal opacity-70">· {formatBytes(result.bytes)}</span>}
        </button>
        <div className="grid grid-cols-3 gap-1.5 mt-1.5">
          <button
            onClick={() => copyAndFlash('svg')}
            disabled={!result}
            className="flex items-center justify-center gap-1.5 border border-line py-2 font-mono text-[8.5px] tracking-[0.12em] text-fog hover:text-bone hover:border-fog/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {copied === 'svg' ? <Check size={11} className="text-lime" /> : <Code2 size={11} />}
            {copied === 'svg' ? 'COPIED' : 'COPY SVG'}
          </button>
          <button
            onClick={() => copyAndFlash('jsx')}
            disabled={!result}
            className="flex items-center justify-center gap-1.5 border border-line py-2 font-mono text-[8.5px] tracking-[0.12em] text-fog hover:text-bone hover:border-fog/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {copied === 'jsx' ? <Check size={11} className="text-lime" /> : <Code2 size={11} />}
            {copied === 'jsx' ? 'COPIED' : 'COPY JSX'}
          </button>
          <button
            onClick={onOpen}
            disabled={!result && !hasImage}
            className="flex items-center justify-center gap-1.5 border border-line py-2 font-mono text-[8.5px] tracking-[0.12em] text-fog hover:text-bone hover:border-fog/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ExternalLink size={11} />
            OPEN
          </button>
        </div>
      </div>
    </div>
  );
}
