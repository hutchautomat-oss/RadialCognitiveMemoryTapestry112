export interface CIELAB {
  L: number;
  a: number;
  b: number;
}

const REF_X = 95.047;
const REF_Y = 100.0;
const REF_Z = 108.883;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hueForTier(q4: number): number {
  const clamped = Math.min(5, Math.max(1, q4));
  if (clamped <= 3) {
    return 60 + 60 * (clamped - 1);
  }
  return 180 + 45 * (clamped - 3);
}

function chromaForTier(q4: number): number {
  const clamped = Math.min(5, Math.max(1, q4));
  return 80 - 10 * (clamped - 1);
}

function labToXyz({ L, a, b }: CIELAB): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const xr = fx ** 3 > 0.008856 ? fx ** 3 : (fx - 16 / 116) / 7.787;
  const yr = L > 7.9996245 ? ((fy ** 3) as number) : (L / 903.3);
  const zr = fz ** 3 > 0.008856 ? fz ** 3 : (fz - 16 / 116) / 7.787;

  return [xr * REF_X, yr * REF_Y, zr * REF_Z];
}

function xyzToLinearRgb([x, y, z]: [number, number, number]): [number, number, number] {
  const X = x / 100;
  const Y = y / 100;
  const Z = z / 100;

  const r = X * 3.2406 + Y * -1.5372 + Z * -0.4986;
  const g = X * -0.9689 + Y * 1.8758 + Z * 0.0415;
  const b = X * 0.0557 + Y * -0.2040 + Z * 1.0570;

  return [r, g, b];
}

function linearToSRGB(value: number): number {
  const corrected = clamp01(value);
  return corrected <= 0.0031308
    ? corrected * 12.92
    : 1.055 * Math.pow(corrected, 1 / 2.4) - 0.055;
}

export function tierToCIELAB(q4: number): CIELAB {
  const clamped = Math.min(5, Math.max(1, q4));
  const L = 30 + 60 * ((clamped - 1) / 4);
  const hue = hueForTier(clamped);
  const chroma = chromaForTier(clamped);
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  return { L, a, b };
}

export function cielabToSRGB(lab: CIELAB): [number, number, number] {
  const xyz = labToXyz(lab);
  const [r, g, b] = xyzToLinearRgb(xyz);
  return [linearToSRGB(r), linearToSRGB(g), linearToSRGB(b)];
}

export function tierToSRGB(q4: number): [number, number, number] {
  return cielabToSRGB(tierToCIELAB(q4));
}

export function generateCIELABLUT(entries = 256): Uint8Array {
  const lut = new Uint8Array(entries * 3);
  for (let i = 0; i < entries; i++) {
    const q4 = 1 + (i / (entries - 1)) * 4;
    const [r, g, b] = tierToSRGB(q4);
    lut[i * 3 + 0] = Math.round(r * 255);
    lut[i * 3 + 1] = Math.round(g * 255);
    lut[i * 3 + 2] = Math.round(b * 255);
  }
  return lut;
}
