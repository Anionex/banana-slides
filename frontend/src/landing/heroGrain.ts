// Matches 21st.dev's gradient editor bitmap grain (modules 750302 / 504690).
// Its grain is random per session; the recipe seed does not control this layer.
export const LANDING_GRAIN = 65;
export const grainOpacity = (grain = LANDING_GRAIN) => Math.max(0.03, grain / 100 * 0.5);
export const HERO_GRAIN_OPACITY = grainOpacity();

export function createHeroGrain(random = Math.random): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(256, 256);
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const gray = Math.round((random() + random()) * 0.5 * 255);
    image.data.set([gray, gray, gray, 255], offset);
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

let textureUrl: string | undefined;
export function getHeroGrainUrl(): string {
  return textureUrl ??= createHeroGrain().toDataURL();
}
