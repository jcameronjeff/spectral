import type { ColorToken } from '../types.js';

export function nameColors(colors: ColorToken[]): ColorToken[] {
  return colors.map((color) => ({
    ...color,
    name: generateColorName(color.hex),
  }));
}

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    default:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function getHueName(h: number): string {
  if (h < 15) return 'red';
  if (h < 40) return 'orange';
  if (h < 65) return 'yellow';
  if (h < 160) return 'green';
  if (h < 195) return 'cyan';
  if (h < 265) return 'blue';
  if (h < 290) return 'purple';
  if (h < 340) return 'pink';
  return 'red';
}

function getLightnessShade(l: number): number {
  // Map lightness 0-100 to Tailwind-like shade scale
  // Higher lightness = lower shade number (lighter)
  if (l >= 97) return 50;
  if (l >= 93) return 100;
  if (l >= 86) return 200;
  if (l >= 76) return 300;
  if (l >= 64) return 400;
  if (l >= 50) return 500;
  if (l >= 40) return 600;
  if (l >= 30) return 700;
  if (l >= 20) return 800;
  return 900;
}

function generateColorName(hex: string): string {
  const lower = hex.toLowerCase();

  if (lower === '#000000') return 'black';
  if (lower === '#ffffff') return 'white';

  const { h, s, l } = hexToHSL(lower);

  // Grayscale detection — low saturation
  if (s < 8) {
    const shade = getLightnessShade(l);
    return `gray-${shade}`;
  }

  const hueName = getHueName(h);
  const shade = getLightnessShade(l);

  return `${hueName}-${shade}`;
}
