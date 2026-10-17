'use client';
import { cn } from '../lib/cn';

export interface RangeInputProps {
  min: number;
  max: number;
  step?: number;
  value: [number | null, number | null];
  onChange: (v: [number | null, number | null]) => void;
  /** Formats the bound labels; null bound shows the `anyLabel`. */
  format?: (n: number) => string;
  labels: { min: string; max: string };
  className?: string;
}

/** Two-thumb range slider built from native range inputs (keyboard + screen-reader friendly). */
export function RangeInput({ min, max, step = 1, value, onChange, format = String, labels, className }: RangeInputProps) {
  const lo = value[0] ?? min;
  const hi = value[1] ?? max;
  const pct = (n: number) => ((n - min) / (max - min)) * 100;
  const thumb =
    'pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent ' +
    '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-pill [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-surface-raised [&::-webkit-slider-thumb]:shadow ' +
    '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-pill [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-surface-raised';
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative h-6">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-pill bg-line" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-pill bg-primary" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        <input
          type="range"
          aria-label={labels.min}
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), hi);
            onChange([v === min ? null : v, value[1]]);
          }}
          className={thumb}
        />
        <input
          type="range"
          aria-label={labels.max}
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), lo);
            onChange([value[0], v === max ? null : v]);
          }}
          className={thumb}
        />
      </div>
      <div className="flex justify-between text-small text-ink-muted">
        <span>{format(lo)}</span>
        <span>{format(hi)}</span>
      </div>
    </div>
  );
}

export interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  label: string;
  format?: (n: number) => string;
}

export function Slider({ min, max, step = 1, value, onChange, label, format = String }: SliderProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-primary"
      />
      <span className="w-14 shrink-0 text-right text-small font-medium tabular-nums text-ink">{format(value)}</span>
    </div>
  );
}
