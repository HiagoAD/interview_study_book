/**
 * How far the reader is through a block, from 0 to 1: 0 while its top is still at or below the top of the
 * reading area, 1 once its bottom has come up to the bottom of the viewport. `top` and `bottom` are the block's
 * edges relative to the viewport, as `getBoundingClientRect` gives them; `start` is where the reading area
 * begins, below anything pinned to the top of the screen. A block shorter than the reading area has no
 * distance to travel, so it counts as read once its bottom is on screen.
 */
export function readingDepth(top: number, bottom: number, viewport: number, start = 0): number {
  const travel = bottom - top - (viewport - start)
  if (travel <= 0) return bottom <= viewport ? 1 : 0
  return Math.min(1, Math.max(0, (start - top) / travel))
}
