import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

/* ---------- section label ---------- */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-lime rotate-45 inline-block" />
        <span className="font-mono text-[10px] tracking-[0.22em] text-fog uppercase">{children}</span>
      </div>
      {right}
    </div>
  );
}

/* ---------- slider with diamond thumb ---------- */
interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  accent?: boolean;
}

export function SliderRow({ label, value, min, max, onChange, format, accent }: SliderRowProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block select-none group">
      <div className="flex items-baseline justify-between mb-1">
        <span className={cn('font-mono text-[10px] tracking-[0.18em] uppercase transition-colors',
          accent ? 'text-lime' : 'text-fog group-hover:text-bone')}>{label}</span>
        <span className={cn('font-mono text-[11px] tabular-nums', accent ? 'text-lime' : 'text-bone')}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="vk-range w-full"
        style={{ ['--p' as string]: `${pct}%` }}
      />
    </label>
  );
}

/* ---------- segmented control ---------- */
interface SegmentedProps<T extends string> {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md' }: SegmentedProps<T>) {
  return (
    <div className="flex border border-line bg-abyss p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 font-mono uppercase tracking-[0.14em] transition-all duration-150 cursor-pointer',
            size === 'md' ? 'text-[10px] px-3 py-2' : 'text-[9px] px-2 py-1.5',
            value === o.value
              ? 'bg-lime text-ink font-bold'
              : 'text-fog hover:text-bone hover:bg-white/[0.04]',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- toggle ---------- */
interface ToggleProps { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }

export function Toggle({ label, checked, onChange, hint }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between group cursor-pointer py-0.5"
    >
      <span className="text-left">
        <span className={cn('block font-mono text-[10px] tracking-[0.18em] uppercase transition-colors',
          checked ? 'text-bone' : 'text-fog group-hover:text-bone')}>{label}</span>
        {hint && <span className="block font-mono text-[9px] text-fog/60 mt-0.5">{hint}</span>}
      </span>
      <span className={cn(
        'relative w-8 h-[18px] border transition-colors duration-150 shrink-0',
        checked ? 'bg-lime border-lime' : 'bg-abyss border-line group-hover:border-fog/50',
      )}>
        <span className={cn(
          'absolute top-[3px] w-2.5 h-2.5 rotate-45 transition-all duration-200',
          checked ? 'left-[17px] bg-ink' : 'left-[3px] bg-fog',
        )} />
      </span>
    </button>
  );
}

/* ---------- stat chip ---------- */
export function StatChip({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 border border-line bg-ink/80 backdrop-blur px-2 py-1">
      <span className="font-mono text-[9px] tracking-[0.16em] text-fog uppercase">{label}</span>
      <span className={cn('font-mono text-[10px] font-bold tabular-nums', accent ? 'text-lime' : 'text-bone')}>
        {value}
      </span>
    </div>
  );
}

/* ---------- icon button ---------- */
export function IconBtn({
  children, onClick, title, active,
}: { children: ReactNode; onClick?: () => void; title?: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'w-7 h-7 flex items-center justify-center border transition-all duration-150 cursor-pointer',
        active ? 'bg-lime text-ink border-lime' : 'border-line text-fog hover:text-bone hover:border-fog/60 bg-ink/80 backdrop-blur',
      )}
    >
      {children}
    </button>
  );
}
