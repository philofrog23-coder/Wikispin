/**
 * Reel geometry. Tiles sit in a row; tile i spans [i * STEP, i * STEP + TILE_W].
 * The reel moves via translateX; the marker is at the horizontal center of the viewport.
 * All functions are plain math so they can run on the UI thread (worklets) and in tests.
 */
export const TILE_W = 128;
export const TILE_GAP = 12;
export const STEP = TILE_W + TILE_GAP;
export const REEL_LENGTH = 46;
export const WINNER_INDEX = 38;
export const START_INDEX = 2;

/**
 * First tile under the marker before a spin. On wide screens the reel must start further in,
 * otherwise the space left of tile 0 shows as an empty gap.
 */
export function startIndexFor(viewportWidth: number): number {
  'worklet';
  const halfInTiles = Math.ceil(viewportWidth / 2 / STEP);
  return Math.min(WINNER_INDEX - 6, Math.max(START_INDEX, halfInTiles + 1));
}

/** Maximum distance from the tile center where the reel may stop (keeps the marker inside the tile). */
export const MAX_JITTER = TILE_W * 0.3;

export function tileCenter(index: number): number {
  'worklet';
  return index * STEP + TILE_W / 2;
}

/** translateX that puts `index` (+ jitter px) under the center marker. */
export function offsetFor(viewportWidth: number, index: number, jitter = 0): number {
  'worklet';
  return viewportWidth / 2 - (tileCenter(index) + jitter);
}

/** Index of the tile (or the gap after it) currently under the marker. */
export function indexAtMarker(translateX: number, viewportWidth: number): number {
  'worklet';
  return Math.floor((viewportWidth / 2 - translateX) / STEP);
}

/** Random stop position inside the winning tile, from a 0..1 random number. */
export function jitterFrom(random01: number): number {
  return (random01 * 2 - 1) * MAX_JITTER;
}

/** Spin duration in ms; slightly randomised so spins don't feel identical. */
export function spinDuration(random01: number): number {
  return 4600 + Math.round(random01 * 1000);
}
