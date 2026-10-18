// Motion parameters from Özer's Filter Grid (MIT), used with our existing layout.
// https://www.interior.dev/docs/filter-grid
export const filterMotion = {
  chip: { type: 'spring', stiffness: 520, damping: 34, mass: 0.45 },
  // Finish the outgoing cards before moving or revealing their replacements.
  // Large slide artwork and captions must not crossfade on top of one another.
  card: { layout: { type: 'spring', stiffness: 260, damping: 34, mass: 0.8, delay: 0.14 }, delay: 0.14, duration: 0.2, ease: [0.23, 1, 0.32, 1] },
  exit: { duration: 0.14, ease: [0.4, 0, 1, 1] },
  instant: { duration: 0 },
} as const;
