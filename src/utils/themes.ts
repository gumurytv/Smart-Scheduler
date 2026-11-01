// 테마 (Settings → 앱 → 테마): the whole app is painted from the colour tokens in index.css
// (paper, surface, ink, slate-*, accent-*, sage-*, other-*). A theme overrides those tokens on
// <html>, so no screen needs to know about themes. Palettes are built in OKLCH from one hue
// per role, with fixed lightness steps, so every theme keeps the same contrast as the default.
import { AppLanguage, ThemeConfig, ThemeId } from '../types';
import { tr } from '../i18n/translations';

interface ThemeSpec {
  id: ThemeId;
  name: [string, string, string];
  emoji: string;
  dark?: boolean;
  /** Neutral (paper/surface/slate) hue and chroma. */
  neutral: [hue: number, chroma: number];
  /** Accent seed colour (buttons, highlights, 학원). */
  accent: string;
}

export const THEMES: ThemeSpec[] = [
  { id: 'default', name: ['기본', 'Classic', '经典'], emoji: '🍂', neutral: [80, 0.03], accent: '#c67139' },
  { id: 'blossom', name: ['벚꽃', 'Blossom', '樱花'], emoji: '🌸', neutral: [10, 0.018], accent: '#d0577f' },
  { id: 'ocean', name: ['바다', 'Ocean', '海洋'], emoji: '🌊', neutral: [230, 0.014], accent: '#3c7fc0' },
  { id: 'lavender', name: ['라벤더', 'Lavender', '薰衣草'], emoji: '💜', neutral: [300, 0.014], accent: '#8a63c9' },
  { id: 'forest', name: ['숲', 'Forest', '森林'], emoji: '🌲', neutral: [150, 0.016], accent: '#2f8f7c' },
  { id: 'dark', name: ['다크', 'Dark', '深色'], emoji: '🌙', dark: true, neutral: [70, 0.012], accent: '#e08a52' },
];

/** 강조색 직접 고르기: optional accent on top of any theme. */
export const ACCENT_SWATCHES: string[] = [
  '#c67139', // terracotta
  '#d2553c', // red
  '#d0577f', // pink
  '#8a63c9', // violet
  '#5470cc', // blue
  '#3c7fc0', // sky
  '#2f8f7c', // teal
  '#4a9a5a', // green
  '#9a8a2a', // olive
  '#d6a02a', // mustard
  '#9c6b3c', // brown
  '#6b6f78', // graphite
];

export const themeName = (id: ThemeId, lang: AppLanguage) => {
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0];
  return tr(lang, ...t.name);
};

/* ---------- OKLCH <-> sRGB ---------- */

type Oklch = [l: number, c: number, h: number];

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function hexToOklch(hex: string): Oklch {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => toLinear(x / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

function oklchToRgb([L, C, H]: Oklch): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** OKLCH → hex, lowering chroma until the colour fits in sRGB. */
function oklchToHex([L, C, H]: Oklch): string {
  let c = C;
  let rgb = oklchToRgb([L, c, H]);
  while (c > 0 && rgb.some((v) => v < -0.0005 || v > 1.0005)) {
    c -= 0.004;
    rgb = oklchToRgb([L, Math.max(0, c), H]);
  }
  return (
    '#' +
    rgb
      .map((v) => Math.round(Math.min(1, Math.max(0, fromLinear(Math.min(1, Math.max(0, v))))) * 255))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/* ---------- Palettes ---------- */

const STEPS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'] as const;
// Lightness per step (light themes) and how much of the seed chroma each step keeps.
const LIGHT_L = [0.97, 0.93, 0.87, 0.79, 0.69, 0.59, 0.48, 0.38, 0.28];
const DARK_L = [0.3, 0.36, 0.45, 0.55, 0.64, 0.72, 0.79, 0.87, 0.93];
const CHROMA_K = [0.25, 0.45, 0.65, 0.85, 1, 1, 0.9, 0.75, 0.55];

function scale(prefix: string, seed: string, dark: boolean, out: Record<string, string>) {
  const [, c, h] = hexToOklch(seed);
  const ls = dark ? DARK_L : LIGHT_L;
  STEPS.forEach((step, i) => {
    out[`--color-${prefix}-${step}`] = oklchToHex([ls[i], c * CHROMA_K[i], h]);
  });
  out[`--color-${prefix}`] = oklchToHex([dark ? 0.7 : 0.63, c, h]);
}

const SLATE_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;
const SLATE_LIGHT_L = [0.95, 0.925, 0.86, 0.77, 0.67, 0.57, 0.47, 0.37, 0.28, 0.22, 0.17];
// Dark: the scale runs the other way (slate-600 is still "muted text", now light on dark),
// except 900/950, which stay dark because they are only used for dimming overlays.
const SLATE_DARK_L = [0.21, 0.27, 0.33, 0.42, 0.52, 0.62, 0.72, 0.8, 0.88, 0.12, 0.08];

/** CSS variables a theme sets on <html>; empty for the default look (index.css as written). */
export function themeVariables(config: ThemeConfig | undefined): Record<string, string> {
  const spec = THEMES.find((t) => t.id === config?.id) ?? THEMES[0];
  const accent = config?.accent;
  if (spec.id === 'default' && !accent) return {};
  const out: Record<string, string> = {};
  const dark = !!spec.dark;
  scale('accent', accent || spec.accent, dark, out);
  if (spec.id === 'default') return out;

  const [nh, nc] = spec.neutral;
  const sl = dark ? SLATE_DARK_L : SLATE_LIGHT_L;
  SLATE_STEPS.forEach((step, i) => {
    out[`--color-slate-${step}`] = oklchToHex([sl[i], nc * (i < 2 ? 1.4 : 1), nh]);
  });
  out['--color-paper'] = oklchToHex(dark ? [0.19, nc, nh] : [0.965, nc * 1.3, nh]);
  out['--color-surface'] = oklchToHex(dark ? [0.25, nc, nh] : [0.925, nc * 1.6, nh]);
  out['--color-ink'] = oklchToHex(dark ? [0.94, nc * 0.6, nh] : [0.22, nc * 0.6, nh]);
  out['--color-divider'] = `color-mix(in srgb, ${out['--color-ink']} ${dark ? 18 : 16}%, transparent)`;
  if (dark) {
    scale('sage', '#7a8a5e', true, out);
    scale('other', '#5b7393', true, out);
  }
  return out;
}

const THEME_KEYS = new Set<string>();

/** Paint the theme on <html> (and the browser/status-bar colour). */
export function applyTheme(config: ThemeConfig | undefined) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const vars = themeVariables(config);
  THEME_KEYS.forEach((k) => {
    if (!(k in vars)) root.style.removeProperty(k);
  });
  Object.entries(vars).forEach(([k, v]) => {
    root.style.setProperty(k, v);
    THEME_KEYS.add(k);
  });
  const dark = !!THEMES.find((t) => t.id === config?.id)?.dark;
  root.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--color-paper'] || '#f5ead8');
}

/** Small preview colours for the theme picker. */
export function themeSwatch(id: ThemeId, accent?: string): { paper: string; surface: string; accent: string; ink: string } {
  const v = themeVariables({ id, accent });
  return {
    paper: v['--color-paper'] || '#f5ead8',
    surface: v['--color-surface'] || '#ebddc5',
    accent: v['--color-accent-700'] || '#8c491a',
    ink: v['--color-ink'] || '#201e1d',
  };
}
