// The original gallery silhouette: bend vertically without changing artwork
// width. Card curvature grows continuously from its centered, completely flat pose.
export function galleryWarpPoint(x: number, y: number, cardCenter: number, cardWidth: number, viewportWidth: number, restrained = false): [number, number] {
  const side = Math.min(1, Math.abs(cardCenter) / cardWidth);
  const curvature = side * side * (3 - 2 * side);
  if (restrained) {
    // Keep the center untouched. Neighbors recede uniformly before the gentle
    // bend, so their outer edges no longer tower over the selected work.
    const shrink = 1 - .1 * curvature;
    const bend = viewportWidth < 768 ? .04 : .1;
    return [cardCenter + (x - cardCenter) * shrink, y * shrink * (1 + bend * curvature * (x / (viewportWidth / 2)) ** 2)];
  }
  const bend = viewportWidth < 768 ? .2 : .55;
  const scale = 1 + bend * curvature * (x / (viewportWidth / 2)) ** 2;
  return [x, y * scale];
}
