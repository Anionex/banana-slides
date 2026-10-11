// Local renderer matching 21st's Ribbon Field (609164 / 635261).
// Only the four colors differ from the supplied recipe. Scale/distortion and
// the other mode-specific controls are not used by its stripe renderer.
export const RIBBON_COLORS = ['#ffffff', '#fff9e9', '#ffe271', '#f8cc27'];
const positions = [18, 57, 60, 100];
const boundaries = positions.slice(1).map((position, i) => (positions[i] + position) / 200);
const radians = 32 / 180 * Math.PI;
const sine = Math.sin(radians);
const cosine = Math.cos(radians);
const axis = Math.abs(sine) + Math.abs(cosine);
const tableSize = 8192;

function toOklab(hex: string): number[] {
  const rgb = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

function toRgb([lightness, a, b]: number[]): number[] {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
    .map(value => Math.min(255, Math.max(0, Math.round(255 * (value <= 0.0031308
      ? 12.92 * value : 1.055 * Math.max(0, value) ** (1 / 2.4) - 0.055)))));
}

function createPalette(colors: string[], feather: number) {
  const labs = colors.map(toOklab);
  const palette = new Uint8ClampedArray(tableSize * 3);
  for (let index = 0; index < tableSize; index++) {
    const position = -0.5 + index / (tableSize - 1) * 2;
    const color = [...labs[0]];
    boundaries.forEach((boundary, next) => {
      const fraction = Math.max(0, Math.min(1, (position - (boundary - feather)) / (2 * feather)));
      const blend = fraction * fraction * (3 - 2 * fraction);
      color.forEach((value, channel) => { color[channel] = value + (labs[next + 1][channel] - value) * blend; });
    });
    palette.set(toRgb(color), index * 3);
  }
  return palette;
}

export function ribbonDimensions(width: number, height: number, animated: boolean, ratio = 1) {
  let w = Math.max(1, Math.round(width * ratio));
  let h = Math.max(1, Math.round(height * ratio));
  const limit = animated ? 288 : 1280;
  const largest = Math.max(w, h);
  if (largest > limit) {
    w = Math.max(1, Math.round(w * limit / largest));
    h = Math.max(1, Math.round(h * limit / largest));
  }
  return { width: w, height: h };
}

export function createRibbonRenderer(
  context: CanvasRenderingContext2D,
  colors = RIBBON_COLORS,
  { softness = 24, wave = 14, waveFrequency = 2.4, flow = 'ribbon' }: {
    softness?: number; wave?: number; waveFrequency?: number; flow?: 'ribbon' | 'horizontal';
  } = {},
) {
  const palette = createPalette(colors, softness / 100 * 0.5);
  let image: ImageData | undefined;
  return (width: number, height: number, elapsed: number) => {
    if (!image || image.width !== width || image.height !== height) image = context.createImageData(width, height);
    // speed=100, motionAmount=0, motionReverse=false: fixed angle, moving wave.
    const clock = 20.75 + elapsed * 1.2;
    const pixels = image.data;
    for (let y = 0; y < height; y++) {
      const ny = (y + 0.5) / height - 0.5;
      for (let x = 0; x < width; x++) {
        const nx = (x + 0.5) / width - 0.5;
        const cross = -nx * cosine + ny * sine;
        // An overhead wave repeats smoothly across x; its curved fronts drift right.
        const position = flow === 'horizontal'
          ? 0.5 + 0.45 * Math.sin((nx + 0.5) * waveFrequency * Math.PI * 2 - clock
            + wave / 100 * Math.sin(ny * Math.PI * 2 + clock * 0.25))
          : 0.5 + (nx * sine + ny * cosine) / axis
            + wave / 100 * 0.35 * Math.sin(cross * waveFrequency * Math.PI * 2 + clock);
        const lookup = (Math.min(1.5, Math.max(-0.5, position)) + 0.5) / 2 * (tableSize - 1);
        const low = Math.floor(lookup);
        const high = Math.min(tableSize - 1, low + 1);
        const blend = lookup - low;
        const offset = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          const value = palette[low * 3 + channel];
          pixels[offset + channel] = value + (palette[high * 3 + channel] - value) * blend;
        }
        pixels[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  };
}
