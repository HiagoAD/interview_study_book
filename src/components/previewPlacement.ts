/** A rectangle in page coordinates, which is what the card is positioned in so it travels with the page. */
export interface Box {
  top: number
  left: number
  width: number
  height: number
}

export interface Viewport {
  width: number
  height: number
  scrollX: number
  scrollY: number
}

export interface Placement {
  top: number
  left: number
  side: 'above' | 'below'
}

/** How far the card sits from the link, and how close it may come to the edge of the window. */
export const PREVIEW_GAP = 8
export const PREVIEW_MARGIN = 8

/**
 * Where to put a card of `card` size for a link at `anchor`, in page coordinates. It prefers to sit under
 * the link, flips above when there is not room below but there is above, and otherwise takes the roomier
 * side. Left of the link, then clamped into the window, so a link near an edge never pushes it off screen.
 */
export function placePreview(anchor: Box, card: { width: number; height: number }, viewport: Viewport): Placement {
  const below = anchor.top + anchor.height + PREVIEW_GAP
  const roomBelow = viewport.scrollY + viewport.height - PREVIEW_MARGIN - below
  const roomAbove = anchor.top - PREVIEW_GAP - PREVIEW_MARGIN - viewport.scrollY

  const fitsBelow = roomBelow >= card.height
  const side = fitsBelow || roomBelow >= roomAbove ? 'below' : 'above'
  const top = side === 'below' ? below : anchor.top - PREVIEW_GAP - card.height

  const leftLimit = viewport.scrollX + PREVIEW_MARGIN
  // A card wider than the window keeps its left edge on screen: there is no placement that fits it whole.
  const rightLimit = Math.max(leftLimit, viewport.scrollX + viewport.width - PREVIEW_MARGIN - card.width)
  const left = Math.min(Math.max(anchor.left, leftLimit), rightLimit)

  return { top, left, side }
}
