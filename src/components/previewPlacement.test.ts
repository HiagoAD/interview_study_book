import { expect, test } from 'vitest'
import { PREVIEW_GAP, PREVIEW_MARGIN, placePreview } from './previewPlacement'
import type { Box, Viewport } from './previewPlacement'

const view = (over: Partial<Viewport> = {}): Viewport => ({ width: 1000, height: 800, scrollX: 0, scrollY: 0, ...over })
const link = (over: Partial<Box> = {}): Box => ({ top: 100, left: 200, width: 80, height: 20, ...over })
const card = { width: 320, height: 160 }

test('the card sits under the link, left edges aligned', () => {
  expect(placePreview(link(), card, view())).toEqual({ top: 100 + 20 + PREVIEW_GAP, left: 200, side: 'below' })
})

test('with no room below but room above, it flips over the link', () => {
  const low = link({ top: 700 })
  expect(placePreview(low, card, view())).toEqual({ top: 700 - PREVIEW_GAP - card.height, left: 200, side: 'above' })
})

test('with too little room either way, it takes the roomier side', () => {
  const short = view({ height: 200 })
  expect(placePreview(link({ top: 20 }), card, short).side).toBe('below')
  expect(placePreview(link({ top: 170 }), card, short).side).toBe('above')
})

test('a card that would cross the right edge is pulled back inside it', () => {
  const placed = placePreview(link({ left: 900 }), card, view())
  expect(placed.left).toBe(1000 - PREVIEW_MARGIN - card.width)
  expect(placed.left + card.width).toBeLessThanOrEqual(1000 - PREVIEW_MARGIN)
})

test('a card wider than the window keeps its left edge on screen', () => {
  const narrow = view({ width: 300 })
  expect(placePreview(link({ left: 250 }), card, narrow).left).toBe(PREVIEW_MARGIN)
})

test('a link at the very left is not pushed off the other way', () => {
  expect(placePreview(link({ left: 0 }), card, view()).left).toBe(PREVIEW_MARGIN)
})

test('placement is in page coordinates, so a scrolled page still puts the card beside its link', () => {
  const scrolled = view({ scrollY: 2000 })
  const below = placePreview(link({ top: 2100 }), card, scrolled)
  expect(below).toEqual({ top: 2100 + 20 + PREVIEW_GAP, left: 200, side: 'below' })

  // Near the bottom of that scrolled window there is no room below, and the flip is measured the same way.
  expect(placePreview(link({ top: 2700 }), card, scrolled).side).toBe('above')
})

test('a horizontally scrolled page clamps against the window, not the document', () => {
  const scrolled = view({ scrollX: 500 })
  // A link well inside the window keeps its own left edge.
  expect(placePreview(link({ left: 600 }), card, scrolled).left).toBe(600)
  // One at or past the window's left edge is brought in by the margin, not left at the document's edge.
  expect(placePreview(link({ left: 0 }), card, scrolled).left).toBe(500 + PREVIEW_MARGIN)
  expect(placePreview(link({ left: 1400 }), card, scrolled).left).toBe(1500 - PREVIEW_MARGIN - card.width)
})
