import type { VecOptions } from './vectorize';

export const INK_COLORS = [
  { value: '#141519', label: 'INK' },
  { value: '#F2EFE6', label: 'PAPER' },
  { value: '#D4FF3F', label: 'ACID' },
];

export const DEFAULT_OPTIONS: VecOptions = {
  mode: 'color',
  colors: 8,
  blur: 22,
  detail: 72,
  smoothness: 85,
  cornerSharp: 58,
  threshold: 140,
  invert: false,
  ink: '#141519',
  removeBg: false,
};

export interface Preset {
  id: string;
  label: string;
  hint: string;
  patch: Partial<VecOptions>;
}

export const PRESETS: Preset[] = [
  {
    id: 'photo', label: 'PHOTO', hint: 'rich palette, soft edges',
    patch: { mode: 'color', colors: 12, blur: 26, detail: 74, smoothness: 88, cornerSharp: 52, removeBg: false },
  },
  {
    id: 'logo', label: 'LOGO', hint: 'crisp corners, flat layers',
    patch: { mode: 'color', colors: 6, blur: 10, detail: 86, smoothness: 62, cornerSharp: 82, removeBg: false },
  },
  {
    id: 'poster', label: 'POSTER', hint: 'bold bands, max smooth',
    patch: { mode: 'color', colors: 5, blur: 42, detail: 52, smoothness: 100, cornerSharp: 38, removeBg: false },
  },
  {
    id: 'ink', label: 'INK', hint: 'single-color stencil',
    patch: { mode: 'mono', threshold: 140, blur: 14, detail: 76, smoothness: 80, cornerSharp: 66, invert: false },
  },
];

export interface Sample {
  url: string;
  thumb: string;
  name: string;
  credit: string;
  builtin?: boolean;
}

export const SAMPLES: Sample[] = [
  { url: 'samples/toucan.png', thumb: 'samples/toucan.png', name: 'Toucan Poster', credit: 'built-in', builtin: true },
  { url: 'samples/sunset.png', thumb: 'samples/sunset.png', name: 'Retro Sunset', credit: 'built-in', builtin: true },
  {
    url: 'https://images.pexels.com/photos/9330004/pexels-photo-9330004.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    thumb: 'https://images.pexels.com/photos/9330004/pexels-photo-9330004.jpeg?auto=compress&cs=tinysrgb&dpr=1&fit=crop&h=200&w=280',
    name: 'Yellow Beetle', credit: 'Pexels · Kleber Costa',
  },
  {
    url: 'https://images.pexels.com/photos/14012401/pexels-photo-14012401.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    thumb: 'https://images.pexels.com/photos/14012401/pexels-photo-14012401.jpeg?auto=compress&cs=tinysrgb&dpr=1&fit=crop&h=200&w=280',
    name: 'Flamingos', credit: 'Pexels · Quang Nguyen Vinh',
  },
  {
    url: 'https://images.pexels.com/photos/2839/red-car-vintage-old.jpg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    thumb: 'https://images.pexels.com/photos/2839/red-car-vintage-old.jpg?auto=compress&cs=tinysrgb&dpr=1&fit=crop&h=200&w=280',
    name: 'Red Classic', credit: 'Pexels · Jaymantri',
  },
  {
    url: 'https://images.pexels.com/photos/13137058/pexels-photo-13137058.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940',
    thumb: 'https://images.pexels.com/photos/13137058/pexels-photo-13137058.jpeg?auto=compress&cs=tinysrgb&dpr=1&fit=crop&h=200&w=280',
    name: 'Butterfly', credit: 'Pexels · Jimmy Chan',
  },
];
